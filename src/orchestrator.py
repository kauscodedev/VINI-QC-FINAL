"""End-to-end per-call evaluation across two tracks (technical + behavioral).

Pipeline: context → classify → 11 async LLM judges in parallel + programmatic latency →
aggregate each track → Supabase writes.
"""
import asyncio
import logging
from typing import Optional, Dict

from .data_source import DataSource, SQLiteDataSource, SupabaseDataSource
from .context_builder import build_context
from .latency import compute_latency
from .formatters import format_transcript
from .judges import (
    classify_call,
    # technical
    judge_information_accuracy,
    judge_tool_accuracy,
    judge_escalation,
    judge_conversion,
    judge_conversation_quality,
    # behavioral
    judge_behavior_opening_tone,
    judge_behavior_intent_discovery,
    judge_behavior_resolution_accuracy,
    judge_behavior_objection_recovery,
    judge_behavior_conversation_management,
    judge_behavior_conversion_next_step,
)
from .judges.latency_score import score_latency
from .aggregator import (
    aggregate,
    tool_accuracy_to_dimension_score,
    DIMENSION_WEIGHTS,
    BEHAVIORAL_WEIGHTS,
)
from .writer import write_evaluation, write_behavioral_only
from .supabase_client import supabase
from .schemas import DimensionScore

logger = logging.getLogger(__name__)


async def evaluate_call(call_id: str, source: DataSource, write: bool = True) -> dict:
    """Run the full QC pipeline (technical + behavioral tracks) for one call."""
    ctx = build_context(call_id, source)
    ctx = compute_latency(ctx)

    transcript_text = format_transcript(ctx, include_tools=True)
    classification = await asyncio.to_thread(classify_call, transcript_text)
    ctx["call_type"] = classification.call_type

    # Fan out all 11 LLM judges in parallel.
    (
        info_acc, tool_acc, esc, conv, conv_q,
        b_open, b_intent, b_resol, b_obj, b_conv_mgmt, b_next,
    ) = await asyncio.gather(
        judge_information_accuracy(ctx),
        judge_tool_accuracy(ctx),
        judge_escalation(ctx),
        judge_conversion(ctx),
        judge_conversation_quality(ctx),
        judge_behavior_opening_tone(ctx),
        judge_behavior_intent_discovery(ctx),
        judge_behavior_resolution_accuracy(ctx),
        judge_behavior_objection_recovery(ctx),
        judge_behavior_conversation_management(ctx),
        judge_behavior_conversion_next_step(ctx),
    )
    latency_ds = score_latency(ctx)

    technical_results: Dict[str, DimensionScore] = {
        "information_accuracy": info_acc,
        "tool_accuracy": tool_accuracy_to_dimension_score(tool_acc),
        "escalation": esc,
        "conversion": conv,
        "conversation_quality": conv_q,
        "response_latency": latency_ds,
    }
    behavioral_results: Dict[str, DimensionScore] = {
        "behavior_opening_tone": b_open,
        "behavior_intent_discovery": b_intent,
        "behavior_resolution_accuracy": b_resol,
        "behavior_objection_recovery": b_obj,
        "behavior_conversation_management": b_conv_mgmt,
        "behavior_conversion_next_step": b_next,
    }

    t_overall, t_calc, t_crit, t_warn, t_rec = aggregate(technical_results, DIMENSION_WEIGHTS)
    b_overall, b_calc, b_crit, b_warn, b_rec = aggregate(behavioral_results, BEHAVIORAL_WEIGHTS)

    if write:
        write_evaluation(
            call_id=call_id,
            classification=classification,
            technical_results=technical_results,
            behavioral_results=behavioral_results,
            tool_scores=tool_acc.tool_scores,
            technical_overall=t_overall,
            technical_calculation=t_calc,
            technical_critical_count=t_crit,
            technical_warning_count=t_warn,
            technical_recommendation=t_rec,
            behavioral_overall=b_overall,
            behavioral_calculation=b_calc,
            behavioral_critical_count=b_crit,
            behavioral_warning_count=b_warn,
            behavioral_recommendation=b_rec,
        )

    return {
        "call_id": call_id,
        "call_type": classification.call_type,
        "technical": {
            "overall": t_overall,
            "recommendation": t_rec,
            "critical": t_crit,
            "warning": t_warn,
        },
        "behavioral": {
            "overall": b_overall,
            "recommendation": b_rec,
            "critical": b_crit,
            "warning": b_warn,
        },
        "dimension_scores": {
            **{n: {"score": ds.score, "na": ds.score_na, "issues": len(ds.issues), "bucket": "technical"}
               for n, ds in technical_results.items()},
            **{n: {"score": ds.score, "na": ds.score_na, "issues": len(ds.issues), "bucket": "behavioral"}
               for n, ds in behavioral_results.items()},
        },
        "tool_scores": [{"tool": ts.tool_name, "score": ts.score} for ts in tool_acc.tool_scores],
    }


def _fetch_existing_call_type(call_id: str) -> Optional[str]:
    """Read the previously-stored classification from Supabase (skip re-classifying)."""
    resp = supabase.table("call_classifications").select("call_type").eq("call_id", call_id).maybe_single().execute()
    return resp.data.get("call_type") if resp and resp.data else None


async def evaluate_call_behavioral_only(call_id: str, source: DataSource, write: bool = True) -> dict:
    """Run only the 6 behavioral judges for one call. Reuses existing classification from Supabase.

    Use this when technical scores already exist in Supabase and you want to add (or refresh)
    just the behavioral track without re-running classify, 5 technical judges, or latency.
    """
    ctx = build_context(call_id, source)
    ctx = compute_latency(ctx)

    existing_call_type = _fetch_existing_call_type(call_id)
    if existing_call_type is None:
        raise RuntimeError(
            f"No existing classification found for {call_id}. "
            f"Run technical track first, or use --track both to classify now."
        )
    ctx["call_type"] = existing_call_type

    b_open, b_intent, b_resol, b_obj, b_conv_mgmt, b_next = await asyncio.gather(
        judge_behavior_opening_tone(ctx),
        judge_behavior_intent_discovery(ctx),
        judge_behavior_resolution_accuracy(ctx),
        judge_behavior_objection_recovery(ctx),
        judge_behavior_conversation_management(ctx),
        judge_behavior_conversion_next_step(ctx),
    )
    behavioral_results: Dict[str, DimensionScore] = {
        "behavior_opening_tone": b_open,
        "behavior_intent_discovery": b_intent,
        "behavior_resolution_accuracy": b_resol,
        "behavior_objection_recovery": b_obj,
        "behavior_conversation_management": b_conv_mgmt,
        "behavior_conversion_next_step": b_next,
    }

    b_overall, b_calc, b_crit, b_warn, b_rec = aggregate(behavioral_results, BEHAVIORAL_WEIGHTS)

    if write:
        write_behavioral_only(
            call_id=call_id,
            behavioral_results=behavioral_results,
            behavioral_overall=b_overall,
            behavioral_calculation=b_calc,
            behavioral_critical_count=b_crit,
            behavioral_warning_count=b_warn,
            behavioral_recommendation=b_rec,
        )

    return {
        "call_id": call_id,
        "call_type": existing_call_type,
        "behavioral": {
            "overall": b_overall,
            "recommendation": b_rec,
            "critical": b_crit,
            "warning": b_warn,
        },
        "dimension_scores": {
            n: {"score": ds.score, "na": ds.score_na, "issues": len(ds.issues), "bucket": "behavioral"}
            for n, ds in behavioral_results.items()
        },
    }


async def evaluate_all(
    source: DataSource,
    limit: Optional[int] = None,
    write: bool = True,
    track: str = "both",
    unprocessed_only: bool = False,
) -> list:
    """Evaluate every call in the source, sequentially (to respect OpenAI rate limits).
    """
    if unprocessed_only:
        call_ids = source.list_unprocessed_call_ids()
    else:
        call_ids = source.list_call_ids()
    if limit:
        call_ids = call_ids[:limit]

    runner = evaluate_call_behavioral_only if track == "behavioral" else evaluate_call

    results = []
    for i, call_id in enumerate(call_ids, 1):
        try:
            logger.info(f"[{i}/{len(call_ids)}] Evaluating {call_id} (track={track})")
            summary = await runner(call_id, source, write=write)
            results.append(summary)
        except Exception as e:
            logger.error(f"Failed {call_id}: {e}", exc_info=True)
            results.append({"call_id": call_id, "error": str(e)})
    return results


def _main():
    import argparse
    import json

    parser = argparse.ArgumentParser()
    parser.add_argument("--call-id", help="Evaluate a single call")
    parser.add_argument("--all", action="store_true", help="Evaluate every call")
    parser.add_argument("--unprocessed", action="store_true", help="Only evaluate calls without scores")
    parser.add_argument("--limit", type=int, help="Cap --all to N calls (for testing)")
    parser.add_argument("--source", default="sqlite", choices=["sqlite", "supabase"])
    parser.add_argument("--dry-run", action="store_true", help="Don't write to Supabase")
    parser.add_argument(
        "--track",
        default="both",
        choices=["both", "behavioral"],
        help="'both' runs full technical+behavioral pipeline; "
             "'behavioral' runs only the 6 SDR judges (reuses existing classification from Supabase)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.source == "sqlite":
        source = SQLiteDataSource("calls.db")
    else:
        source = SupabaseDataSource()

    write = not args.dry_run

    runner = evaluate_call_behavioral_only if args.track == "behavioral" else evaluate_call

    if args.call_id:
        result = asyncio.run(runner(args.call_id, source, write=write))
        print(json.dumps(result, indent=2))
    elif args.all or args.unprocessed:
        results = asyncio.run(evaluate_all(
            source, 
            limit=args.limit, 
            write=write, 
            track=args.track, 
            unprocessed_only=args.unprocessed
        ))
        ok = [r for r in results if "error" not in r]
        fail = [r for r in results if "error" in r]
        print(f"\nEvaluated {len(ok)} calls successfully, {len(fail)} failed.")
        if ok:
            if args.track == "both":
                t_avg = sum(r["technical"]["overall"] for r in ok) / len(ok)
                b_avg = sum(r["behavioral"]["overall"] for r in ok) / len(ok)
                print(f"Avg technical overall:  {t_avg:.2f}")
                print(f"Avg behavioral overall: {b_avg:.2f}")
                t_dist, b_dist = {}, {}
                for r in ok:
                    t_dist[r["technical"]["recommendation"]] = t_dist.get(r["technical"]["recommendation"], 0) + 1
                    b_dist[r["behavioral"]["recommendation"]] = b_dist.get(r["behavioral"]["recommendation"], 0) + 1
                print(f"Technical recs:  {t_dist}")
                print(f"Behavioral recs: {b_dist}")
            else:
                b_avg = sum(r["behavioral"]["overall"] for r in ok) / len(ok)
                print(f"Avg behavioral overall: {b_avg:.2f}")
                b_dist = {}
                for r in ok:
                    b_dist[r["behavioral"]["recommendation"]] = b_dist.get(r["behavioral"]["recommendation"], 0) + 1
                print(f"Behavioral recs: {b_dist}")
    else:
        parser.error("Provide --call-id or --all")


if __name__ == "__main__":
    _main()
