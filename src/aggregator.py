"""Aggregate dimension scores into an overall call score + recommendation.

Supports two evaluation tracks, called with different weight dicts:
- Technical track (DIMENSION_WEIGHTS)
- Behavioral / SDR-lens track (BEHAVIORAL_WEIGHTS)
"""
from typing import Dict, List, Tuple
from .schemas import DimensionScore, Issue, ToolAccuracyResult

# Technical track weights (sum = 1.0).
DIMENSION_WEIGHTS: Dict[str, float] = {
    "information_accuracy": 0.20,
    "conversion": 0.20,
    "tool_accuracy": 0.20,
    "escalation": 0.15,
    "conversation_quality": 0.15,
    "response_latency": 0.10,
}

# Behavioral / SDR-lens track weights (sum = 1.0). Per PM doc SalesIBEvaluationscore.rtf.
BEHAVIORAL_WEIGHTS: Dict[str, float] = {
    "behavior_opening_tone": 0.10,
    "behavior_intent_discovery": 0.20,
    "behavior_resolution_accuracy": 0.20,
    "behavior_objection_recovery": 0.15,
    "behavior_conversation_management": 0.10,
    "behavior_conversion_next_step": 0.25,
}

# Combined lookup for writers that need per-dimension weight regardless of track.
ALL_WEIGHTS: Dict[str, float] = {**DIMENSION_WEIGHTS, **BEHAVIORAL_WEIGHTS}


def aggregate(
    dimension_results: Dict[str, DimensionScore],
    weights: Dict[str, float] = DIMENSION_WEIGHTS,
) -> Tuple[float, str, int, int, str]:
    """Compute overall score, calculation trace, issue counts, and recommendation.

    Args:
        dimension_results: mapping of dimension name → DimensionScore
            (for tool_accuracy, pass the DimensionScore view; tool_scores handled separately)
        weights: weight dict for the track being aggregated. Defaults to technical.

    Returns:
        (overall_score, calculation_trace, critical_count, warning_count, recommendation)
    """
    # Filter out N/A dimensions, renormalize remaining weights
    active = {
        name: ds for name, ds in dimension_results.items()
        if not ds.score_na and ds.score is not None
    }
    if not active:
        return (0.0, "All dimensions N/A — no score computed.", 0, 0, "REVIEW")

    total_weight = sum(weights[name] for name in active)
    if total_weight == 0:
        return (0.0, "No active dimensions with weight.", 0, 0, "REVIEW")

    weighted_sum = 0.0
    trace_parts: List[str] = []
    for name, ds in active.items():
        renorm_weight = weights[name] / total_weight
        contribution = ds.score * renorm_weight
        weighted_sum += contribution
        trace_parts.append(f"{name}={ds.score}×{renorm_weight:.3f}")
    na_names = [n for n, ds in dimension_results.items() if ds.score_na]
    na_note = f" (N/A excluded: {', '.join(na_names)})" if na_names else ""
    calculation = " + ".join(trace_parts) + f" = {weighted_sum:.2f}{na_note}"

    # Count issues across all dimensions (including N/A ones, which may still flag issues)
    critical = 0
    warning = 0
    for ds in dimension_results.values():
        for iss in ds.issues:
            if iss.severity == "critical":
                critical += 1
            elif iss.severity == "warning":
                warning += 1

    if weighted_sum < 1.5 or critical >= 2:
        recommendation = "FAIL"
    elif critical >= 1:
        recommendation = "REVIEW"
    elif warning >= 1:
        recommendation = "PASS_WITH_ISSUES"
    else:
        recommendation = "PASS"

    return (round(weighted_sum, 3), calculation, critical, warning, recommendation)


def flatten_issues(dimension_results: Dict[str, DimensionScore]) -> List[Tuple[str, Issue]]:
    """Flatten all issues across dimensions into (dimension_name, Issue) tuples."""
    out: List[Tuple[str, Issue]] = []
    for dim, ds in dimension_results.items():
        for iss in ds.issues:
            out.append((dim, iss))
    return out


def tool_accuracy_to_dimension_score(tar: ToolAccuracyResult) -> DimensionScore:
    """Strip tool_scores from ToolAccuracyResult to get a plain DimensionScore view."""
    return DimensionScore(
        score=tar.score,
        score_na=tar.score_na,
        reasoning=tar.reasoning,
        issues=tar.issues,
    )
