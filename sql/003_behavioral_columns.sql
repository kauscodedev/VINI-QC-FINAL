-- Phase 3 extension: add a second evaluation track (behavioral / SDR-lens) alongside
-- the existing technical track. All existing rows are backfilled to bucket='technical'.

-- Tag every dimension_scores and issues row with its track.
-- Existing rows get 'technical' automatically via DEFAULT on ADD COLUMN.
ALTER TABLE dimension_scores
    ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'technical';
ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'technical';

-- Indexes for fast filtering by track (dashboard queries like
-- "show me all behavioral issues this week" or "tech score distribution")
CREATE INDEX IF NOT EXISTS idx_dim_scores_bucket ON dimension_scores(bucket, dimension);
CREATE INDEX IF NOT EXISTS idx_issues_bucket ON issues(bucket, issue_type);

-- Behavioral overall columns on call_overall_scores.
-- The existing columns (overall_score / calculation / critical_count / warning_count /
-- recommendation) implicitly represent the technical track from here on out.
ALTER TABLE call_overall_scores
    ADD COLUMN IF NOT EXISTS behavioral_overall_score REAL,
    ADD COLUMN IF NOT EXISTS behavioral_calculation TEXT,
    ADD COLUMN IF NOT EXISTS behavioral_critical_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS behavioral_warning_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS behavioral_recommendation TEXT;
