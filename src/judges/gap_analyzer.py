"""Capability Gap Analysis judge — synthesizes recurring issues into patterns."""
import logging
from typing import List, Dict, Any

from ._base import load_prompt, async_client, DEFAULT_MODEL
from ..schemas import GapAnalysisResult

logger = logging.getLogger(__name__)

async def analyze_gaps(issues: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> GapAnalysisResult:
    """Analyze a list of issues to find recurring capability gaps.
    
    Args:
        issues: List of dicts, each with call_id, dimension, issue_type, severity, evidence.
        model: OpenAI model to use.
        
    Returns:
        GapAnalysisResult containing a list of identified CapabilityGaps.
    """
    if not issues:
        logger.info("No issues provided for gap analysis.")
        return GapAnalysisResult(gaps=[])

    client = async_client()
    system_prompt = load_prompt("judge_gap_analysis")
    
    # Prepare the payload. Truncate evidence if too long to save tokens.
    # We pass a raw JSON string of the issues.
    user_content = f"Analyze these detected issues for recurring patterns:\n\n{issues}"
    
    completion = await client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=GapAnalysisResult,
        temperature=0.0,
    )
    
    result = completion.choices[0].message.parsed
    logger.info(f"Identified {len(result.gaps)} capability gaps across {len(issues)} issues.")
    return result
