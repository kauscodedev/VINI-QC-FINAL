from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field

class RemediationInsight(BaseModel):
    root_cause_type: Literal["prompt", "config", "setup", "model"]
    analysis: str = Field(description="Detailed reasoning behind the root cause diagnosis")
    proposed_remediation: str = Field(description="Specific, actionable fix (e.g. prompt snippet or config suggestion)")
    confidence_score: float = Field(ge=0.0, le=1.0)

class GapRemediationResult(BaseModel):
    gap_id: int
    insights: List[RemediationInsight]
