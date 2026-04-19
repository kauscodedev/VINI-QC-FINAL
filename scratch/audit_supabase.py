import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

tables = [
    "calls", 
    "call_contexts", 
    "messages", 
    "tool_events", 
    "call_classifications", 
    "call_overall_scores", 
    "dimension_scores", 
    "issues", 
    "tool_scores"
]

print("--- Supabase Table Counts ---")
for t in tables:
    try:
        res = supabase.table(t).select("count", count="exact").limit(0).execute()
        print(f"{t:25}: {res.count}")
    except Exception as e:
        print(f"{t:25}: ERROR - {str(e)}")

# Specifically check how many unique call_ids have overall scores
scored_calls = supabase.table("call_overall_scores").select("call_id", count="exact").execute()
print(f"\nUnique scored calls: {scored_calls.count}")
