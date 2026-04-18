"""
Batch Classification Runner
----------------------------
Loops through all calls in Supabase, classifies each one via the OpenAI judge,
and upserts results into the call_classifications table.
"""
import logging
import time

from .data_source import SupabaseDataSource
from .context_builder import build_context
from .formatters import format_transcript
from .judges.classify import classify_call, MODEL
from .supabase_client import supabase

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def run_classification(call_ids: list = None, dry_run: bool = False):
    if not supabase:
        logger.error("Supabase client not initialized.")
        return

    source = SupabaseDataSource()

    if not call_ids:
        call_ids = source.list_call_ids()

    logger.info(f"Classifying {len(call_ids)} calls...")
    results_summary = {}

    for i, cid in enumerate(call_ids, 1):
        try:
            ctx = build_context(cid, source)
            transcript_text = format_transcript(ctx, include_tools=True)

            # Skip calls with empty transcripts (0 messages after filtering system)
            if not transcript_text.strip():
                logger.info(f"  [{i}/{len(call_ids)}] {cid[:12]}... SKIPPED (empty transcript)")
                continue

            result = classify_call(transcript_text)

            # Track distribution
            results_summary[result.call_type] = results_summary.get(result.call_type, 0) + 1

            if not dry_run:
                supabase.table("call_classifications").upsert({
                    "call_id": cid,
                    "call_type": result.call_type,
                    "primary_intent": result.primary_intent,
                    "reasoning": result.reasoning,
                    "model": MODEL,
                }, on_conflict="call_id").execute()

            logger.info(f"  [{i}/{len(call_ids)}] {cid[:12]}... → {result.call_type}")

            # Light rate-limit courtesy
            time.sleep(0.3)

        except Exception as e:
            logger.error(f"  [{i}/{len(call_ids)}] {cid[:12]}... FAILED: {e}")

    # Print distribution summary
    logger.info("\n--- Classification Distribution ---")
    for ct, count in sorted(results_summary.items(), key=lambda x: -x[1]):
        logger.info(f"  {ct}: {count}")
    logger.info(f"  TOTAL: {sum(results_summary.values())}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Classify all calls via OpenAI")
    parser.add_argument("--call-id", help="Classify a single call by ID")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to Supabase")
    args = parser.parse_args()

    if args.call_id:
        run_classification(call_ids=[args.call_id], dry_run=args.dry_run)
    else:
        run_classification(dry_run=args.dry_run)
