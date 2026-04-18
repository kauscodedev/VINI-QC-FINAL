import json
import re
from typing import Any, Union, Dict, Optional
from xml.etree import ElementTree as ET

from .schemas import ContextJSON, CallMetadata, SystemContext, TranscriptTurn, ToolEvent, DealershipInfo, CustomerInfo, VehicleTarget
from .data_source import DataSource

def _xml_elem_to_dict(elem: ET.Element) -> Union[Dict[str, Any], str]:
    if len(elem) == 0:
        return elem.text.strip() if elem.text else ""
    result = {}
    for child in elem:
        result[child.tag] = _xml_elem_to_dict(child)
    return result

def _extract_context_data(raw_xml: Optional[str]) -> Dict[str, Any]:
    """Extract and parse only the <ContextData> block from the system prompt.
    The surrounding XML contains unescaped prose characters that break full-doc parsing.
    """
    if not raw_xml:
        return {}
    m = re.search(r"<ContextData>.*?</ContextData>", raw_xml, re.DOTALL)
    if not m:
        return {}
    try:
        root = ET.fromstring(m.group())
        return _xml_elem_to_dict(root)
    except ET.ParseError:
        return {}

def _v(d: Any, key: str, fallback: Any = None) -> Any:
    """Get key from dict, returning fallback if missing or empty string."""
    if not isinstance(d, dict):
        return fallback
    val = d.get(key)
    return val if val else fallback

def build_context(call_id: str, source: DataSource) -> ContextJSON:
    raw_data = source.get_call(call_id)
    call_info = raw_data.get("call", {}) or {}
    context_info = raw_data.get("context", {}) or {}
    messages = raw_data.get("messages", [])
    tool_calls = raw_data.get("tool_calls", [])
    tool_results = raw_data.get("tool_results", [])

    # Support both SQLite column name (system_prompt_raw) and Supabase column name (raw_system_prompt)
    raw_prompt = context_info.get("raw_system_prompt") or context_info.get("system_prompt_raw")
    ctx_xml = _extract_context_data(raw_prompt)  # direct ContextData dict, no SystemPrompt wrapper
    d_xml = _v(ctx_xml, "Dealership", {})
    c_xml = _v(ctx_xml, "Customer", {})
    ah_xml = _v(d_xml, "AvailabilityHours", {})
    iv_xml = _v(c_xml, "InterestedVehicle", {})
    ti_xml = _v(c_xml, "TradeIn", {})
    dt_xml = _v(ctx_xml, "CurrentDateTime", {})

    dealer = DealershipInfo(
        name=_v(d_xml, "Name") or context_info.get("dealership_name") or None,
        address=_v(d_xml, "Address") or context_info.get("dealership_address") or None,
        sales_hours=_v(ah_xml, "Sales") or context_info.get("dealership_sales_hours") or None,
        service_hours=_v(ah_xml, "Service") or context_info.get("dealership_service_hours") or None,
        inventory_type=_v(d_xml, "InventoryType") or context_info.get("dealership_inventory_type") or None,
        available_transfer_departments=_v(d_xml, "AvailableTransferDepartments") or None,
    )

    phone = (
        _v(c_xml, "CurrentPhoneNumber")
        or _v(c_xml, "CustomerPhoneNumber")
        or context_info.get("customer_current_phone")
        or context_info.get("customer_phone")
    )

    interested_vehicle: Optional[VehicleTarget] = None
    if iv_xml:
        interested_vehicle = VehicleTarget(
            make=_v(iv_xml, "Make"),
            model=_v(iv_xml, "Model"),
            year=_v(iv_xml, "Year"),
            vin=_v(iv_xml, "VIN"),
            stock=_v(iv_xml, "Stock"),
            trim=_v(iv_xml, "Trim"),
            is_sold=_v(iv_xml, "IsSold"),
        )
    elif context_info.get("interested_vehicle"):
        try:
            interested_vehicle = json.loads(context_info["interested_vehicle"])
        except Exception:
            pass

    trade_in = None
    if ti_xml:
        trade_in = dict(ti_xml)
    elif context_info.get("trade_in_vehicle"):
        trade_in = {"vehicle": context_info.get("trade_in_vehicle"), "estimated_value": context_info.get("trade_in_estimated_value")}

    cust = CustomerInfo(
        name=_v(c_xml, "Name") or context_info.get("customer_name") or None,
        phone=phone,
        email=_v(c_xml, "Email") or context_info.get("customer_email") or None,
        city=_v(c_xml, "City") or context_info.get("customer_city") or None,
        state=_v(c_xml, "State") or context_info.get("customer_state") or None,
        interested_vehicle=interested_vehicle,
        trade_in=trade_in,
    )

    context_datetime = (
        _v(dt_xml, "CurrentDateTime")
        or context_info.get("context_datetime")
    )

    system_context = SystemContext(
        dealership=dealer, customer=cust,
        context_datetime=context_datetime,
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
