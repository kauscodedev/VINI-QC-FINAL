"""Batch aggregation logic for runs and capability gaps.

Fetches scores and issues from Supabase, computes statistics, runs gap analysis,
and writes results to batch_runs and capability_gaps.
"""
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import statistics

from .supabase_client import supabase
from .judges.gap_analyzer import analyze_gaps
from .schemas import GapAnalysisResult

logger = logging.getLogger(__name__)

async def run_all_time_aggregation(write: bool = True) -> Dict[str, Any]:
    """Run aggregation across all calls in Supabase."""
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    logger.info("Starting all-time batch aggregation...")

    # We need call_overall_scores for averages.
    overall_resp = supabase.table("call_overall_scores").select("*").execute()
    overalls = overall_resp.data
    
    # We only want to run Gap Analysis (LLM) on NEW calls to save tokens.
    # Get IDs of calls that haven't been summarized yet.
    unanalyzed_ids = [r["call_id"] for r in overalls if not r.get("is_fully_analyzed", False)]
    
    if unanalyzed_ids:
        # Fetch issues only for these new calls
        issues_resp = supabase.table("issues")\
            .select("*")\
            .in_("call_id", unanalyzed_ids)\
            .execute()
        issues = issues_resp.data
    else:
        issues = []
    
    dim_scores_resp = supabase.table("dimension_scores").select("dimension, score, bucket").execute()
    dim_scores = dim_scores_resp.data

    if not overalls:
        logger.warning("No calls found to aggregate.")
        return {"error": "No data found"}

    # 2. Compute Statistics
    # Filter out 0 or NULL scores (0 usually means N/A in our aggregator return if not handled carefully, 
    # but here we check for physical values).
    tech_scores = [r["technical_overall_score"] for r in overalls if r["technical_overall_score"] is not None]
    behav_scores = [r["behavioral_overall_score"] for r in overalls if r["behavioral_overall_score"] is not None]

    avg_tech = sum(tech_scores) / len(tech_scores) if tech_scores else 0
    avg_behav = sum(behav_scores) / len(behav_scores) if behav_scores else 0
    
    # Combined average for the overall batch row
    all_scores = tech_scores + behav_scores
    avg_all = sum(all_scores) / len(all_scores) if all_scores else 0
    med_all = statistics.median(all_scores) if all_scores else 0

    # Score Distribution
    dist = {"1.0-1.5": 0, "1.6-2.0": 0, "2.1-2.5": 0, "2.6-3.0": 0}
    for s in all_scores:
        if 1.0 <= s <= 1.5: dist["1.0-1.5"] += 1
        elif 1.5 < s <= 2.0: dist["1.6-2.0"] += 1
        elif 2.0 < s <= 2.5: dist["2.1-2.5"] += 1
        elif 2.5 < s <= 3.0: dist["2.6-3.0"] += 1

    # Tool Accuracy Breakdown
    # We'll group dimension_scores by 'tool_accuracy' (technical track)
    tool_acc_dims = [r["score"] for r in dim_scores if r["dimension"] == "tool_accuracy" and r["score"] is not None]
    avg_tool_acc = sum(tool_acc_dims) / len(tool_acc_dims) if tool_acc_dims else 0

    # 3. Gap Analysis (LLM)
    # Prepare issues for the judge. We only need critical info to keep payload small.
    issues_for_judge = [
        {
            "call_id": i["call_id"],
            "dimension": i["dimension"],
            "issue_type": i["issue_type"],
            "severity": i["severity"],
            "evidence": i["evidence"].get("text", "") if isinstance(i["evidence"], dict) else i["evidence"]
        } for i in issues
    ]
    
    # Run gap analysis (this uses OpenAI)
    # We prioritize critical issues and cap total items to avoid API limits.
    criticals = [i for i in issues_for_judge if i["severity"] == "critical"]
    warnings = [i for i in issues_for_judge if i["severity"] == "warning"]
    
    # Take all criticals (usually fewer) and enough warnings to fill a buffer of 300
    limited_issues = criticals[:200]
    needed = 300 - len(limited_issues)
    if needed > 0:
        limited_issues.extend(warnings[:needed])
        
    logger.info(f"Passing {len(limited_issues)} sampled issues to gap analyzer (from {len(issues_for_judge)} total).")
    gap_result: GapAnalysisResult = await analyze_gaps(limited_issues)

    # 4. Write to Supabase
    batch_id = f"all_time_{datetime.now().strftime('%Y%p%d_%H%M')}"
    
    batch_row = {
        "batch_id": batch_id,
        "period_start": datetime.min.isoformat() + "Z", # effectively all-time
        "period_end": datetime.now().isoformat() + "Z",
        "calls_evaluated": len(overalls),
        "average_score": round(avg_all, 3),
        "median_score": round(med_all, 3),
        "stats": {
            "technical_avg": round(avg_tech, 3),
            "behavioral_avg": round(avg_behav, 3),
            "score_distribution": dist,
            "avg_tool_accuracy": round(avg_tool_acc, 3),
        },
        "ran_at": datetime.now().isoformat() + "Z"
    }

    if write:
        supabase.table("batch_runs").insert(batch_row).execute()
        
        if gap_result.gaps:
            gap_rows = []
            for g in gap_result.gaps:
                gap_rows.append({
                    "batch_id": batch_id,
                    "gap_type": g.gap_type,
                    "pattern": g.pattern,
                    "affected_calls": g.affected_calls,
                    "recommendation": g.recommendation,
                })
            supabase.table("capability_gaps").insert(gap_rows).execute()
        
        # 5. Mark these calls as analyzed so we don't process them again next time
        unprocessed_ids = [r["call_id"] for r in overalls if not r.get("is_fully_analyzed", False)]
        if unprocessed_ids:
            logger.info(f"Marking {len(unprocessed_ids)} calls as fully analyzed.")
            supabase.table("call_overall_scores")\
                .update({"is_fully_analyzed": True})\
                .in_("call_id", unprocessed_ids)\
                .execute()

    logger.info(f"Batch aggregation complete: {batch_id}. Wrote {len(gap_result.gaps)} gaps.")
    
    return {
        "batch_id": batch_id,
        "stats": batch_row["stats"],
        "gaps": [g.dict() for g in gap_result.gaps]
    }

def _main():
    import asyncio
    import json
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    res = asyncio.run(run_all_time_aggregation(write=not args.dry_run))
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    _main()
