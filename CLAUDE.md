# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A QC scoring pipeline for AI voice-agent sales calls. Reads call transcripts (JSON → SQLite → Supabase), runs LLM judges across **two parallel tracks** — a technical track (6 correctness dims) and a behavioral / SDR-lens track (6 SDR-performance dims) — and writes scores and issues to Supabase for a leadership dashboard. Full design in `ARCHITECTURE.md`.

**Current state:** All 76 calls have been scored end-to-end on **both tracks**. Supabase contains 912 dimension rows (456 technical + 456 behavioral), 335 issues (129 tech + 206 behavioral), and 76 overall rows with both tracks' overall scores populated. Phase 4 (dashboard) not started.

---

## Two-track scoring

Each call produces **12 dimension scores** — 6 technical + 6 behavioral. Every row in `dimension_scores` and `issues` carries a `bucket` column (`'technical'` | `'behavioral'`) so the dashboard can filter/aggregate per track.

| Track | Focus | Dimensions (weights) |
|---|---|---|
| **technical** | *correctness* — did tools fire right, was info factual | information_accuracy 0.20 · conversion 0.20 · tool_accuracy 0.20 · escalation 0.15 · conversation_quality 0.15 · response_latency 0.10 |
| **behavioral** | *SDR performance* — warmth, discovery, objection tactics | behavior_opening_tone 0.10 · behavior_intent_discovery 0.20 · behavior_resolution_accuracy 0.20 · behavior_objection_recovery 0.15 · behavior_conversation_management 0.10 · behavior_conversion_next_step 0.25 |

Both tracks use the same **1–3 scale** (+ N/A) and the same `DimensionScore` Pydantic model. Behavioral prompts merged PM's original "0 = Failed" and "1 = Weak" levels into a single new level 1 so existing schema is unchanged.

---

## Commands

```bash
# Full pipeline (technical + behavioral) — default
python3 -m src.orchestrator --call-id 019d6a86-8665-788e-a91b-8b9cf7247192
python3 -m src.orchestrator --all
python3 -m src.orchestrator --all --source supabase
python3 -m src.orchestrator --call-id <id> --dry-run

# Behavioral-only — skips classify + 5 tech judges + latency. Reuses existing
# call_classifications and preserves existing technical dimension_scores / issues rows.
python3 -m src.orchestrator --all --track behavioral
python3 -m src.orchestrator --call-id <id> --track behavioral

# Classification only (predates orchestrator; still valid for classify-only workflows)
python3 -m src.run_classification
python3 -m src.run_classification --call-id <id> --dry-run

# Data plumbing
python3 etl.py --verbose                                                   # 76 JSONs → calls.db
python3 -m src.migrate_sqlite_to_supabase                                  # SQLite → Supabase
python3 -m src.context_builder --call-id <id> --source sqlite --out outputs/ctx.json

# Tests & linting
pytest tests/ -v
ruff check src/ tests/
```

---

## Architecture

The **Context JSON** is the contract between the data layer and all judges. Only `context_builder.py` touches the DB; everything downstream consumes the Context JSON shape.

**End-to-end data flow (`--track both`):**
```
calls.db / Supabase  →  context_builder  →  compute_latency  →  classify_call
                                                                      │
                                   ┌──────────────────────────────────┘
                                   ▼
     asyncio.gather(5 tech LLM judges + 6 behavioral LLM judges) + score_latency
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
             aggregate(technical)        aggregate(behavioral)
                     │                           │
                     └────────────┬──────────────┘
                                  ▼
                               writer → Supabase (5 tables)
```

**DataSource abstraction** (`src/data_source.py`): `SQLiteDataSource` and `SupabaseDataSource` implement the same Protocol. `build_context()` normalizes both into identical `ContextJSON`.

**Formatters** (`src/formatters.py`): `format_context_for_judge(ctx, include_full_tool_events, call_type)` builds the user-message payload for any judge. Call `drop_raw_prompt(ctx)` before passing context — the raw system prompt XML is 5–10K tokens and already parsed into `system_context`.

**Judges** (`src/judges/`): 11 LLM judges + classify + programmatic latency. All LLM judges use `AsyncOpenAI.beta.chat.completions.parse()` with Pydantic `response_format` (strict structured outputs), `temperature=0`. Prompts live in `prompts/<name>.md`. Shared helpers in `src/judges/_base.py`. `classify.py` is sync (wrapped via `asyncio.to_thread`). `latency_score.py` is programmatic — produces a `DimensionScore` so the aggregator consumes all dimensions uniformly. (The `.claude/agents/` folder is strictly reserved for optional Claude Code build-time subagents.)

**Latency** (`src/latency.py`): `bot_latency = bot.time_ms - prev_user.end_time_ms`. Flags > 6 s latency, > 12 s dead air. Returns `{"format": "legacy"}` sentinel when timestamps absent → `score_latency` returns `score_na=True`.

**Aggregator** (`src/aggregator.py`): weighted average with N/A renormalization — **never hardcode the denominator**. Called twice per call (once per track) with either `DIMENSION_WEIGHTS` or `BEHAVIORAL_WEIGHTS`. Recommendation logic (shared): `FAIL` if overall < 1.5 OR critical ≥ 2; `REVIEW` if critical ≥ 1; `PASS_WITH_ISSUES` if warning ≥ 1; else `PASS`.

**Writer** (`src/writer.py`): two entrypoints.
- `write_evaluation(...)` — full write for both tracks. Upsert on single-row tables; upsert-on-unique-key for `dimension_scores` (12 rows/call); delete-then-insert for `issues` (all buckets) and `tool_scores`.
- `write_behavioral_only(...)` — partial write for the `--track behavioral` path. Upserts only the 6 behavioral dim rows (unique-key doesn't collide with technical); deletes only rows with `bucket='behavioral'` in `issues`; **UPDATE (not upsert)** on `call_overall_scores` so technical NOT-NULL columns are preserved.

---

## Output tables (Supabase)

| Table | Cardinality | Key columns |
|---|---|---|
| `call_classifications` | 1 per call | `call_type`, `primary_intent`, `reasoning`, `model` |
| `dimension_scores` | **12 per call** | `dimension`, `score` (1–3 or NULL), `score_na`, `reasoning`, `weight`, `model`, **`bucket`** |
| `tool_scores` | 0–N per call | `tool_call_id`, `tool_name`, `score`, `reasoning` (from technical `tool_accuracy` only) |
| `issues` | 0–N per call | `dimension`, `issue_type`, `severity`, `turn_number`, `evidence` (JSONB `{"text": …}`), **`bucket`** |
| `call_overall_scores` | 1 per call | Technical: `technical_overall_score`, `technical_calculation`, `technical_critical_count`, `technical_warning_count`, `technical_recommendation`. Behavioral: `behavioral_overall_score`, `behavioral_calculation`, `behavioral_critical_count`, `behavioral_warning_count`, `behavioral_recommendation` |

`issues.evidence` is `JSONB NOT NULL`; `Issue.evidence` is `str` in Pydantic (OpenAI strict mode disallows open dicts). The writer wraps as `{"text": <evidence>}` at insert time.

DDL lives in [sql/001_schema.sql](sql/001_schema.sql) (indexes in [sql/002_indexes.sql](sql/002_indexes.sql)); the two-track extension is in [sql/003_behavioral_columns.sql](sql/003_behavioral_columns.sql); the technical-column prefix rename is in [sql/004_rename_technical_columns.sql](sql/004_rename_technical_columns.sql). Apply SQL files in numerical order via Supabase SQL Editor.

Tables `batch_runs` and `capability_gaps` exist but are not populated yet.

---

## Key files

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | Full design spec, Postgres schema, phase breakdown — read first |
| `etl.py` | Parses 76 call JSONs → `calls.db` |
| `calls.db` | SQLite source (authoritative ingest path) |
| `sql/001_schema.sql` | Full Postgres DDL for all 11 Supabase tables |
| `sql/003_behavioral_columns.sql` | `bucket` column + behavioral overall columns migration |
| `src/schemas.py` | Pydantic models (`DimensionScore`, `ToolAccuracyResult`, `Issue`, `ClassificationResult`) + TypedDicts for `ContextJSON` |
| `src/context_builder.py` | Normalizes DataSource → Context JSON; parses dealership/customer out of XML |
| `src/formatters.py` | `format_context_for_judge()`, `format_transcript()`, `drop_raw_prompt()` |
| `src/latency.py` | Programmatic latency metrics |
| `src/data_source.py` | `SQLiteDataSource` + `SupabaseDataSource` implementing `DataSource` Protocol |
| `src/aggregator.py` | `aggregate(results, weights)` — called once per track |
| `src/writer.py` | `write_evaluation` (full) + `write_behavioral_only` (partial, behavioral-track path) |
| `src/orchestrator.py` | **Primary entrypoint** — `evaluate_call` + `evaluate_call_behavioral_only`, CLI with `--track` flag |
| `src/judges/_base.py` | Shared async OpenAI client + prompt loader |
| `src/judges/classify.py` | Classification judge (`gpt-4o-mini`, structured outputs) |
| `src/judges/{information_accuracy,tool_accuracy,escalation,conversion,conversation_quality}.py` | 5 technical LLM judges |
| `src/judges/latency_score.py` | Programmatic DimensionScore adapter for latency |
| `src/judges/behavior_{opening_tone,intent_discovery,resolution_accuracy,objection_recovery,conversation_management,conversion_next_step}.py` | 6 behavioral LLM judges |
| `src/run_classification.py` | Classification-only batch runner (predates orchestrator) |
| `src/migrate_sqlite_to_supabase.py` | One-shot Phase 1.5 migration |
| `prompts/judge_*.md` | Technical prompts (5) |
| `prompts/behavior_*.md` | Behavioral prompts (6) |
| `prompts/classify_call.md` | Classifier prompt |
| `Eval Spec Sales IB/` | Reference eval specs that informed prompts |
| `tests/fixtures/expected_019d6a86.json` | Golden regression fixture |

---

## Reference call for smoke testing

`019d6a86-8665-788e-a91b-8b9cf7247192` — 32 messages, 3 tool calls, transfer returned `DEPARTMENT_CLOSED`. Classifies as `non_dealer` (Nissan customer at a Honda dealership). Tech overall ≈ 1.7 (REVIEW), behavioral overall ≈ 2.2 (REVIEW).

---

## SQLite schema (calls.db)

7 tables: `calls`, `call_context`, `messages`, `tool_calls`, `tool_results`, `word_confidence`, `sqlite_sequence`. `word_confidence` and `sqlite_sequence` are excluded from processing.

In SQLite, `tool_calls` and `tool_results` are separate rows matched by `tool_call_id`. In Supabase they're merged into a single `tool_events` row during migration.

**Important:** ETL does NOT parse the XML system prompt into the scalar columns of SQLite's `call_context` table (they're empty strings). Only `system_prompt_raw` is populated. `context_builder` extracts `dealership_name`, `customer_phone`, hours, etc. by parsing the `<ContextData>` XML block. The Supabase migration reuses `build_context()` to do this parsing — never write raw `call_context` columns directly.

---

## Environment

Secrets in `.env` (gitignored). See `.env.example` for required keys: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

Models: `gpt-4o-mini` for classifier, `gpt-4o` for all 11 LLM dimension judges, `programmatic` for latency.

---

## Known quirks

- `dealership_sales_hours` / `dealership_service_hours` are stored in Supabase `JSONB` as JSON strings (double-escaped when re-serialized for judge payloads). Functional but ugly; parse into a structured dict if/when a dashboard reads these.
- OpenAI strict structured outputs requires `additionalProperties: false` on every nested object. This is why `Issue.evidence` is `str` (not `Dict[str, Any]`). Don't reintroduce open dicts in any Pydantic model used as a `response_format`.
- `classify.py` uses a sync `OpenAI` client (wrapped via `asyncio.to_thread` in the orchestrator). The 11 dimension judges are natively async.
- `write_behavioral_only` uses `UPDATE` (not upsert) on `call_overall_scores` because a PostgREST upsert would INSERT NULLs into the NOT-NULL technical columns on conflict. The behavioral-only path therefore **requires** the technical row to already exist (enforced by `_fetch_existing_call_type`).
