"""Tool Accuracy Judge — per-invocation scoring + overall dimension score, flags missed tool calls."""
from typing import Optional

from ..schemas import ContextJSON, ToolAccuracyResult
from ..formatters import format_context_for_judge, drop_raw_prompt
from ._base import load_prompt, async_client, DEFAULT_MODEL, logger

SYSTEM_PROMPT = load_prompt("judge_tool_accuracy")


async def judge_tool_accuracy(
    ctx: ContextJSON,
    model: Optional[str] = None,
) -> ToolAccuracyResult:
    ctx = drop_raw_prompt(ctx)
    user_message = format_context_for_judge(ctx, include_full_tool_events=True)

    client = async_client()
    completion = await client.beta.chat.completions.parse(
        model=model or DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format=ToolAccuracyResult,
        temperature=0.0,
    )
    result = completion.choices[0].message.parsed
    logger.info(
        f"tool_accuracy: score={result.score} na={result.score_na} "
        f"tools={len(result.tool_scores)} issues={len(result.issues)}"
    )
    return result
