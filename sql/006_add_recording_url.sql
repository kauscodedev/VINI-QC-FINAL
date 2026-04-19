-- Add new columns to the calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS external_created_at TIMESTAMPTZ;
