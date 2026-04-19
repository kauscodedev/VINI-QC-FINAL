import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Get all calls
all_calls = supabase.table("calls").select("call_id", count="exact").execute()
total_calls = all_calls.count

# Get scored calls
scored_calls = supabase.table("call_overall_scores").select("call_id", count="exact").execute()
total_scored = scored_calls.count

print(f"Total calls in Supabase: {total_calls}")
print(f"Total scored calls:      {total_scored}")
print(f"Unprocessed calls left:  {total_calls - total_scored}")
