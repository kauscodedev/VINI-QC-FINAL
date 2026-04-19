import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

# We need the direct DB connection string which is usually not in .env for PostgREST
# But sometimes it's there. Let's check.
# ARCHITECTURE.md mentioned psql $SUPABASE_URL -f ... 
# Wait, SUPABASE_URL is for the API, not the DB.
# I'll check if there's a DB_URL or similar in .env.
with open('.env') as f:
    env_content = f.read()

# If not found, I'll have to ask the user.
print("Checking for database connection string...")
if "DB_URL" in env_content:
    db_url = [line.split('=')[1] for line in env_content.splitlines() if line.startswith('DB_URL')][0].strip().strip('"')
    print(f"Connecting to {db_url.split('@')[1]}")
    conn = psycopg.connect(db_url)
    with conn.cursor() as cur:
        with open('sql/005_remediation_schema.sql') as f:
            cur.execute(f.read())
        conn.commit()
    print("Migration successful.")
else:
    print("DB_URL not found in .env. Please apply sql/005_remediation_schema.sql manually in Supabase SQL Editor.")
