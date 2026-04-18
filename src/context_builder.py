import json
from typing import Any, Union, Dict, Optional
from xml.etree import ElementTree as ET

from .schemas import ContextJSON, CallMetadata, SystemContext, TranscriptTurn, ToolEvent, DealershipInfo, CustomerInfo, VehicleTarget
from .data_source import DataSource

def _parse_xml_element(elem: ET.Element) -> Union[Dict[str, Any], str]:
    if len(elem) == 0:
        return elem.text.strip() if elem.text else ""
    result = {}
    for child in elem:
        result[child.tag] = _parse_xml_element(child)
    return result

def _parse_system_prompt_xml(raw_xml: Optional[str]) -> Dict[str, Any]:
    if not raw_xml: return {}
    wrapped_xml = f"<root>\n{raw_xml}\n</root>"
    try:
        root = ET.fromstring(wrapped_xml)
        return _parse_xml_element(root)
    except ET.ParseError:
        return {}

def build_context(call_id: str, source: DataSource) -> ContextJSON:
    raw_data = source.get_call(call_id)
    call_info = raw_data.get("call", {}) or {}
    context_info = raw_data.get("context", {}) or {}
    messages = raw_data.get("messages", [])
    tool_calls = raw_data.get("tool_calls", [])
    tool_results = raw_data.get("tool_results", [])
    
    raw_prompt = context_info.get("raw_system_prompt")
    xml_data = _parse_system_prompt_xml(raw_prompt)
    
    d_info = xml_data.get("dealership")
    if isinstance(d_info, dict):
        dealer = DealershipInfo(
            name=d_info.get("name"), address=d_info.get("address"),
            sales_hours=d_info.get("sales_hours"), service_hours=d_info.get("service_hours"),
            inventory_type=d_info.get("inventory_type")
        )
    else:
        dealer = DealershipInfo(
            name=context_info.get("dealership_name"), address=context_info.get("dealership_address"),
            sales_hours=context_info.get("dealership_sales_hours"), service_hours=context_info.get("dealership_service_hours"),
            inventory_type=context_info.get("dealership_inventory_type")
        )
        if isinstance(dealer["sales_hours"], str):
             try: dealer["sales_hours"] = json.loads(dealer["sales_hours"])
             except: pass
        if isinstance(dealer["service_hours"], str):
             try: dealer["service_hours"] = json.loads(dealer["service_hours"])
             except: pass
             
    c_info = xml_data.get("customer")
    if isinstance(c_info, dict):
        cust = CustomerInfo(
            name=c_info.get("name"), phone=c_info.get("phone"), email=c_info.get("email"),
            city=c_info.get("city"), state=c_info.get("state"),
            interested_vehicle=c_info.get("interested_vehicle"), trade_in=c_info.get("trade_in")
        )
    else:
        cust = CustomerInfo(
            name=context_info.get("customer_name"), phone=context_info.get("customer_phone"), email=context_info.get("customer_email"),
            city=context_info.get("customer_city"), state=context_info.get("customer_state"),
            interested_vehicle=json.loads(context_info.get("interested_vehicle", "{}")) if context_info.get("interested_vehicle") else None,
            trade_in=json.loads(context_info.get("trade_in", "{}")) if context_info.get("trade_in") else None
        )

    system_context = SystemContext(
        dealership=dealer, customer=cust,
        context_datetime=context_info.get("context_datetime"),
        raw_system_prompt=raw_prompt
    )

    transcript: list[TranscriptTurn] = []
    msg_id_to_turn = {}
    for m in messages:
        turn_id = m.get("turn", m.get("sequence_num", 0))
        role = m.get("role", "system")
        msg_id_to_turn[m.get("id")] = turn_id
        if role in {"system", "bot", "user"}:
            transcript.append(TranscriptTurn(
                turn=turn_id, role=role, text=m.get("message"),
                time_ms=m.get("time_ms"), end_time_ms=m.get("end_time_ms")
            ))

    if "tool_events" in raw_data:
        events = []
        for te in raw_data["tool_events"]:
            events.append(ToolEvent(
                turn=te.get("turn", 0) or 0,
                tool_call_id=te.get("tool_call_id"),
                tool=te.get("tool_name", "unknown"),
                args=te.get("args", {}),
                result=te.get("result"),
                invoked_time_ms=te.get("invoked_time_ms"),
                result_time_ms=te.get("result_time_ms")
            ))
    else:
        tool_results_map = {tr["tool_call_id"]: tr for tr in tool_results}
        events: list[ToolEvent] = []
        for tc in tool_calls:
            tc_id = tc["tool_call_id"]
            turn = msg_id_to_turn.get(tc.get("message_id"), 0)
            
            args = tc.get("arguments_json", "{}")
            if isinstance(args, str):
                try: args = json.loads(args)
                except: args = {}
                
            tr = tool_results_map.get(tc_id, {})
            res = tr.get("result_json")
            if isinstance(res, str):
                try: res = json.loads(res)
                except: res = {"raw_result": res}
                
            events.append(ToolEvent(
                turn=turn, tool_call_id=tc_id, tool=tc.get("tool_name", "unknown"),
                args=args, result=res if tr else None,
                invoked_time_ms=tc.get("invoked_time_ms", tc.get("time_ms")),
                result_time_ms=tr.get("result_time_ms", tr.get("time_ms"))
            ))

    metadata = CallMetadata(
        agent_name=call_info.get("agent_name"), agent_type=call_info.get("agent_type"),
        call_type=call_info.get("call_type_raw", "inboundPhoneCall"), ended_reason=call_info.get("ended_reason"),
        duration_ms=call_info.get("duration_ms"), message_count=call_info.get("total_messages") or len(messages)
    )

    return ContextJSON(
        call_id=call_id, call_metadata=metadata, system_context=system_context,
        transcript=transcript, tool_events=events,
        latency_metrics={}, call_type=None
    )

if __name__ == "__main__":
    import argparse
    from .data_source import SQLiteDataSource
    from .latency import compute_latency

    parser = argparse.ArgumentParser()
    parser.add_argument("--call-id", required=True)
    parser.add_argument("--source", default="sqlite")
    parser.add_argument("--out")
    args = parser.parse_args()

    if args.source == "sqlite":
        source = SQLiteDataSource("calls.db")
    elif args.source == "supabase":
        from .data_source import SupabaseDataSource
        source = SupabaseDataSource()
    else:
        raise ValueError(f"Unknown source {args.source}")
    
    ctx = build_context(args.call_id, source)
    ctx = compute_latency(ctx)
    
    if args.out:
        with open(args.out, "w") as f:
            json.dump(ctx, f, indent=2)
    else:
        print(json.dumps(ctx, indent=2))
