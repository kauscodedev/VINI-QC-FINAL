import sqlite3
import json
import logging
from .supabase_client import supabase
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def safe_json(val: str) -> dict:
    if not val:
        return {}
    if not val.strip().startswith("{") and not val.strip().startswith("["):
        return {"raw": val}
    try:
        return json.loads(val)
    except:
        return {"raw": val}

def ms_to_timestamp(ms: int) -> str:
    if not ms:
        return None
    return datetime.utcfromtimestamp(ms / 1000.0).isoformat() + "Z"

def migrate():
    if not supabase:
        logging.error("Supabase client not initialized. Check your environment variables.")
        return

    BATCH_SIZE = 100
    conn = sqlite3.connect("calls.db")
    conn.row_factory = sqlite3.Row
    
    # 1. calls
    logging.info("Migrating calls...")
    calls = conn.execute("SELECT * FROM calls").fetchall()
    calls_data = []
    for row in calls:
        c = dict(row)
        calls_data.append({
            "call_id": c["call_id"],
            "enterprise_id": c["enterprise_id"],
            "team_id": c["team_id"],
            "agent_name": c["agent_name"],
            "agent_type": c["agent_type"],
            "call_type_raw": c["call_type"],
            "ended_reason": c["ended_reason"],
            "call_start_time": ms_to_timestamp(c["call_start_time_ms"]),
            "call_end_time": ms_to_timestamp(c["call_end_time_ms"]),
            "duration_ms": c.get("duration") if "duration" in c.keys() else None,
            "total_messages": c["total_messages"],
            "source_file": c["source_file"]
        })
    for i in range(0, len(calls_data), BATCH_SIZE):
        supabase.table("calls").upsert(calls_data[i:i+BATCH_SIZE], on_conflict="call_id").execute()

    # 2. call_contexts
    logging.info("Migrating call_contexts...")
    contexts = conn.execute("SELECT * FROM call_context").fetchall()
    contexts_data = []
    for row in contexts:
        c = dict(row)
        trade_in = None
        if c.get("trade_in_vehicle") or c.get("trade_in_estimated_value"):
            trade_in = {
                "vehicle": c.get("trade_in_vehicle"),
                "estimated_value": c.get("trade_in_estimated_value")
            }
        
        iv = None
        if c.get("interested_vehicle_make") or c.get("interested_vehicle_model"):
            iv = {
                "make": c.get("interested_vehicle_make"),
                "model": c.get("interested_vehicle_model"),
                "year": c.get("interested_vehicle_year"),
                "vin": c.get("interested_vehicle_vin"),
                "stock": c.get("interested_vehicle_stock"),
                "trim": c.get("interested_vehicle_trim"),
                "is_sold": c.get("interested_vehicle_is_sold")
            }

        contexts_data.append({
            "call_id": c["call_id"],
            "dealership_name": c["dealership_name"],
            "dealership_address": c["dealership_address"],
            "dealership_inventory_type": c["dealership_inventory_type"],
            "dealership_sales_hours": safe_json(c["dealership_sales_hours"]) if c["dealership_sales_hours"] else None,
            "dealership_service_hours": safe_json(c["dealership_service_hours"]) if c["dealership_service_hours"] else None,
            "customer_name": c["customer_name"],
            "customer_phone": c["customer_phone"],
            "customer_email": c["customer_email"],
            "customer_city": c["customer_city"],
            "customer_state": c["customer_state"],
            "interested_vehicle": iv,
            "trade_in": trade_in,
            "context_datetime": None,
            "raw_system_prompt": c["system_prompt_raw"]
        })
    for i in range(0, len(contexts_data), BATCH_SIZE):
        supabase.table("call_contexts").upsert(contexts_data[i:i+BATCH_SIZE], on_conflict="call_id").execute()

    # 3. messages
    logging.info("Migrating messages...")
    messages = conn.execute("SELECT * FROM messages").fetchall()
    msg_id_map = {}
    msgs_data = []
    for row in messages:
        m = dict(row)
        msg_id_map[m["id"]] = m["sequence_num"]
        msgs_data.append({
            "call_id": m["call_id"],
            "turn": m["sequence_num"],
            "role": m["role"],
            "message": m["message"],
            "time_ms": int(m["time_ms"]) if m["time_ms"] is not None else None,
            "end_time_ms": int(m["end_time_ms"]) if m["end_time_ms"] is not None else None,
            "duration_ms": int(m["duration_ms"]) if m["duration_ms"] is not None else None,
            "seconds_from_start": m["seconds_from_start"]
        })
    for i in range(0, len(msgs_data), BATCH_SIZE):
        supabase.table("messages").upsert(msgs_data[i:i+BATCH_SIZE], on_conflict="call_id, turn").execute()

    # 4. tool_events
    logging.info("Migrating tool_events...")
    tool_calls = conn.execute("SELECT * FROM tool_calls").fetchall()
    tool_results = conn.execute("SELECT * FROM tool_results").fetchall()
    
    tr_map = {tr["tool_call_id"]: tr for tr in tool_results}
    
    events_data = []
    for row in tool_calls:
        tc = dict(row)
        tr = tr_map.get(tc["tool_call_id"])
        turn = msg_id_map.get(tc["message_id"])
        
        args = safe_json(tc["arguments_json"]) if tc["arguments_json"] else {}
        result = None
        result_time = None
        
        if tr:
            result = safe_json(tr["result_json"]) if tr["result_json"] else {"raw_result": tr["result_json"]}
            result_time = tr["time_ms"]
            
        events_data.append({
            "call_id": tc["call_id"],
            "turn": turn,
            "tool_call_id": tc["tool_call_id"],
            "tool_name": tc["tool_name"],
            "args": args,
            "result": result,
            "invoked_time_ms": tc["time_ms"],
            "result_time_ms": result_time
        })
    for i in range(0, len(events_data), BATCH_SIZE):
        supabase.table("tool_events").upsert(events_data[i:i+BATCH_SIZE], on_conflict="call_id, tool_call_id").execute()

    logging.info("Migration complete.")

if __name__ == "__main__":
    migrate()
