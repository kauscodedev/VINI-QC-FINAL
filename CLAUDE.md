# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A QC scoring pipeline for AI voice-agent sales calls. Reads call transcripts (JSON → SQLite → Supabase), runs LLM judges across 6 dimensions, writes scores and issues to Supabase for a leadership dashboard. Full plan in `ARCHITECTURE.md`.

**Current state:** Phases 1, 1.5, 2, and 3 are complete. All 76 calls in `calls.db` have been fully evaluated end-to-end (classification + 5 LLM judges + programmatic latency + aggregator + Supabase writes). The orchestrator is the primary entrypoint. Phase 4 (dashboard) is not started.

---

## Commands

```bash
# End-to-end evaluation (primary entrypoint)
python3 -m src.orchestrator --call-id 019d6a86-8665-788e-a91b-8b9cf7247192        # one call
python3 -m src.orchestrator --all                                                  # every call
python3 -m src.orchestrator --all --source supabase                                # read from Supabase
python3 -m src.orchestrator --call-id <id> --dry-run                               # skip Supabase writes
python3 -m src.orchestrator --all --limit 5                                        # smoke-test on N calls

# Classification only (faster; writes only call_classifications)
python3 -m src.run_classification
python3 -m src.run_classification --call-id <id> --dry-run

# Data plumbing
python3 etl.py --verbose                                                           # 76 JSONs → calls.db
python3 -m src.migrate_sqlite_to_supabase                                          # SQLite → Supabase
python3 -m src.context_builder --call-id <id> --source sqlite --out outputs/ctx.json

# Tests & linting
pytest tests/ -v
ruff check src/ tests/
```

---

## Architecture

The **Context JSON** is the contract between the data layer and all judges. Only `context_builder.py` touches the DB; everything downstream consumes the Context JSON shape (see `ARCHITECTURE.md` for the full schema).

**End-to-end data flow:**
```
calls.db / Supabase  →  context_builder  →  compute_latency  →  classify_call
                                                                      │
                                   ┌──────────────────────────────────┘
                                   ▼
        asyncio.gather(5 LLM judges)  +  score_latency (programmatic)
                                   │
                                   ▼
                               aggregator  →  writer  →  Supabase (5 tables)
```

**DataSource abstraction** (`src/data_source.py`): `SQLiteDataSource` and `SupabaseDataSource` implement the same Protocol. Swapping sources never touches judge code. `build_context()` normalizes both into identical `ContextJSON` shape.

**Formatters** (`src/formatters.py`): Call `format_context_for_judge(ctx, include_full_tool_events, call_type)` to build the user-message payload for any judge. Call `drop_raw_prompt(ctx)` before passing context to a judge — the raw system prompt XML is 5-10K tokens and is already parsed into `system_context`.

**Judges** (`src/judges/`): one file per dimension. All 5 LLM judges use `AsyncOpenAI.beta.chat.completions.parse()` with Pydantic `response_format` (strict structured outputs), `temperature=0`. Prompts live in `prompts/<dimension>.md`. Shared helpers in `src/judges/_base.py`. `classify.py` is sync (wrapped via `asyncio.to_thread` in the orchestrator). `latency_score.py` is programmatic — produces a `DimensionScore` so the aggregator consumes all 6 dimensions uniformly. (The `.claude/agents/` folder is strictly reserved for optional Claude Code build-time subagents.)

**Latency** (`src/latency.py`): programmatic. `bot_latency = bot.time_ms - prev_user.end_time_ms`. Flags > 6 s latency, > 12 s dead air. Returns `{"format": "legacy"}` sentinel when timestamps are absent → `score_latency` then returns `score_na=True`.

**Aggregator** (`src/aggregator.py`): weighted average across 6 dimensions. When a dimension returns `score_na=True`, its weight is removed and the remaining weights are renormalized to sum to 1.0 — **never hardcode the denominator**. Weights: info_accuracy=0.20, conversion=0.20, tool_accuracy=0.20, escalation=0.15, conversation_quality=0.15, response_latency=0.10. Recommendation logic: `FAIL` if overall < 1.5 OR critical ≥ 2; `REVIEW` if critical ≥ 1; `PASS_WITH_ISSUES` if warning ≥ 1; else `PASS`.

**Writer** (`src/writer.py`): idempotent per `call_id`. Single-row tables (`call_classifications`, `call_overall_scores`) use upsert; list tables (`tool_scores`, `issues`) use delete-then-insert; `dimension_scores` upserts on the `(call_id, dimension)` unique key. Re-running the orchestrator for the same call cleanly replaces prior rows.

---

## Output tables (Supabase)

| Table | Cardinality | Purpose |
|---|---|---|
| `call_classifications` | 1 per call | Classifier output (call_type, primary_intent, reasoning) |
| `dimension_scores` | 6 per call | One row per dimension (5 LLM + latency), with `score`, `score_na`, `reasoning`, `weight`, `model` |
| `tool_scores` | 0–N per call | Per-invocation scores emitted by the tool_accuracy judge |
| `issues` | 0–N per call | Every warning/critical issue across all 6 dimensions, with `turn_number` and `evidence` |
| `call_overall_scores` | 1 per call | Denormalized: `overall_score` (1.0–3.0), `calculation` trace, `critical_count`, `warning_count`, `recommendation` |

`issues.evidence` is `JSONB NOT NULL` in Postgres but `Issue.evidence` is `str` in Pydantic (OpenAI strict structured outputs disallows open-ended dicts). The writer wraps it as `{"text": <evidence>}` at insert time.

Raw schema DDL is in [sql/001_schema.sql](sql/001_schema.sql); indexes in [sql/002_indexes.sql](sql/002_indexes.sql). Tables also include `batch_runs` and `capability_gaps` for future batch-level analytics — not populated yet.

---

## Key files

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | Full design spec, Postgres schema, phase breakdown — read first for context |
| `etl.py` | Parses 76 call JSONs → `calls.db` |
| `calls.db` | SQLite source for Phase 1 (still the authoritative ingest path) |
| `sql/001_schema.sql` | Full Postgres DDL for all 11 Supabase tables |
| `src/schemas.py` | Pydantic models (`DimensionScore`, `ToolAccuracyResult`, `Issue`, `ClassificationResult`) + TypedDicts for `ContextJSON` |
| `src/context_builder.py` | Normalizes any DataSource → Context JSON; parses dealership/customer info out of XML system prompt |
| `src/formatters.py` | `format_context_for_judge()`, `format_transcript()`, `drop_raw_prompt()` |
| `src/latency.py` | Programmatic latency metrics (`compute_latency(ctx)`) |
| `src/data_source.py` | `SQLiteDataSource` + `SupabaseDataSource` implementing `DataSource` Protocol |
| `src/aggregator.py` | Weighted-score aggregation, N/A renormalization, recommendation |
| `src/writer.py` | Idempotent 5-table Supabase persistence |
| `src/orchestrator.py` | **Primary entrypoint** — per-call pipeline + batch CLI |
| `src/judges/_base.py` | Shared async OpenAI client + prompt loader (default model `gpt-4o`) |
| `src/judges/classify.py` | Classification judge; `gpt-4o-mini`; structured outputs |
| `src/judges/{information_accuracy,tool_accuracy,escalation,conversion,conversation_quality}.py` | 5 async LLM dimension judges |
| `src/judges/latency_score.py` | Programmatic DimensionScore adapter for latency |
| `src/run_classification.py` | Classification-only batch runner (predates the orchestrator; still valid for classify-only workflows) |
| `src/migrate_sqlite_to_supabase.py` | One-shot Phase 1.5 migration |
| `prompts/` | System prompts for all 6 judges; one `.md` per dimension |
| `Eval Spec Sales IB/` | Reference eval specs that informed `prompts/`; not consumed by code |
| `tests/fixtures/expected_019d6a86.json` | Golden regression fixture for the reference call |

---

## Reference call for smoke testing

`019d6a86-8665-788e-a91b-8b9cf7247192` — 32 messages, 3 tool calls, transfer returned `DEPARTMENT_CLOSED`. Classifies as `non_dealer` (customer looking for Nissan at a Honda dealership). Use for every phase's smoke test.

---

## SQLite schema (calls.db)

7 tables: `calls`, `call_context`, `messages`, `tool_calls`, `tool_results`, `word_confidence`, `sqlite_sequence`. `word_confidence` and `sqlite_sequence` are excluded from processing.

In SQLite, `tool_calls` and `tool_results` are separate rows matched by `tool_call_id`. In Supabase they're merged into a single `tool_events` row during migration.

**Important:** ETL does NOT parse the XML system prompt into the scalar columns of SQLite's `call_context` table (they're empty strings). Only `system_prompt_raw` is populated. `context_builder` is what extracts `dealership_name`, `customer_phone`, hours, etc. by parsing the `<ContextData>` XML block. The Supabase migration reuses `build_context()` to do this parsing — never write raw `call_context` columns directly.

---

## Environment

Secrets in `.env` (gitignored). See `.env.example` for required keys: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

Models: `gpt-4o-mini` for classifier, `gpt-4o` for all 5 dimension judges, `programmatic` for latency.

---

## Known quirks

- `dealership_sales_hours` / `dealership_service_hours` are stored in Supabase `JSONB` as JSON strings (double-escaped when re-serialized for judge payloads). Functional but cosmetically ugly; parse into a structured dict if/when a dashboard reads these.
- OpenAI strict structured outputs requires `additionalProperties: false` on every nested object. This is why `Issue.evidence` is `str` (not `Dict[str, Any]`). Don't reintroduce open dicts in any Pydantic model used as a `response_format`.
- `classify.py` uses a sync `OpenAI` client (not `AsyncOpenAI`); the orchestrator wraps it in `asyncio.to_thread`. The 5 dimension judges are natively async.
