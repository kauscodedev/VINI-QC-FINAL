# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A QC scoring pipeline for AI voice-agent sales calls. Reads call transcripts (JSON → SQLite → Supabase), runs LLM judges across 6 dimensions, writes scores and issues to Supabase for a leadership dashboard. Full plan in `ARCHITECTURE.md`.

**Current state:** Phase 1 in progress. `etl.py` and `calls.db` exist. `src/` not yet created.

---

## Commands

```bash
# Re-run ETL (idempotent, overwrites calls.db)
python3 etl.py --verbose

# Once src/ exists — context builder CLI
python3 -m src.context_builder --call-id 019d6a86-8665-788e-a91b-8b9cf7247192 --source sqlite --out outputs/test_context.json

# Tests
pytest tests/ -v
pytest tests/test_context_builder.py -v   # single file

# Linting
ruff check src/ tests/
```

Install dependencies (once pyproject.toml exists):
```bash
pip install -e ".[dev]"
```

---

## Architecture

The **Context JSON** is the contract between the data layer and all judges. Only `context_builder.py` touches the DB; everything downstream consumes the Context JSON shape (see `ARCHITECTURE.md` for the full schema).

**Data flow:**
```
calls.db (SQLite)  →  context_builder.py  →  latency.py  →  call-classifier  →  5 parallel LLM judges  →  aggregator.py  →  Supabase
```

**DataSource abstraction** (`src/data_source.py`): `SQLiteDataSource` for Phase 1, `SupabaseDataSource` for Phase 1.5+. Context builder accepts either via Protocol — swapping sources never touches judge code.

**Judges** (`src/judges/`): one file per dimension (runtime, OpenAI-powered judges, not build-time subagents), all async, all use OpenAI structured outputs (`client.beta.chat.completions.parse()` with Pydantic `response_format`). Prompts live in `prompts/<dimension>.md`. (Note: The `.claude/agents/` folder is strictly reserved for optional Claude Code build-time subagents.)

**Latency** (`src/latency.py`): programmatic, not LLM. `bot_latency = bot.time_ms - prev_user.end_time_ms`. Flags > 6 s latency, > 12 s dead air.

**N/A scores**: aggregator renormalizes weights when a dimension is excluded. Never hardcode the denominator.

---

## Key files

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | Full design spec, Postgres schema, phase breakdown — read this first |
| `etl.py` | Parses 76 call JSONs → `calls.db` (6 tables) |
| `calls.db` | SQLite source for Phase 1 |
| `src/schemas.py` | Pydantic models for all judge outputs + TypedDicts for internal types |
| `src/context_builder.py` | Normalizes any DataSource → Context JSON |

---

## Reference call for smoke testing

`019d6a86-8665-788e-a91b-8b9cf7247192` — 32 messages, 3 tool calls, transfer returned `DEPARTMENT_CLOSED`. Use this call for every phase's smoke test.

---

## SQLite schema (calls.db)

7 tables: `calls`, `call_context`, `messages`, `tool_calls`, `tool_results`, `word_confidence`, `sqlite_sequence`. `word_confidence` and `sqlite_sequence` are excluded from Phase 1 processing.

`tool_calls` and `tool_results` are separate rows in SQLite, matched by `tool_call_id`. In Supabase they're merged into a single `tool_events` row at migration time.

---

## Environment

Secrets in `.env` (gitignored). See `.env.example` for required keys: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

Models: `gpt-4o-mini` for classifier, `gpt-4o` for all 5 dimension judges.
