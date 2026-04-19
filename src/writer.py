"""Persist a single call's two-track evaluation into Supabase.

Writes to 5 tables idempotently per call_id:
- call_classifications (upsert, 1 row)
- dimension_scores (upsert, 12 rows: 6 technical + 6 behavioral, each tagged with bucket)
- tool_scores (delete+insert, 0-N rows; only from technical tool_accuracy judge)
- issues (delete+insert, 0-N rows, each tagged with its bucket)
- call_overall_scores (upsert, 1 row with both tracks' overall columns)
"""
import logging
from typing import Dict, List

from .supabase_client import supabase
from .schemas import ClassificationResult, DimensionScore, ToolScore
from .aggregator import ALL_WEIGHTS

logger = logging.getLogger(__name__)

CLASSIFY_MODEL = "gpt-4o-mini"
JUDGE_MODEL = "gpt-4o"


def _dim_rows(call_id: str, results: Dict[str, DimensionScore], bucket: str) -> List[dict]:
    """Build dimension_scores rows for one track."""
    rows = []
    for name, ds in results.items():
        model = "programmatic" if name == "response_latency" else JUDGE_MODEL
        rows.append({
            "call_id": call_id,
            "dimension": name,
            "score": ds.score,
            "score_na": ds.score_na,
            "reasoning": ds.reasoning,
            "weight": ALL_WEIGHTS[name],
            "model": model,
            "bucket": bucket,
        })
    return rows


def _issue_rows(call_id: str, results: Dict[str, DimensionScore], bucket: str) -> List[dict]:
    """Build issues rows for one track. evidence is wrapped as JSONB."""
    rows = []
    for dim_name, ds in results.items():
        for iss in ds.issues:
            rows.append({
                "call_id": call_id,
                "dimension": dim_name,
                "issue_type": iss.issue_type,
                "severity": iss.severity,
                "turn_number": iss.turn_number,
                "evidence": {"text": iss.evidence},
                "bucket": bucket,
            })
    return rows


def write_evaluation(
    call_id: str,
    classification: ClassificationResult,
    technical_results: Dict[str, DimensionScore],
    behavioral_results: Dict[str, DimensionScore],
    tool_scores: List[ToolScore],
    technical_overall: float,
    technical_calculation: str,
    technical_critical_count: int,
    technical_warning_count: int,
    technical_recommendation: str,
    behavioral_overall: float,
    behavioral_calculation: str,
    behavioral_critical_count: int,
    behavioral_warning_count: int,
    behavioral_recommendation: str,
) -> None:
    """Write the full two-track evaluation for one call. Idempotent per call_id."""
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    # 1. call_classifications
    supabase.table("call_classifications").upsert({
        "call_id": call_id,
        "call_type": classification.call_type,
        "primary_intent": classification.primary_intent,
        "reasoning": classification.reasoning,
        "model": CLASSIFY_MODEL,
    }, on_conflict="call_id").execute()

    # 2. dimension_scores — 12 rows (6 technical + 6 behavioral)
    dim_rows = (
        _dim_rows(call_id, technical_results, "technical")
        + _dim_rows(call_id, behavioral_results, "behavioral")
    )
    supabase.table("dimension_scores").upsert(dim_rows, on_conflict="call_id,dimension").execute()

    # 3. tool_scores — only from technical tool_accuracy judge
    supabase.table("tool_scores").delete().eq("call_id", call_id).execute()
    if tool_scores:
        supabase.table("tool_scores").insert([{
            "call_id": call_id,
            "tool_call_id": ts.tool_call_id,
            "tool_name": ts.tool_name,
            "score": ts.score,
            "reasoning": ts.reasoning,
        } for ts in tool_scores]).execute()

    # 4. issues — replace all rows across both tracks
    supabase.table("issues").delete().eq("call_id", call_id).execute()
    issue_rows = (
        _issue_rows(call_id, technical_results, "technical")
        + _issue_rows(call_id, behavioral_results, "behavioral")
    )
    if issue_rows:
        supabase.table("issues").insert(issue_rows).execute()

    # 5. call_overall_scores — both tracks in one row
    supabase.table("call_overall_scores").upsert({
        "call_id": call_id,
        # Technical track (renamed with technical_ prefix by sql/004_rename_technical_columns.sql)
        "technical_overall_score": technical_overall,
        "technical_calculation": technical_calculation,
        "technical_critical_count": technical_critical_count,
        "technical_warning_count": technical_warning_count,
        "technical_recommendation": technical_recommendation,
        # Behavioral track (added by sql/003_behavioral_columns.sql)
        "behavioral_overall_score": behavioral_overall,
        "behavioral_calculation": behavioral_calculation,
        "behavioral_critical_count": behavioral_critical_count,
        "behavioral_warning_count": behavioral_warning_count,
        "behavioral_recommendation": behavioral_recommendation,
    }, on_conflict="call_id").execute()

    logger.info(
        f"Wrote {call_id}: "
        f"tech overall={technical_overall} rec={technical_recommendation} "
        f"behv overall={behavioral_overall} rec={behavioral_recommendation} "
        f"(dims={len(dim_rows)}, tools={len(tool_scores)}, issues={len(issue_rows)})"
    )


def write_behavioral_only(
    call_id: str,
    behavioral_results: Dict[str, DimensionScore],
    behavioral_overall: float,
    behavioral_calculation: str,
    behavioral_critical_count: int,
    behavioral_warning_count: int,
    behavioral_recommendation: str,
) -> None:
    """Write only the behavioral track for one call, preserving existing technical rows.

    - dimension_scores: upserts 6 behavioral rows. Technical rows untouched (different
      dimension names, so no unique-key collision).
    - issues: deletes only rows where bucket='behavioral' for this call, re-inserts.
      Technical issues are preserved.
    - call_overall_scores: UPDATE only behavioral_* columns on the existing row.
      Technical columns (technical_overall_score, technical_recommendation, etc.) are
      preserved. A bare upsert would insert NULL into those NOT-NULL columns on conflict.
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    # 1. dimension_scores — 6 behavioral rows
    dim_rows = _dim_rows(call_id, behavioral_results, "behavioral")
    supabase.table("dimension_scores").upsert(dim_rows, on_conflict="call_id,dimension").execute()

    # 2. issues — replace only behavioral rows for this call
    supabase.table("issues").delete().eq("call_id", call_id).eq("bucket", "behavioral").execute()
    issue_rows = _issue_rows(call_id, behavioral_results, "behavioral")
    if issue_rows:
        supabase.table("issues").insert(issue_rows).execute()

    # 3. call_overall_scores — UPDATE only behavioral columns on the existing row.
    # (upsert would INSERT with NULLs for technical NOT-NULL columns; UPDATE preserves them.)
    # Assumes the row exists from a prior technical run — evaluate_call_behavioral_only
    # already enforces this via _fetch_existing_call_type().
    supabase.table("call_overall_scores").update({
        "behavioral_overall_score": behavioral_overall,
        "behavioral_calculation": behavioral_calculation,
        "behavioral_critical_count": behavioral_critical_count,
        "behavioral_warning_count": behavioral_warning_count,
        "behavioral_recommendation": behavioral_recommendation,
    }).eq("call_id", call_id).execute()

    logger.info(
        f"Wrote behavioral for {call_id}: "
        f"overall={behavioral_overall} rec={behavioral_recommendation} "
        f"(dims={len(dim_rows)}, issues={len(issue_rows)})"
    )
