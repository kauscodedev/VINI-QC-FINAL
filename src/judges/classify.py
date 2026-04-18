"""
Call Classification Judge
-------------------------
Runtime judge that calls OpenAI to classify a call into one of six types.
Loads its system prompt from prompts/classify_call.md.
"""
import os
import json
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
    with open(PROMPT_PATH, "r") as f:
        return f.read()


def classify_call(transcript_text: str, model: Optional[str] = None) -> ClassificationResult:
    """
    Classify a call transcript into one of six call types.
    
    Args:
        transcript_text: The formatted transcript string (from format_transcript).
        model: Override the default model if desired.
        
    Returns:
        ClassificationResult with call_type, primary_intent, and reasoning.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    system_prompt = _load_system_prompt()
    use_model = model or MODEL

    response = client.chat.completions.create(
        model=use_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Classify this call transcript:\n\n{transcript_text}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.0,
        max_tokens=500
    )

    raw = response.choices[0].message.content
    parsed = json.loads(raw)
    
    result = ClassificationResult(
        call_type=parsed["call_type"],
        primary_intent=parsed["primary_intent"],
        reasoning=parsed["reasoning"]
    )
    
    logger.info(f"Classification: {result.call_type} | Intent: {result.primary_intent}")
    return result
