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
            text = m.get("text", "").strip()
            if text:
                lines.append(f"[{role}] {text}")
        elif item["type"] == "tool":
            ev = item["data"]
            tool_name = ev.get("tool", "unknown_tool")
            args = ev.get("args", {})
            result = str(ev.get("result", {}))
            if len(result) > 250:
                result = result[:247] + "..."
            lines.append(f"  [System Log: Bot executed '{tool_name}' with '{args}' -> Result: {result}]")
                
    return "\n\n".join(lines)
