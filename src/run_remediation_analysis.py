"""Script to perform deep remediation analysis on identified capability gaps."""
import asyncio
import logging
from typing import List, Dict, Any

from .supabase_client import supabase
from .judges.remediation_judge import analyze_remediation

logger = logging.getLogger(__name__)

async def run_remediation_analysis(batch_id: str, write: bool = True):
    """Fetch gaps for a batch and run deep remediation analysis."""
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    # 1. Fetch gaps for this batch
    gaps_resp = supabase.table("capability_gaps").select("*").eq("batch_id", batch_id).execute()
    gaps = gaps_resp.data
    if not gaps:
        logger.warning(f"No gaps found for batch {batch_id}")
        return

    logger.info(f"Analyzing {len(gaps)} potential remediations for batch {batch_id}...")

    for gap in gaps:
        gap_id = gap["id"]
        pattern = gap["pattern"]
        affected_calls = gap["affected_calls"]

        if not affected_calls:
            continue

        # 2. Fetch sample issues and system prompt for this gap
        # We take the prompt from the first affected call
        sample_call_id = affected_calls[0]
        context_resp = supabase.table("call_contexts").select("raw_system_prompt").eq("call_id", sample_call_id).maybe_single().execute()
        system_prompt = context_resp.data.get("raw_system_prompt") if context_resp.data else ""

        # Fetch sample issues for this gap pattern (filtering by call IDs)
        issues_resp = supabase.table("issues").select("*").in_("call_id", affected_calls[:5]).execute()
        issues = issues_resp.data

        # 3. Analyze
        try:
            result = await analyze_remediation(gap_id, pattern, issues, system_prompt)
            
            # 4. Write Insights
            if write and result.insights:
                insight_rows = []
                for ins in result.insights:
                    insight_rows.append({
                        "gap_id": gap_id,
                        "root_cause_type": ins.root_cause_type,
                        "analysis": ins.analysis,
                        "proposed_remediation": ins.proposed_remediation,
                        "confidence_score": ins.confidence_score
                    })
                supabase.table("remediation_insights").insert(insight_rows).execute()
                logger.info(f"Wrote {len(insight_rows)} insights for gap {gap_id}")
        except Exception as e:
            logger.error(f"Failed analysis for gap {gap_id}: {e}", exc_info=True)

async def _main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-id", required=True, help="Batch ID to analyze")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    await run_remediation_analysis(args.batch_id, write=not args.dry_run)

if __name__ == "__main__":
    asyncio.run(_main())
