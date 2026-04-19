from typing import Protocol, Any, Dict, List
import sqlite3

class DataSource(Protocol):
    def get_call(self, call_id: str) -> Dict[str, Any]: ...
    def list_call_ids(self) -> List[str]: ...
    def list_unprocessed_call_ids(self) -> List[str]: ...

class SQLiteDataSource:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_call(self, call_id: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            call_row = conn.execute("SELECT * FROM calls WHERE call_id = ?", (call_id,)).fetchone()
            if not call_row:
                raise ValueError(f"Call {call_id} not found in database.")
                
            context_row = conn.execute("SELECT * FROM call_context WHERE call_id = ?", (call_id,)).fetchone()
            messages = conn.execute("SELECT * FROM messages WHERE call_id = ? ORDER BY sequence_num ASC, id ASC", (call_id,)).fetchall()
            tool_calls = conn.execute("SELECT * FROM tool_calls WHERE call_id = ?", (call_id,)).fetchall()
            tool_results = conn.execute("SELECT * FROM tool_results WHERE call_id = ?", (call_id,)).fetchall()

        return {
            "call": dict(call_row) if call_row else None,
            "context": dict(context_row) if context_row else None,
            "messages": [dict(m) for m in messages],
            "tool_calls": [dict(tc) for tc in tool_calls],
            "tool_results": [dict(tr) for tr in tool_results]
        }

    def list_call_ids(self) -> List[str]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT call_id FROM calls").fetchall()
            return [row["call_id"] for row in rows]

    def list_unprocessed_call_ids(self) -> List[str]:
        # Local SQLite doesn't track overall scores the same way yet, 
        # but for consistency we'll return all IDs. 
        # In this project, Supabase is the main scoring target.
        return self.list_call_ids()

class SupabaseDataSource:
    def __init__(self):
        from .supabase_client import supabase
        if not supabase:
            raise ValueError("Supabase client not initialized")
        self.supabase = supabase

    def get_call(self, call_id: str) -> Dict[str, Any]:
        result = {}
        
        call_resp = self.supabase.table("calls").select("*").eq("call_id", call_id).maybe_single().execute()
        result["call"] = call_resp.data if call_resp.data else None
        
        c_resp = self.supabase.table("call_contexts").select("*").eq("call_id", call_id).maybe_single().execute()
        result["context"] = c_resp.data if c_resp.data else None
        
        # we still use sequence_num for the turn in sqlite but supabase stores it exactly as `turn`
        m_resp = self.supabase.table("messages").select("*").eq("call_id", call_id).order("turn").order("id").execute()
        result["messages"] = m_resp.data if m_resp.data else []
        
        evt_resp = self.supabase.table("tool_events").select("*").eq("call_id", call_id).execute()
        result["tool_events"] = evt_resp.data if evt_resp.data else []

        return result

    def list_call_ids(self) -> List[str]:
        resp = self.supabase.table("calls").select("call_id").execute()
        return [row["call_id"] for row in resp.data]

    def list_unprocessed_call_ids(self) -> List[str]:
        # 1. Get all scored IDs
        scored_resp = self.supabase.table("call_overall_scores").select("call_id").execute()
        scored_ids = {row["call_id"] for row in scored_resp.data}
        
        # 2. Get all call IDs
        all_ids = self.list_call_ids()
        
        # 3. Filter
        return [cid for cid in all_ids if cid not in scored_ids]
