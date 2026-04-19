import os
import shutil
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# 1. Get all scored call IDs
res = supabase.table("call_overall_scores").select("call_id").execute()
scored_ids = {r["call_id"] for r in res.data}

source_dir = "data/unprocessed_calls"
processed_dir = "data/Processed_calls"

if not os.path.exists(processed_dir):
    os.makedirs(processed_dir)

# 2. Iterate through files and move
files = [f for f in os.listdir(source_dir) if f.endswith(".json")]
moved_processed = 0

for filename in files:
    call_id = filename.replace(".json", "")
    src_path = os.path.join(source_dir, filename)
    
    if call_id in scored_ids:
        # Move to processed
        shutil.move(src_path, os.path.join(processed_dir, filename))
        moved_processed += 1

print(f"Moved {moved_processed} calls to {processed_dir}")
