-- Remediation Insights: Deeper analysis into root causes of capability gaps.
-- Links specific remediations to patterns identified in batch runs.

CREATE TABLE IF NOT EXISTS remediation_insights (
    id                  BIGSERIAL PRIMARY KEY,
    gap_id              BIGINT NOT NULL REFERENCES capability_gaps(id),
    root_cause_type     TEXT NOT NULL,              -- 'prompt' | 'config' | 'setup' | 'model'
    analysis            TEXT NOT NULL,              -- Deep reasoning behind the root cause
    proposed_remediation TEXT NOT NULL,             -- Specific fix (e.g. prompt snippet or config change)
    implementation_diff JSONB,                      -- Optional: structured representation of the change
    confidence_score    REAL,                       -- 0.0 to 1.0 (LLM's confidence in the diagnosis)
    surfaced_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookup by gap
CREATE INDEX IF NOT EXISTS idx_remediation_gap ON remediation_insights(gap_id);
