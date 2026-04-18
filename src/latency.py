import statistics
from .schemas import ContextJSON, LatencyMetrics, HighLatencyTurn, ExcessDeadAirTurn

def compute_latency(context: ContextJSON) -> ContextJSON:
    bot_latencies = []
    dead_airs = []
    high_latency = []
    excess_dead_air = []
    
    transcript = sorted(context.get("transcript", []), key=lambda x: x["turn"])
    
    has_missing_timestamps = any(
        (t["time_ms"] is None or t["end_time_ms"] is None) 
        for t in transcript if t["role"] in {"bot", "user"}
    )
    
    if has_missing_timestamps or not transcript:
        context["latency_metrics"] = {"format": "legacy", "agent_latencies_ms": [], "dead_air_gaps_ms": [], "high_latency_turns": [], "excessive_dead_air_turns": []}
        return context

    last_user_end = None
    last_bot_end = None

    for t in transcript:
        role = t["role"]
        time_ms = t["time_ms"]
        end_time_ms = t["end_time_ms"]
        
        if role == "bot":
            if last_user_end is not None:
                latency = time_ms - last_user_end
                if latency > 0:
                    bot_latencies.append(latency)
                    if latency > 6000:
                        high_latency.append(HighLatencyTurn(turn=t["turn"], latency_ms=latency))
            last_bot_end = end_time_ms

        elif role == "user":
            if last_bot_end is not None:
                dead_air = time_ms - last_bot_end
                if dead_air > 0:
                    dead_airs.append(dead_air)
                    if dead_air > 12000:
                        excess_dead_air.append(ExcessDeadAirTurn(turn=t["turn"], dead_air_ms=dead_air))
            last_user_end = end_time_ms

    metrics = LatencyMetrics(
        agent_latencies_ms=bot_latencies,
        dead_air_gaps_ms=dead_airs,
        median_agent_latency_ms=statistics.median(bot_latencies) if bot_latencies else None,
        max_agent_latency_ms=max(bot_latencies) if bot_latencies else None,
        high_latency_turns=high_latency,
        excessive_dead_air_turns=excess_dead_air
    )
    
    context["latency_metrics"] = metrics
    return context
