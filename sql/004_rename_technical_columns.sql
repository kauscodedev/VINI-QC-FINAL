-- Rename the original (technical-track) overall columns in call_overall_scores to carry
-- a `technical_` prefix, matching the behavioral_* columns added in 003. Purely cosmetic —
-- preserves all data. RENAME COLUMN is atomic and index-preserving in Postgres.

ALTER TABLE call_overall_scores RENAME COLUMN overall_score   TO technical_overall_score;
ALTER TABLE call_overall_scores RENAME COLUMN calculation     TO technical_calculation;
ALTER TABLE call_overall_scores RENAME COLUMN critical_count  TO technical_critical_count;
ALTER TABLE call_overall_scores RENAME COLUMN warning_count   TO technical_warning_count;
ALTER TABLE call_overall_scores RENAME COLUMN recommendation  TO technical_recommendation;
