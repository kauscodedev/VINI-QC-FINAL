#!/usr/bin/env python3
import argparse
import json
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

DATA_DIR = Path(__file__).parent

DDL = """
CREATE TABLE IF NOT EXISTS calls (
    call_id             TEXT PRIMARY KEY,
    enterprise_id       TEXT,
    team_id             TEXT,
    agent_name          TEXT,
    agent_type          TEXT,
    call_type           TEXT,
    ended_reason        TEXT,
    call_start_time_ms  INTEGER,
    call_end_time_ms    INTEGER,
    total_messages      INTEGER,
    source_file         TEXT
);

CREATE TABLE IF NOT EXISTS call_context (
    call_id                     TEXT PRIMARY KEY,
    system_prompt_raw           TEXT,
    dealership_name             TEXT,
    dealership_address          TEXT,
    dealership_inventory_type   TEXT,
    dealership_sales_hours      TEXT,
    dealership_service_hours    TEXT,
    customer_name               TEXT,
    customer_current_phone      TEXT,
    customer_phone              TEXT,
    customer_email              TEXT,
    customer_city               TEXT,
    customer_state              TEXT,
    customer_postal_code        TEXT,
    customer_activity_summary   TEXT,
    interested_vehicle_make     TEXT,
    interested_vehicle_model    TEXT,
    interested_vehicle_year     TEXT,
    interested_vehicle_stock    TEXT,
    interested_vehicle_vin      TEXT,
    interested_vehicle_trim     TEXT,
    interested_vehicle_is_sold  TEXT,
    trade_in_vehicle            TEXT,
    trade_in_estimated_value    TEXT,
    context_datetime            TEXT,
    FOREIGN KEY (call_id) REFERENCES calls(call_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id             TEXT NOT NULL,
    sequence_num        INTEGER,
    role                TEXT,
    message             TEXT,
    time_ms             INTEGER,
    end_time_ms         INTEGER,
    seconds_from_start  REAL,
    duration_ms         INTEGER,
    FOREIGN KEY (call_id) REFERENCES calls(call_id)
);

CREATE TABLE IF NOT EXISTS tool_calls (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id             TEXT NOT NULL,
    message_id          INTEGER,
    tool_call_id        TEXT,
    tool_name           TEXT,
    arguments_json      TEXT,
    time_ms             INTEGER,
    seconds_from_start  REAL,
    FOREIGN KEY (call_id) REFERENCES calls(call_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS tool_results (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id             TEXT NOT NULL,
    tool_call_id        TEXT,
    tool_name           TEXT,
    result_json         TEXT,
    time_ms             INTEGER,
    seconds_from_start  REAL,
    FOREIGN KEY (call_id) REFERENCES calls(call_id)
);

CREATE TABLE IF NOT EXISTS word_confidence (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id         TEXT NOT NULL,
    message_id      INTEGER,
    word            TEXT,
    punctuated_word TEXT,
    confidence      REAL,
    start_time      REAL,
    end_time        REAL,
    language        TEXT,
    FOREIGN KEY (call_id) REFERENCES calls(call_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);
"""


def _xml_text(element, path, default=""):
    if element is None:
        return default
    node = element.find(path)
    if node is None or node.text is None:
        return default
    return node.text.strip()


def _parse_context(xml_str):
    """Extract ContextData fields from system prompt XML string."""
    ctx = {}
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        return ctx

    cd = root.find("ContextData")
    if cd is None:
        return ctx

    ctx["dealership_name"]            = _xml_text(cd, "Dealership/Name")
    ctx["dealership_address"]         = _xml_text(cd, "Dealership/Address")
    ctx["dealership_inventory_type"]  = _xml_text(cd, "Dealership/InventoryType")
    ctx["dealership_sales_hours"]     = _xml_text(cd, "Dealership/AvailabilityHours/Sales")
    ctx["dealership_service_hours"]   = _xml_text(cd, "Dealership/AvailabilityHours/Service")
    ctx["customer_name"]              = _xml_text(cd, "Customer/Name")
    ctx["customer_current_phone"]     = _xml_text(cd, "Customer/CurrentPhoneNumber")
    ctx["customer_phone"]             = _xml_text(cd, "Customer/CustomerPhoneNumber")
    ctx["customer_email"]             = _xml_text(cd, "Customer/Email")
    ctx["customer_city"]              = _xml_text(cd, "Customer/City")
    ctx["customer_state"]             = _xml_text(cd, "Customer/State")
    ctx["customer_postal_code"]       = _xml_text(cd, "Customer/PostalCode")
    ctx["customer_activity_summary"]  = _xml_text(cd, "Customer/ActivitySummary")
    ctx["interested_vehicle_make"]    = _xml_text(cd, "Customer/InterestedVehicle/Make")
    ctx["interested_vehicle_model"]   = _xml_text(cd, "Customer/InterestedVehicle/Model")
    ctx["interested_vehicle_year"]    = _xml_text(cd, "Customer/InterestedVehicle/Year")
    ctx["interested_vehicle_stock"]   = _xml_text(cd, "Customer/InterestedVehicle/Stock")
    ctx["interested_vehicle_vin"]     = _xml_text(cd, "Customer/InterestedVehicle/VIN")
    ctx["interested_vehicle_trim"]    = _xml_text(cd, "Customer/InterestedVehicle/Trim")
    ctx["interested_vehicle_is_sold"] = _xml_text(cd, "Customer/InterestedVehicle/IsSold")
    ctx["trade_in_vehicle"]           = _xml_text(cd, "Customer/TradeIn/Vehicle")
    ctx["trade_in_estimated_value"]   = _xml_text(cd, "Customer/TradeIn/EstimatedValue")
    ctx["context_datetime"]           = _xml_text(cd, "CurrentDateTime/CurrentDateTime")
    return ctx


def _process_file(conn, json_path, verbose):
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    call_id = data.get("callId", "")
    cd      = data.get("callDetails", {})
    ai      = cd.get("agentInfo", {})
    msgs    = cd.get("messagesWithToolCalls", [])

    times     = [m["time"]    for m in msgs if m.get("time")    is not None]
    end_times = [m["endTime"] for m in msgs if m.get("endTime") is not None]
    all_ts    = times + end_times
    start_ms  = min(all_ts) if all_ts else None
    end_ms    = max(all_ts) if all_ts else None

    conn.execute(
        """INSERT OR REPLACE INTO calls
           (call_id, enterprise_id, team_id, agent_name, agent_type, call_type, ended_reason,
            call_start_time_ms, call_end_time_ms, total_messages, source_file)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (call_id, data.get("enterpriseId", ""), data.get("teamId", ""),
         ai.get("agentName", ""), ai.get("agentType", ""),
         cd.get("callType", ""), cd.get("endedReason", ""),
         start_ms, end_ms, len(msgs), json_path.name),
    )

    system_prompt_raw = None
    ctx = {}
    for msg in msgs:
        if msg.get("role") == "system":
            system_prompt_raw = msg.get("message", "")
            ctx = _parse_context(system_prompt_raw)
            break

    conn.execute(
        """INSERT OR REPLACE INTO call_context
           (call_id, system_prompt_raw,
            dealership_name, dealership_address, dealership_inventory_type,
            dealership_sales_hours, dealership_service_hours,
            customer_name, customer_current_phone, customer_phone, customer_email,
            customer_city, customer_state, customer_postal_code, customer_activity_summary,
            interested_vehicle_make, interested_vehicle_model, interested_vehicle_year,
            interested_vehicle_stock, interested_vehicle_vin, interested_vehicle_trim,
            interested_vehicle_is_sold, trade_in_vehicle, trade_in_estimated_value,
            context_datetime)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (call_id, system_prompt_raw,
         ctx.get("dealership_name", ""),      ctx.get("dealership_address", ""),
         ctx.get("dealership_inventory_type",""), ctx.get("dealership_sales_hours", ""),
         ctx.get("dealership_service_hours", ""), ctx.get("customer_name", ""),
         ctx.get("customer_current_phone", ""),   ctx.get("customer_phone", ""),
         ctx.get("customer_email", ""),        ctx.get("customer_city", ""),
         ctx.get("customer_state", ""),        ctx.get("customer_postal_code", ""),
         ctx.get("customer_activity_summary",""),  ctx.get("interested_vehicle_make", ""),
         ctx.get("interested_vehicle_model", ""),  ctx.get("interested_vehicle_year", ""),
         ctx.get("interested_vehicle_stock", ""),  ctx.get("interested_vehicle_vin", ""),
         ctx.get("interested_vehicle_trim", ""),   ctx.get("interested_vehicle_is_sold", ""),
         ctx.get("trade_in_vehicle", ""),      ctx.get("trade_in_estimated_value", ""),
         ctx.get("context_datetime", "")),
    )

    for seq, msg in enumerate(msgs):
        role = msg.get("role", "")
        cur = conn.execute(
            """INSERT INTO messages
               (call_id, sequence_num, role, message, time_ms, end_time_ms,
                seconds_from_start, duration_ms)
               VALUES (?,?,?,?,?,?,?,?)""",
            (call_id, seq, role, msg.get("message", ""),
             msg.get("time"), msg.get("endTime"),
             msg.get("secondsFromStart"), msg.get("duration")),
        )
        message_id = cur.lastrowid

        if role == "tool_calls":
            for tc in msg.get("toolCalls", []):
                fn = tc.get("function", {})
                conn.execute(
                    """INSERT INTO tool_calls
                       (call_id, message_id, tool_call_id, tool_name, arguments_json,
                        time_ms, seconds_from_start)
                       VALUES (?,?,?,?,?,?,?)""",
                    (call_id, message_id, tc.get("id", ""),
                     fn.get("name", ""), fn.get("arguments", ""),
                     msg.get("time"), msg.get("secondsFromStart")),
                )

        elif role == "tool_call_result":
            conn.execute(
                """INSERT INTO tool_results
                   (call_id, tool_call_id, tool_name, result_json, time_ms, seconds_from_start)
                   VALUES (?,?,?,?,?,?)""",
                (call_id, msg.get("toolCallId", ""), msg.get("name", ""),
                 msg.get("result", ""), msg.get("time"), msg.get("secondsFromStart")),
            )

        elif role == "user":
            for w in msg.get("metadata", {}).get("wordLevelConfidence", []):
                conn.execute(
                    """INSERT INTO word_confidence
                       (call_id, message_id, word, punctuated_word, confidence,
                        start_time, end_time, language)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (call_id, message_id, w.get("word", ""), w.get("punctuated_word", ""),
                     w.get("confidence"), w.get("start"), w.get("end"),
                     w.get("language", "en")),
                )

    if verbose:
        print(f"  OK  {json_path.name}  ({len(msgs)} messages)")


def main():
    parser = argparse.ArgumentParser(description="ETL: inbound sales call JSONs → SQLite")
    parser.add_argument("--db",      default=str(DATA_DIR / "calls.db"), help="Output SQLite path")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    db_path    = Path(args.db)
    json_files = sorted(DATA_DIR.glob("*.json"))

    print(f"Processing {len(json_files)} files → {db_path}")

    conn = sqlite3.connect(db_path)
    conn.executescript(DDL)

    errors = 0
    for jf in json_files:
        try:
            _process_file(conn, jf, args.verbose)
        except Exception as exc:
            print(f"  ERR {jf.name}: {exc}")
            errors += 1

    conn.commit()
    conn.close()

    ok = len(json_files) - errors
    print(f"\nDone. {ok}/{len(json_files)} files loaded.  DB → {db_path}")
    if errors:
        print(f"  {errors} error(s) — check output above.")


if __name__ == "__main__":
    main()
