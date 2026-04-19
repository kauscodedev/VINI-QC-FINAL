from typing import Literal, Any, Optional, Union, Dict, List
from typing_extensions import TypedDict
from pydantic import BaseModel, Field

class CallMetadata(TypedDict):
    agent_name: Optional[str]
    agent_type: Optional[str]
    call_type: Optional[str]
    ended_reason: Optional[str]
    duration_ms: Optional[int]
    message_count: int

class VehicleTarget(TypedDict):
    make: Optional[str]
    model: Optional[str]
    year: Optional[str]
    vin: Optional[str]
    stock: Optional[str]
    trim: Optional[str]
    is_sold: Optional[bool]

class CustomerInfo(TypedDict):
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    city: Optional[str]
    state: Optional[str]
    interested_vehicle: Optional[VehicleTarget]
    trade_in: Optional[Dict[str, Any]]

class DealershipInfo(TypedDict):
    name: Optional[str]
    address: Optional[str]
    sales_hours: Union[Dict[str, Any], str, None]
    service_hours: Union[Dict[str, Any], str, None]
    inventory_type: Optional[str]
    available_transfer_departments: Optional[Any]  # extracted from XML; needed by escalation + tool_accuracy judges

class SystemContext(TypedDict):
    dealership: Optional[DealershipInfo]
    customer: Optional[CustomerInfo]
    context_datetime: Optional[str]
    raw_system_prompt: Optional[str]

class TranscriptTurn(TypedDict):
    turn: int
    role: str
    text: Optional[str]
    time_ms: Optional[int]
    end_time_ms: Optional[int]

class ToolEvent(TypedDict):
    turn: int
    tool_call_id: str
    tool: str
    args: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    invoked_time_ms: Optional[int]
    result_time_ms: Optional[int]

class HighLatencyTurn(TypedDict):
    turn: int
    latency_ms: int

class ExcessDeadAirTurn(TypedDict):
    turn: int
    dead_air_ms: int

class LatencyMetrics(TypedDict, total=False):
    agent_latencies_ms: List[int]
    dead_air_gaps_ms: List[int]
    median_agent_latency_ms: Union[int, float, None]
    max_agent_latency_ms: Optional[int]
    high_latency_turns: List[HighLatencyTurn]
    excessive_dead_air_turns: List[ExcessDeadAirTurn]
    format: str

class ContextJSON(TypedDict):
    call_id: str
    call_metadata: CallMetadata
    system_context: SystemContext
    transcript: List[TranscriptTurn]
    tool_events: List[ToolEvent]
    latency_metrics: Union[LatencyMetrics, Dict[str, Any]]
    call_type: Optional[str]

class ClassificationResult(BaseModel):
    call_type: Literal[
        "legitimate_sales", 
        "routing_or_transfer", 
        "sales_agent_conversion_attempt", 
        "out_of_scope_topic", 
        "complaint_call", 
        "non_dealer"
    ]
    primary_intent: str
    reasoning: str

class Issue(BaseModel):
    issue_type: str
    severity: Literal["warning", "critical"]
    turn_number: Optional[int]
    evidence: str = Field(description="Short quote or description of what triggered this issue")

class DimensionScore(BaseModel):
    score: Optional[Literal[1, 2, 3]] = Field(description="1, 2, or 3. None if N/A")
    score_na: bool = Field(description="Set to true if dimension is N/A")
    reasoning: str
    issues: List[Issue] = Field(default_factory=list)

class ToolScore(BaseModel):
    tool_call_id: str
    tool_name: str
    score: Literal[1, 2, 3]
    reasoning: str

class ToolAccuracyResult(BaseModel):
    """Output of the Tool Accuracy judge: overall dimension score + per-invocation scores."""
    score: Optional[Literal[1, 2, 3]] = Field(description="1, 2, or 3. None if N/A")
    score_na: bool = Field(description="Set to true if dimension is N/A (no tools expected)")
    reasoning: str
    issues: List[Issue] = Field(default_factory=list)
    tool_scores: List[ToolScore] = Field(default_factory=list)
