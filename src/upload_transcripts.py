import logging
from src.data_source import SupabaseDataSource
from src.context_builder import build_context
from src.formatters import format_transcript
from src.supabase_client import supabase

logging.basicConfig(level=logging.INFO, format='%(message)s')

def run_update():
    if not supabase:
        logging.error("Supabase client not initialized.")
        return
        
    source = SupabaseDataSource()
    call_ids = source.list_call_ids()
    
    logging.info(f"Uploading formatted transcripts for {len(call_ids)} calls...")
    
    for i, cid in enumerate(call_ids, 1):
        try:
            # Build the complete tree
            ctx = build_context(cid, source)
            # Create the LLM-friendly string
            text = format_transcript(ctx, include_tools=True)
            
            # Persist it into Supabase
            supabase.table("call_contexts").update({"formatted_transcript": text}).eq("call_id", cid).execute()
            if i % 10 == 0 or i == len(call_ids):
                logging.info(f"Progress: {i}/{len(call_ids)}")
        except Exception as e:
            logging.error(f"Failed on call_id {cid}: {e}")

if __name__ == "__main__":
    run_update()
