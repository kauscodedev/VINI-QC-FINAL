"""Shared helpers for dimension judges."""
import os
import logging
from pathlib import Path

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"
DEFAULT_MODEL = "gpt-4o"


def load_prompt(name: str) -> str:
    """Load a prompt file by name (without .md extension)."""
    return (PROMPTS_DIR / f"{name}.md").read_text()


def async_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
