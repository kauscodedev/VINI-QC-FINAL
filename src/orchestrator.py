"""End-to-end per-call evaluation: context → classify → 5 judges + latency → aggregate → Supabase."""
import asyncio
import logging
from typing import Optional, Dict

from .data_source import DataSource, SQLiteDataSource, SupabaseDataSource
from .context_builder import build_context
from .latency import compute_latency
from .formatters import format_transcript
from .judges import (
    classify_call,
    judge_information_accuracy,
    judge_tool_accuracy,
    judge_escalation,
    judge_conversion,
    judge_conversation_quality,
)
from .judges.latency_score import score_latency
from .aggregator import aggregate, tool_accuracy_to_dimension_score
from .writer import write_evaluation
from .schemas import DimensionScore

logger = logging.getLogger(__name__)


async def evaluate_call(call_id: str, source: DataSource, write: bool = True) -> dict:
    """Run the full QC pipeline for one call. Writes to Supabase if write=True."""
    ctx = build_context(call_id, source)
    ctx = compute_latency(ctx)

    transcript_text = format_transcript(ctx, include_tools=True)
    classification = await asyncio.to_thread(classify_call, transcript_text)
    ctx["call_type"] = classification.call_type

    info_acc, tool_acc, esc, conv, conv_q = await asyncio.gather(
        judge_information_accuracy(ctx),
        judge_tool_accuracy(ctx),
        judge_escalation(ctx),
        judge_conversion(ctx),
        judge_conversation_quality(ctx),
    )
    latency_ds = score_latency(ctx)

    dimension_results: Dict[str, DimensionScore] = {
        "information_accuracy": info_acc,
        "tool_accuracy": tool_accuracy_to_dimension_score(tool_acc),
        "escalation": esc,
        "conversion": conv,
        "conversation_quality": conv_q,
        "response_latency": latency_ds,
    }

    overall, calc, crit, warn, rec = aggregate(dimension_results)

    if write:
        write_evaluation(
            call_id=call_id,
            classification=classification,
            dimension_results=dimension_results,
            tool_scores=tool_acc.tool_scores,
            overall_score=overall,
            calculation=calc,
            critical_count=crit,
            warning_count=warn,
            recommendation=rec,
        )

    return {
        "call_id": call_id,
        "call_type": classification.call_type,
        "overall_score": overall,
        "recommendation": rec,
        "critical_count": crit,
        "warning_count": warn,
        "dimension_scores": {
            name: {"score": ds.score, "na": ds.score_na, "issues": len(ds.issues)}
            for name, ds in dimension_results.items()
        },
        "tool_scores": [{"tool": ts.tool_name, "score": ts.score} for ts in tool_acc.tool_scores],
    }


async def evaluate_all(source: DataSource, limit: Optional[int] = None, write: bool = True) -> list:
    """Evaluate every call in the source, sequentially (to respect OpenAI rate limits)."""
    call_ids = source.list_call_ids()
    if limit:
        call_ids = call_ids[:limit]

    results = []
    for i, call_id in enumerate(call_ids, 1):
        try:
            logger.info(f"[{i}/{len(call_ids)}] Evaluating {call_id}")
            summary = await evaluate_call(call_id, source, write=write)
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
    parser.add_argument("--limit", type=int, help="Cap --all to N calls (for testing)")
    parser.add_argument("--source", default="sqlite", choices=["sqlite", "supabase"])
    parser.add_argument("--dry-run", action="store_true", help="Don't write to Supabase")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.source == "sqlite":
        source = SQLiteDataSource("calls.db")
    else:
        source = SupabaseDataSource()

    write = not args.dry_run

    if args.call_id:
        result = asyncio.run(evaluate_call(args.call_id, source, write=write))
        print(json.dumps(result, indent=2))
    elif args.all:
        results = asyncio.run(evaluate_all(source, limit=args.limit, write=write))
        ok = [r for r in results if "error" not in r]
        fail = [r for r in results if "error" in r]
        print(f"\nEvaluated {len(ok)} calls successfully, {len(fail)} failed.")
        if ok:
            avg = sum(r["overall_score"] for r in ok) / len(ok)
            print(f"Average overall score: {avg:.2f}")
            dist = {}
            for r in ok:
                dist[r["recommendation"]] = dist.get(r["recommendation"], 0) + 1
            print(f"Recommendation distribution: {dist}")
    else:
        parser.error("Provide --call-id or --all")


if __name__ == "__main__":
    _main()
