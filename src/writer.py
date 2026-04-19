"""Persist a single call's evaluation into Supabase (5 tables, idempotent per call_id)."""
import logging
from typing import Dict, List, Tuple

from .supabase_client import supabase
from .schemas import ClassificationResult, DimensionScore, Issue, ToolScore
from .aggregator import DIMENSION_WEIGHTS

logger = logging.getLogger(__name__)

CLASSIFY_MODEL = "gpt-4o-mini"
JUDGE_MODEL = "gpt-4o"


def write_evaluation(
    call_id: str,
    classification: ClassificationResult,
    dimension_results: Dict[str, DimensionScore],
    tool_scores: List[ToolScore],
    overall_score: float,
    calculation: str,
    critical_count: int,
    warning_count: int,
    recommendation: str,
) -> None:
    """Write the full evaluation for one call across 5 Supabase tables.

    Idempotent: re-running for the same call_id replaces all previous rows.
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    # 1. call_classifications — upsert single row
    supabase.table("call_classifications").upsert({
        "call_id": call_id,
        "call_type": classification.call_type,
        "primary_intent": classification.primary_intent,
        "reasoning": classification.reasoning,
        "model": CLASSIFY_MODEL,
    }, on_conflict="call_id").execute()

    # 2. dimension_scores — upsert 6 rows (one per dimension)
    dim_rows = []
    for dim_name, ds in dimension_results.items():
        model = "programmatic" if dim_name == "response_latency" else JUDGE_MODEL
        dim_rows.append({
            "call_id": call_id,
            "dimension": dim_name,
            "score": ds.score,
            "score_na": ds.score_na,
            "reasoning": ds.reasoning,
            "weight": DIMENSION_WEIGHTS[dim_name],
            "model": model,
        })
    supabase.table("dimension_scores").upsert(dim_rows, on_conflict="call_id,dimension").execute()

    # 3. tool_scores — replace all rows for this call
    supabase.table("tool_scores").delete().eq("call_id", call_id).execute()
    if tool_scores:
        tool_rows = [{
            "call_id": call_id,
            "tool_call_id": ts.tool_call_id,
            "tool_name": ts.tool_name,
            "score": ts.score,
            "reasoning": ts.reasoning,
        } for ts in tool_scores]
        supabase.table("tool_scores").insert(tool_rows).execute()

    # 4. issues — replace all rows for this call (no natural unique key, so delete+insert)
    supabase.table("issues").delete().eq("call_id", call_id).execute()
    issue_rows: List[dict] = []
    for dim_name, ds in dimension_results.items():
        for iss in ds.issues:
            issue_rows.append({
                "call_id": call_id,
                "dimension": dim_name,
                "issue_type": iss.issue_type,
                "severity": iss.severity,
                "turn_number": iss.turn_number,
                "evidence": {"text": iss.evidence},  # wrap str → JSONB
            })
    if issue_rows:
        supabase.table("issues").insert(issue_rows).execute()

    # 5. call_overall_scores — upsert single row
    supabase.table("call_overall_scores").upsert({
        "call_id": call_id,
        "overall_score": overall_score,
        "calculation": calculation,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "recommendation": recommendation,
    }, on_conflict="call_id").execute()

    logger.info(
        f"Wrote evaluation for {call_id}: overall={overall_score} "
        f"rec={recommendation} crit={critical_count} warn={warning_count} "
        f"dims={len(dim_rows)} tools={len(tool_scores)} issues={len(issue_rows)}"
    )
