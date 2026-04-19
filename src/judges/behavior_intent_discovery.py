"""Behavioral Judge — Intent & Needs Discovery (SDR discovery sequencing)."""
from typing import Optional

from ..schemas import ContextJSON, DimensionScore
from ..formatters import format_context_for_judge, drop_raw_prompt
from ._base import load_prompt, async_client, DEFAULT_MODEL, logger

SYSTEM_PROMPT = load_prompt("behavior_intent_discovery")


async def judge_behavior_intent_discovery(
    ctx: ContextJSON,
    model: Optional[str] = None,
) -> DimensionScore:
    ctx = drop_raw_prompt(ctx)
    user_message = format_context_for_judge(ctx, include_full_tool_events=False)

    client = async_client()
    completion = await client.beta.chat.completions.parse(
        model=model or DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format=DimensionScore,
        temperature=0.0,
    )
    result = completion.choices[0].message.parsed
    logger.info(f"behavior_intent_discovery: score={result.score} na={result.score_na} issues={len(result.issues)}")
    return result
