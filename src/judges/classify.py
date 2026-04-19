"""Call Classification Judge — classifies a call into one of six types."""
import os
import logging
from pathlib import Path
from typing import Optional

from openai import OpenAI
from dotenv import load_dotenv

from ..schemas import ClassificationResult

load_dotenv()
logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "classify_call.md"
MODEL = "gpt-4o-mini"


def _load_system_prompt() -> str:
    return PROMPT_PATH.read_text()


def classify_call(transcript_text: str, model: Optional[str] = None) -> ClassificationResult:
    """Classify a call transcript into one of six call types.

    Uses OpenAI structured outputs (`parse()`) with ClassificationResult as the response schema.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    completion = client.beta.chat.completions.parse(
        model=model or MODEL,
        messages=[
            {"role": "system", "content": _load_system_prompt()},
            {"role": "user", "content": f"Classify this call transcript:\n\n{transcript_text}"},
        ],
        response_format=ClassificationResult,
        temperature=0.0,
    )
    result = completion.choices[0].message.parsed
    logger.info(f"Classification: {result.call_type} | Intent: {result.primary_intent}")
    return result
