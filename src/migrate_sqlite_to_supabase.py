import sqlite3
import json
import logging
from .supabase_client import supabase
from .context_builder import build_context
from .data_source import SQLiteDataSource
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
            "source_file": c["source_file"],
            "recording_url": c.get("recording_url"),
            "external_created_at": c.get("external_created_at")
        })
    for i in range(0, len(calls_data), BATCH_SIZE):
        supabase.table("calls").upsert(calls_data[i:i+BATCH_SIZE], on_conflict="call_id").execute()

    # 2. call_contexts — SQLite columns are all empty; parse from raw XML via build_context
    logging.info("Migrating call_contexts...")
    sqlite_source = SQLiteDataSource("calls.db")
    call_ids = [dict(row)["call_id"] for row in conn.execute("SELECT call_id FROM call_context").fetchall()]
    contexts_data = []
    for call_id in call_ids:
        try:
            ctx = build_context(call_id, sqlite_source)
            sc = ctx["system_context"]
            dealer = sc.get("dealership") or {}
            customer = sc.get("customer") or {}
            contexts_data.append({
                "call_id": call_id,
                "dealership_name": dealer.get("name"),
                "dealership_address": dealer.get("address"),
                "dealership_inventory_type": dealer.get("inventory_type"),
                "dealership_sales_hours": dealer.get("sales_hours"),
                "dealership_service_hours": dealer.get("service_hours"),
                "customer_name": customer.get("name"),
                "customer_phone": customer.get("phone"),
                "customer_email": customer.get("email"),
                "customer_city": customer.get("city"),
                "customer_state": customer.get("state"),
                "interested_vehicle": customer.get("interested_vehicle"),
                "trade_in": customer.get("trade_in"),
                "context_datetime": sc.get("context_datetime") or None,
                "raw_system_prompt": sc.get("raw_system_prompt"),
            })
        except Exception as e:
            logging.error(f"Failed to build context for {call_id}: {e}")
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
