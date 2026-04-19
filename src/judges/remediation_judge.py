"""Remediation Judge — diagnoses root causes for identified capability gaps."""
import logging
from typing import List, Dict, Any

from ._base import load_prompt, async_client, DEFAULT_MODEL
from ..remediation_schemas import GapRemediationResult

logger = logging.getLogger(__name__)

async def analyze_remediation(
    gap_id: int,
    gap_description: str,
    issues: List[Dict[str, Any]],
    system_prompt: str,
    model: str = DEFAULT_MODEL
) -> GapRemediationResult:
    """Analyze a gap and its associated issues to propose remediations.
    
    Args:
        gap_id: The ID of the gap from capability_gaps table.
        gap_description: Description of the pattern.
        issues: Sample of issues falling under this gap.
        system_prompt: The actual system prompt used by the agent.
        model: OpenAI model.
    """
    client = async_client()
    system_instruction = load_prompt("judge_remediation")
    
    user_content = f"""
Analyze the following Capability Gap for root causes and remediation.

### CAPABILITY GAP
{gap_description}

### SAMPLE ISSUES/EVIDENCE
{issues[:10]}

### CURRENT AGENT SYSTEM PROMPT
{system_prompt}
"""
    
    completion = await client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content},
        ],
        response_format=GapRemediationResult,
        temperature=0.0,
    )
    
    result = completion.choices[0].message.parsed
    # Ensure gap_id is preserved if LLM didn't return it correctly (though structured output should)
    result.gap_id = gap_id
    
    logger.info(f"Generated {len(result.insights)} insights for gap {gap_id}.")
    return result
