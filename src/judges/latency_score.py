"""Programmatic Latency dimension scorer.

Rules (matches ARCHITECTURE.md thresholds):
- > 6s agent latency → high_latency flag
- > 12s dead air → excessive_dead_air flag
- Score 3: 0 flags
- Score 2: 1-2 flags total
- Score 1: 3+ flags total
- N/A: latency_metrics.format == "legacy" (no timestamps available)
"""
from ..schemas import ContextJSON, DimensionScore, Issue


def score_latency(ctx: ContextJSON) -> DimensionScore:
    lm = ctx.get("latency_metrics") or {}

    if lm.get("format") == "legacy" or not lm:
        return DimensionScore(
            score=None,
            score_na=True,
            reasoning="No turn timestamps available; latency cannot be computed.",
            issues=[],
        )

    high = lm.get("high_latency_turns") or []
    dead = lm.get("excessive_dead_air_turns") or []
    total_flags = len(high) + len(dead)

    issues = []
    for t in high:
        issues.append(Issue(
            issue_type="HIGH_LATENCY",
            severity="warning",
            turn_number=t.get("turn"),
            evidence=f"Bot took {t.get('latency_ms')}ms to respond (threshold: 6000ms).",
        ))
    for t in dead:
        issues.append(Issue(
            issue_type="EXCESSIVE_DEAD_AIR",
            severity="warning",
            turn_number=t.get("turn"),
            evidence=f"Dead air of {t.get('dead_air_ms')}ms before user spoke (threshold: 12000ms).",
        ))

    if total_flags == 0:
        score = 3
    elif total_flags <= 2:
        score = 2
    else:
        score = 1

    median = lm.get("median_agent_latency_ms")
    max_lat = lm.get("max_agent_latency_ms")
    reasoning = (
        f"Median agent latency: {median}ms, max: {max_lat}ms. "
        f"Flags: {len(high)} high-latency turn(s), {len(dead)} excessive dead-air turn(s)."
    )

    return DimensionScore(
        score=score,
        score_na=False,
        reasoning=reasoning,
        issues=issues,
    )
