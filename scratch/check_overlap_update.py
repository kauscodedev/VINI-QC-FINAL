import os
from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Check a known overlapping call ID
call_id = "019d6dba-46a4-733a-addb-09a7a32b18d6"

res = supabase.table("call_overall_scores").select("*").eq("call_id", call_id).execute()
print(json.dumps(res.data, indent=2))
