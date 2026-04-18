import copy
import json
from typing import Optional
from .schemas import ContextJSON

def format_transcript(ctx: ContextJSON, include_tools: bool = True) -> str:
    """
    Format the transcript into a readable string for LLM judges.
    Skips system prompts (the huge XML configurations) and formats 
    Bot and User messages sequentially. Optionally injects Tool usage logs linearly.
    """
    timeline = []
    
    for m in ctx.get("transcript", []):
        if m.get("role") == "system":
            continue
        timeline.append({"turn": m.get("turn", 0), "type": "chat", "data": m})
        
    if include_tools:
        for ev in ctx.get("tool_events", []):
            timeline.append({"turn": ev.get("turn", 0), "type": "tool", "data": ev})
            
    timeline.sort(key=lambda x: x["turn"])
    
    lines = []
    for item in timeline:
        if item["type"] == "chat":
            m = item["data"]
            role = m.get("role", "").capitalize()
            turn = m.get("turn", 0)
            text = m.get("text", "").strip()
            if text:
                lines.append(f"[{role} (Turn {turn})] {text}")
        elif item["type"] == "tool":
            ev = item["data"]
            turn = ev.get("turn", 0)
            tool_name = ev.get("tool", "unknown_tool")
            args = ev.get("args", {})
            result = str(ev.get("result", {}))
            if len(result) > 250:
                result = result[:247] + "..."
            lines.append(f"  [System Log (Turn {turn}): Bot executed '{tool_name}' with '{args}' -> Result: {result}]")
                
    return "\n\n".join(lines)


def format_context_for_judge(
    ctx: ContextJSON,
    include_full_tool_events: bool = False,
    call_type: Optional[str] = None,
) -> str:
    """Build the complete user-message payload passed to each LLM judge.

    Args:
        ctx: ContextJSON (raw_system_prompt should already be stripped via drop_raw_prompt).
        include_full_tool_events: Pass True for judges that need full args+results JSON
            (info_accuracy, tool_accuracy). Other judges only see the inline transcript log.
        call_type: Classified call type string (e.g. 'legitimate_sales'). Injected for
            judges that branch their rubric on call type (conversion, escalation, tool_accuracy).
    """
    sections: list[str] = []

    sc = ctx.get("system_context", {})
    dealer = sc.get("dealership") or {}
    customer = sc.get("customer") or {}
    meta = {
        "dealership_name": dealer.get("name"),
        "dealership_sales_hours": dealer.get("sales_hours"),
        "dealership_service_hours": dealer.get("service_hours"),
        "dealership_inventory_type": dealer.get("inventory_type"),
        "available_transfer_departments": dealer.get("available_transfer_departments"),
        "customer_name": customer.get("name"),
        "customer_phone": customer.get("phone"),
        "customer_interested_vehicle": customer.get("interested_vehicle"),
        "context_datetime": sc.get("context_datetime"),
        "call_type": call_type or ctx.get("call_type"),
    }
    sections.append("## System Context\n```json\n" + json.dumps(meta, indent=2) + "\n```")

    sections.append("## Transcript\n" + format_transcript(ctx, include_tools=True))

    if include_full_tool_events:
        events = ctx.get("tool_events", [])
        sections.append("## Full Tool Events\n```json\n" + json.dumps(events, indent=2) + "\n```")

    return "\n\n".join(sections)


def drop_raw_prompt(ctx: ContextJSON) -> ContextJSON:
    """Return a shallow copy of ctx with raw_system_prompt removed.
    Call this before passing context to any judge — raw XML is ~5-10K tokens and no judge needs it.
    AvailableTransferDepartments is already extracted onto dealership.available_transfer_departments.
    """
    ctx = copy.copy(ctx)
    if ctx.get("system_context"):
        sc = copy.copy(ctx["system_context"])
        sc["raw_system_prompt"] = None
        ctx["system_context"] = sc
    return ctx
