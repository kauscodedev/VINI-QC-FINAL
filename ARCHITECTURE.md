# QC Agent — Architecture & Build Plan (v2)

> North-star reference for building the QC Agent. Load on every Claude Code session. Keep up to date.

**Ultimate goal:** power a leadership/PM dashboard tracking AI sales agent health across KPIs and issues. The QC scoring pipeline is the input layer. Supabase is the storage layer. The dashboard (built later) is the output layer.

---

## What we're building

An automated quality-control system that scores AI sales agent calls on **6 dimensions**, each on a **1-3 BARS scale** (Failure / Partial / Success), producing per-call scores, issue flags, and batch-level capability-gap aggregation — all written to **Supabase (Postgres)** for a leadership dashboard to consume.

The scoring logic lives in **5 focused LLM judges** (runtime, OpenAI-powered), plus a **call classifier** that gates which dimensions apply. A Python orchestrator prepares data, dispatches judges in parallel, aggregates results, writes to Supabase.

---

## The 6 dimensions

| # | Dimension | Weight | Scorer |
|---|---|---|---|
| 1 | Information Accuracy | 20% | `info-accuracy-judge` (OpenAI) |
| 2 | Lead Qualification & Conversion | 20% | `conversion-judge` (OpenAI) |
| 3 | Tool Accuracy | 20% | `tool-accuracy-judge` (OpenAI) |
| 4 | Escalation & Transfer Handling | 15% | `escalation-judge` (OpenAI) |
| 5 | Conversation Quality | 15% | `conversation-quality-judge` (OpenAI) |
| 6 | Response Latency | 10% | `latency.py` (programmatic) |

Any dimension can be `N/A`. The aggregator renormalizes weights when dimensions are excluded.

---

## Data sources

### Phase 1 (local dev): SQLite `./calls.db`

76 calls across 7 tables — already populated from `calls_json/`. Tables: `calls`, `call_context`, `messages`, `tool_calls`, `tool_results`, `word_confidence` (skip in v1), `sqlite_sequence` (ignore).

### Phase 1.5+ (post-migration): Supabase Postgres

All raw call data migrates into Supabase. After migration, Supabase is the single source of truth for both raw data and scoring outputs. See [Postgres Schema](#postgres-schema-supabase) below.

### Per-call JSONs (raw origin): `./calls_json/<call_id>.json`

The DB was built from these. Mirror of the same data. Shape:

```json
{
  "callId": "...",
  "callDetails": {
    "agentInfo": { "agentName": "...", "agentType": "Sales" },
    "callType": "inboundPhoneCall",
    "endedReason": "...",
    "messagesWithToolCalls": [ /* system, bot, user, tool_calls, tool_call_result */ ]
  }
}
```

Either SQLite or the JSONs can serve as the data source. Abstracted via `DataSource` protocol so swapping sources is trivial.

---

## Context JSON (contract between data layer and judges)

`context_builder` normalizes any source into this shape. Every judge consumes it.

```json
{
  "call_id": "019d6a86-...",
  "call_metadata": {
    "agent_name": "Emily Carter",
    "agent_type": "Sales",
    "call_type": "inboundPhoneCall",
    "ended_reason": "assistant-ended-call-after-message-spoken",
    "duration_ms": 133584,
    "message_count": 32
  },
  "system_context": {
    "dealership": { "name": "...", "address": "...", "sales_hours": "...", "service_hours": "...", "inventory_type": "both" },
    "customer": {
      "name": null, "phone": "+16628798968", "email": null,
      "city": null, "state": null,
      "interested_vehicle": { "make": null, "model": null, "year": null, "vin": null, "stock": null, "trim": null, "is_sold": null },
      "trade_in": null
    },
    "context_datetime": "...",
    "raw_system_prompt": "<full XML kept in case a judge needs it>"
  },
  "transcript": [
    { "turn": 1, "role": "bot", "text": "Hi there...", "time_ms": ..., "end_time_ms": ... },
    { "turn": 2, "role": "user", "text": "...", "time_ms": ..., "end_time_ms": ... }
  ],
  "tool_events": [
    {
      "turn": 9,
      "tool_call_id": "toolu_01Wiyq...",
      "tool": "communication_transfer_call_v3",
      "args": { "department": "sales", "reason": "...", "summary": "..." },
      "result": { "success": false, "status": "DEPARTMENT_CLOSED", ... },
      "invoked_time_ms": ...,
      "result_time_ms": ...
    }
  ],
  "latency_metrics": {
    "agent_latencies_ms": [1240, 890, 2100, ...],
    "dead_air_gaps_ms": [340, 1200, ...],
    "median_agent_latency_ms": 1450,
    "max_agent_latency_ms": 7800,
    "high_latency_turns": [{"turn": 22, "latency_ms": 7800}],
    "excessive_dead_air_turns": []
  }
}
```

**If we change data sources, only `context_builder.py` changes.** Judges and aggregator never touch the DB directly.

---

## Postgres schema (Supabase)

Eight tables. Raw call data on top, scoring outputs below. Everything keyed to `call_id`.

### Raw call data (migrated from SQLite in Phase 1.5)

**`calls`** — call-level metadata
```sql
call_id             TEXT PRIMARY KEY
enterprise_id       TEXT
team_id             TEXT
agent_name          TEXT
agent_type          TEXT
call_type_raw       TEXT                           -- 'inboundPhoneCall' from source
ended_reason        TEXT
call_start_time     TIMESTAMPTZ
call_end_time       TIMESTAMPTZ
duration_ms         INTEGER
total_messages      INTEGER
source_file         TEXT
ingested_at         TIMESTAMPTZ DEFAULT NOW()
```

**`call_contexts`** — customer + dealership snapshot at call time
```sql
call_id                         TEXT PRIMARY KEY REFERENCES calls(call_id)
dealership_name                 TEXT
dealership_address              TEXT
dealership_inventory_type       TEXT
dealership_sales_hours          JSONB
dealership_service_hours        JSONB
customer_name                   TEXT
customer_phone                  TEXT
customer_email                  TEXT
customer_city                   TEXT
customer_state                  TEXT
interested_vehicle              JSONB                      -- { make, model, year, vin, stock, trim, is_sold }
trade_in                        JSONB
context_datetime                TIMESTAMPTZ
raw_system_prompt               TEXT                       -- full XML kept for reference
```

**`messages`** — transcript turns
```sql
id                  BIGSERIAL PRIMARY KEY
call_id             TEXT NOT NULL REFERENCES calls(call_id)
turn                INTEGER NOT NULL                       -- 0 = system, 1+ = conversation
role                TEXT NOT NULL                          -- system | bot | user | tool_calls | tool_call_result
message             TEXT
time_ms             BIGINT
end_time_ms         BIGINT
duration_ms         INTEGER
seconds_from_start  REAL
UNIQUE (call_id, turn)
```

**`tool_events`** — paired tool_calls + tool_results (merged at ETL)
```sql
id                  BIGSERIAL PRIMARY KEY
call_id             TEXT NOT NULL REFERENCES calls(call_id)
turn                INTEGER                                -- turn where tool_calls appeared
tool_call_id        TEXT NOT NULL
tool_name           TEXT NOT NULL
args                JSONB NOT NULL
result              JSONB                                  -- null if tool result missing
had_error           BOOLEAN GENERATED ALWAYS AS (
                        result->>'success' = 'false'
                        OR result->>'status' LIKE '%FAILED%'
                        OR result->>'status' LIKE '%CLOSED%'
                    ) STORED
invoked_time_ms     BIGINT
result_time_ms      BIGINT
UNIQUE (call_id, tool_call_id)
```

### Scoring outputs (written by orchestrator in Phase 3)

**`call_classifications`** — classifier output
```sql
call_id             TEXT PRIMARY KEY REFERENCES calls(call_id)
call_type           TEXT NOT NULL                          -- legitimate_sales | routing_or_transfer | sales_agent_conversion_attempt | out_of_scope_topic | complaint_call | non_dealer
primary_intent      TEXT
reasoning           TEXT
model               TEXT                                   -- gpt-4o-mini
classified_at       TIMESTAMPTZ DEFAULT NOW()
```

**`dimension_scores`** — one row per call × dimension
```sql
id                  BIGSERIAL PRIMARY KEY
call_id             TEXT NOT NULL REFERENCES calls(call_id)
dimension           TEXT NOT NULL                          -- information_accuracy | conversion | tool_accuracy | escalation | conversation_quality | response_latency
score               SMALLINT                               -- 1, 2, 3, or NULL for N/A
score_na            BOOLEAN NOT NULL DEFAULT FALSE
reasoning           TEXT
weight              REAL NOT NULL                          -- 0.20, 0.15, etc.
model               TEXT                                   -- gpt-4o (or 'programmatic' for latency)
scored_at           TIMESTAMPTZ DEFAULT NOW()
UNIQUE (call_id, dimension)
```

**`tool_scores`** — per-tool-invocation scoring (breakdown inside Tool Accuracy)
```sql
id                  BIGSERIAL PRIMARY KEY
call_id             TEXT NOT NULL REFERENCES calls(call_id)
tool_call_id        TEXT NOT NULL
tool_name           TEXT NOT NULL
score               SMALLINT NOT NULL                      -- 1, 2, 3
reasoning           TEXT
scored_at           TIMESTAMPTZ DEFAULT NOW()
UNIQUE (call_id, tool_call_id)
```

**`issues`** — all flagged issues across dimensions
```sql
id                  BIGSERIAL PRIMARY KEY
call_id             TEXT NOT NULL REFERENCES calls(call_id)
dimension           TEXT NOT NULL
issue_type          TEXT NOT NULL                          -- WRONG_VEHICLE_INFO | MISSED_APPOINTMENT_OPPORTUNITY | IGNORED_TOOL_GUIDANCE | ...
severity            TEXT NOT NULL                          -- warning | critical
turn_number         INTEGER
evidence            JSONB NOT NULL                         -- structured per issue type
detected_at         TIMESTAMPTZ DEFAULT NOW()
```

**`call_overall_scores`** — denormalized for dashboard perf
```sql
call_id             TEXT PRIMARY KEY REFERENCES calls(call_id)
overall_score       REAL NOT NULL                          -- 1.0 to 3.0
calculation         TEXT NOT NULL                          -- human-readable formula trace
critical_count      INTEGER NOT NULL DEFAULT 0
warning_count       INTEGER NOT NULL DEFAULT 0
recommendation      TEXT                                   -- PASS | PASS_WITH_ISSUES | REVIEW | FAIL
scored_at           TIMESTAMPTZ DEFAULT NOW()
```

### Batch-level outputs

**`batch_runs`**
```sql
batch_id            TEXT PRIMARY KEY                       -- 'daily_2026-04-08' | 'weekly_2026-W15'
period_start        TIMESTAMPTZ NOT NULL
period_end          TIMESTAMPTZ NOT NULL
calls_evaluated     INTEGER NOT NULL
average_score       REAL
median_score        REAL
stats               JSONB                                  -- score distribution, tool breakdowns
ran_at              TIMESTAMPTZ DEFAULT NOW()
```

**`capability_gaps`** — recurring patterns surfaced by aggregator
```sql
id                  BIGSERIAL PRIMARY KEY
batch_id            TEXT NOT NULL REFERENCES batch_runs(batch_id)
gap_type            TEXT NOT NULL                          -- agent_behavior | tool_failure_handling | ...
pattern             TEXT NOT NULL
affected_calls      TEXT[] NOT NULL
recommendation      TEXT
surfaced_at         TIMESTAMPTZ DEFAULT NOW()
```

### Indexes

```sql
CREATE INDEX idx_calls_agent         ON calls(agent_name);
CREATE INDEX idx_calls_start_time    ON calls(call_start_time);
CREATE INDEX idx_messages_call       ON messages(call_id, turn);
CREATE INDEX idx_tool_events_call    ON tool_events(call_id);
CREATE INDEX idx_tool_events_tool    ON tool_events(tool_name);
CREATE INDEX idx_scores_dimension    ON dimension_scores(dimension, score);
CREATE INDEX idx_scores_scored_at    ON dimension_scores(scored_at);
CREATE INDEX idx_issues_type         ON issues(issue_type, severity);
CREATE INDEX idx_issues_detected_at  ON issues(detected_at);
CREATE INDEX idx_overall_scored_at   ON call_overall_scores(scored_at);
```

### Dashboard-friendly views (add as needed in Phase 4)

- `vw_agent_weekly_summary` — avg score by agent × week
- `vw_issue_frequency` — issue counts by type × period
- `vw_tool_health` — avg tool score + error rate by tool_name

---

## Architecture flow

```
     calls.db (or calls_json/)                       Supabase Postgres
          │                                                 ▲
          ▼                                                 │
┌─────────────────────────┐                                 │
│  context_builder.py     │  Phase 1                        │
│  DataSource → JSON      │                                 │
└────────────┬────────────┘                                 │
             │                                              │
             ▼                                              │
┌─────────────────────────┐                                 │
│  latency.py             │  Phase 1                        │
│  attach timing metrics  │                                 │
└────────────┬────────────┘                                 │
             │                                              │
             ▼                                              │
┌─────────────────────────┐                                 │
│  call-classifier        │  Phase 2  (gpt-4o-mini)         │
│  picks 1 of 6 types     │                                 │
└────────────┬────────────┘                                 │
             │                                              │
     ┌───────┼───────┬─────────┬─────────┐                  │
     ▼       ▼       ▼         ▼         ▼                  │
   Info    Conv.   Tool    Escalation  Conv.                │
   Acc.    Conv    Acc.    Handling    Quality              │
                   (5 OpenAI judges, parallel async)        │
                        │                                   │
                        ▼                                   │
              ┌──────────────────┐                          │
              │  aggregator.py   │  Phase 3                 │
              │  renormalize N/A │                          │
              │  weighted avg    │                          │
              │  merge issues    │                          │
              └────────┬─────────┘                          │
                       │                                    │
                       └────── writes all outputs ──────────┘

                          Supabase (single source of truth)
                                      │
                                      ▼
                          Custom web dashboard (Phase 4)
```

---

## Folder structure (build progressively)

```
/
├── calls.db                              ← source data (Phase 1, read-only)
├── calls_json/                           ← alt source (read-only)
├── specs/                                ← raw eval rubric MDs (reference)
│   ├── eval-spec.md
│   ├── eval-prompt-information-accuracy.md
│   ├── eval-prompt-conversion.md
│   ├── eval-prompt-tool-accuracy.md
│   ├── eval-prompt-escalation.md
│   └── eval-prompt-conversation-quality.md
├── prompts/                              ← Phase 2 (pre-built by user)
│   ├── call-classifier.md
│   ├── info-accuracy.md
│   ├── conversion.md
│   ├── tool-accuracy.md
│   ├── escalation.md
│   └── conversation-quality.md
├── src/
│   ├── __init__.py
│   ├── schemas.py                        ← Pydantic models + TypedDicts
│   ├── data_source.py                    ← DataSource protocol + SQLite/Supabase impls
│   ├── context_builder.py                ← Phase 1
│   ├── latency.py                        ← Phase 1
│   ├── supabase_client.py                ← Phase 1.5
│   ├── migrate_sqlite_to_supabase.py     ← Phase 1.5
│   ├── judges/                           ← Phase 2/3
│   │   ├── __init__.py
│   │   ├── base.py                       ← shared OpenAI client + helpers
│   │   ├── classifier.py
│   │   ├── info_accuracy.py
│   │   ├── conversion.py
│   │   ├── tool_accuracy.py
│   │   ├── escalation.py
│   │   └── conversation_quality.py
│   ├── orchestrator.py                   ← Phase 3
│   └── aggregator.py                     ← Phase 3
├── sql/
│   ├── 001_schema.sql                    ← Postgres table definitions
│   ├── 002_indexes.sql
│   └── 003_views.sql                     ← Phase 4
├── outputs/                              ← optional local JSON dumps for debugging
├── tests/
│   ├── fixtures/
│   └── test_context_builder.py
├── .env.example                          ← OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY
├── ARCHITECTURE.md                       ← this file
├── pyproject.toml
└── README.md
```

---

## Key design decisions (load-bearing)

1. **One judge per dimension, not one mega-judge.** Focused context, parallel execution, independent tuning. Each judge only sees its own rubric.

2. **Response Latency is programmatic, not LLM-judged.** Arithmetic on `time_ms` / `end_time_ms`. Computed in `latency.py`.

3. **Call classifier runs first.** Output gates which dimensions apply. Judges receive `call_type` in their context.

4. **Specs are reference material, not consumed by code.** The prompts will be pre-built by the user and delivered as finished files in a new `prompts/` folder. Claude Code's Phase 2 job is purely mechanical: wire each pre-built prompt into its corresponding `src/judges/<dimension>.py` module.

5. **N/A is a first-class score.** Aggregator renormalizes weights when dimensions are N/A.

6. **Context JSON is the contract.** Everything downstream consumes it. Data source can change without touching judges.

7. **DataSource is abstracted.** `src/data_source.py` defines a `Protocol`. `SQLiteDataSource` in Phase 1, `SupabaseDataSource` added in Phase 1.5. Context builder doesn't care which.

8. **OpenAI structured outputs for all judges.** Use `client.beta.chat.completions.parse()` with Pydantic `response_format`. Judges cannot return malformed JSON — the API enforces the schema. Eliminates a whole class of parser bugs.

9. **Async all the way.** Orchestrator uses `AsyncOpenAI` + `asyncio.gather()` to dispatch all judges in parallel per call. A batch of 76 calls should complete in minutes, not hours.

10. **Supabase is the single source of truth after Phase 1.5.** Raw call data + scores + issues all in one place. Dashboard reads from one source.

11. **No silent failures.** If data is missing, raise. If a judge returns invalid JSON (shouldn't happen with structured outputs), raise.

---

## Phase 1 scope — WHAT TO BUILD NOW

Pure data plumbing. **No LLM calls, no Supabase yet.** Read from SQLite, output context JSON to disk.

### 1.1 `src/schemas.py`

Pydantic models for structured outputs + TypedDicts for internal types:
- `ContextJSON` (internal shape)
- `Issue`, `DimensionScore`, `ToolScore`, `ClassificationResult` (Pydantic, for Phase 2 — define now)

### 1.2 `src/data_source.py`

```python
from typing import Protocol

class DataSource(Protocol):
    def get_call(self, call_id: str) -> dict: ...            # returns raw call JSON
    def list_call_ids(self) -> list[str]: ...

class SQLiteDataSource:
    def __init__(self, db_path: str): ...
    # implements Protocol
```

`SupabaseDataSource` added in Phase 1.5.

### 1.3 `src/context_builder.py`

**Input:** `call_id`, `DataSource` instance
**Output:** `ContextJSON` (with empty `latency_metrics`)

Requirements:
- Parse system prompt XML → structured `system_context`; keep raw XML as `raw_system_prompt`
- Number turns from 0 (system) upward
- Merge `tool_calls` + `tool_results` by `tool_call_id` → `tool_events`, attach to turn where `tool_calls` appeared
- Parse `arguments_json` / `result_json` into dicts (never leave as strings)
- Preserve timestamps as `_ms` integers

Public API: `build_context(call_id: str, source: DataSource) -> ContextJSON`

### 1.4 `src/latency.py`

**Input:** ContextJSON
**Output:** ContextJSON with `latency_metrics` populated

- Bot turn: `latency_ms = bot.time_ms - prev_user.end_time_ms`
- User turn: `dead_air_ms = user.time_ms - prev_bot.end_time_ms`
- Missing timestamps → return `{"format": "legacy"}` with empty arrays
- Flag `latency_ms > 6000` → `high_latency_turns`
- Flag `dead_air_ms > 12000` → `excessive_dead_air_turns`
- Median, max, full arrays

Public API: `compute_latency(context: ContextJSON) -> ContextJSON`

### 1.5 CLI entry point

```bash
python -m src.context_builder --call-id <id> --source sqlite --out <path.json>
```

### 1.6 Tests

`tests/test_context_builder.py`:
1. Happy path on call `019d6a86-8665-788e-a91b-8b9cf7247192` → 32 turns, 3 tool events
2. Fixture regression against `tests/fixtures/expected_019d6a86.json`
3. Missing timestamps → legacy flag

### Phase 1 acceptance

```bash
python -m src.context_builder \
  --call-id 019d6a86-8665-788e-a91b-8b9cf7247192 \
  --source sqlite \
  --out outputs/test_context.json

pytest tests/ -v
```

---

## Phase 1.5 scope — Supabase setup + migration

Set up Supabase, create schema, migrate raw call data, verify. **Still no LLM judges.**

### 1.5.1 Environment setup

- Create `.env` with `SUPABASE_URL`, `SUPABASE_KEY` (service-role key for admin writes), `OPENAI_API_KEY`
- Add `python-dotenv`, `supabase`, `psycopg[binary]` to dependencies
- `.env.example` committed; `.env` gitignored

### 1.5.2 `sql/001_schema.sql`

All 8 tables per [Postgres Schema](#postgres-schema-supabase). Run via Supabase SQL editor or `psql`.

### 1.5.3 `sql/002_indexes.sql`

All indexes per the schema section.

### 1.5.4 `src/supabase_client.py`

Thin wrapper around `supabase-py`. Single entry point for all writes/reads. Don't sprinkle Supabase calls across the codebase.

### 1.5.5 `src/migrate_sqlite_to_supabase.py`

One-shot script. Reads everything from `calls.db`, writes to Supabase in dependency order:
1. `calls`
2. `call_contexts`
3. `messages`
4. `tool_events` (merging `tool_calls` + `tool_results` from SQLite)

Idempotent — safe to re-run. Skips `word_confidence` and `sqlite_sequence`. Logs row counts at the end.

### 1.5.6 `SupabaseDataSource` implementation

Add to `src/data_source.py`. Context builder works unchanged.

### Phase 1.5 acceptance

```bash
# Run schema:
psql $SUPABASE_URL -f sql/001_schema.sql -f sql/002_indexes.sql

# Migrate:
python -m src.migrate_sqlite_to_supabase

# Verify — same context JSON from both sources:
python -m src.context_builder --call-id 019d6a86-... --source sqlite   --out /tmp/a.json
python -m src.context_builder --call-id 019d6a86-... --source supabase --out /tmp/b.json
diff /tmp/a.json /tmp/b.json   # should be empty
```

---

## Phase 2 scope — judges (one at a time)

Build and validate **one judge per iteration.** Recommended order:

1. **Call classifier** first (`gpt-4o-mini`) — prerequisite for all dimension judges
2. **Information Accuracy** — most mechanical (fact-checking), easiest to validate
3. **Tool Accuracy** — per-tool BARS, similar mechanics
4. **Escalation** — tool-error handling is the core
5. **Conversation Quality** — tone + pacing, more subjective
6. **Conversion** — most complex (6 call-type branches), save for last

Per-judge process:

For each dimension, load `prompts/<dimension>.md` as the OpenAI system prompt, pass the context JSON as the user message, parse the structured output via Pydantic response_format. No prompt authoring — the prompts are provided.
Note that prompt files follow a consistent template: a markdown file whose entire content is the system prompt for that judge.

1. Implement `src/judges/<dimension>.py` using OpenAI structured outputs:
   ```python
   from openai import AsyncOpenAI
   from src.schemas import DimensionScore
   
   async def judge(context: ContextJSON) -> DimensionScore:
       client = AsyncOpenAI()
       resp = await client.beta.chat.completions.parse(
           model="gpt-4o",
           messages=[
               {"role": "system", "content": load_prompt("info-accuracy")},
               {"role": "user", "content": format_context(context)},
           ],
           response_format=DimensionScore,
       )
       return resp.choices[0].message.parsed
   ```
2. Validate on 3-5 calls manually — score by hand, compare to judge output
3. Move to next dimension

---

## Phase 3 scope — orchestrator + aggregator + Supabase writes

### 3.1 `src/orchestrator.py`

```python
async def evaluate_call(call_id: str, source: DataSource) -> CallEvaluation:
    context = build_context(call_id, source)
    context = compute_latency(context)
    
    classification = await classify(context)
    context["call_type"] = classification.call_type
    
    # dispatch all 5 judges in parallel
    info_acc, conv, tool_acc, esc, conv_q = await asyncio.gather(
        info_accuracy_judge(context),
        conversion_judge(context),
        tool_accuracy_judge(context),
        escalation_judge(context),
        conversation_quality_judge(context),
    )
    
    return aggregate(context, classification, [info_acc, conv, tool_acc, esc, conv_q])
```

### 3.2 `src/aggregator.py`

- Renormalize weights for N/A dimensions
- Compute overall score (1.0–3.0)
- Merge all issues arrays
- Determine recommendation (PASS / PASS_WITH_ISSUES / REVIEW / FAIL) based on critical/warning counts

### 3.3 Write to Supabase

One write per output table, wrapped in a transaction per call so partial writes never pollute stats.

### 3.4 Batch runner

```bash
python -m src.orchestrator --all                        # score every unscored call
python -m src.orchestrator --call-id <id>               # score one
python -m src.orchestrator --since 2026-04-01 --batch   # weekly batch + capability gaps
```

### 3.5 Capability-gap surfacing

At end of batch: query `issues` grouped by `issue_type`, identify types appearing in ≥3 calls within the batch window. Write to `capability_gaps` with human-readable patterns + recommendations.

---

## Phase 4 preview — dashboard (don't build yet)

Custom web dashboard reading from Supabase. Tool choice deferred — decide when Phase 3 data is flowing.

Most likely: **Next.js + Supabase JS client** for direct real-time queries. If speed to value matters more than customization, **Retool** or **Metabase** off the shelf.

Dashboard views to prioritize:
- **Fleet health** — avg overall score + score distribution over time, filters by agent/dealership
- **Dimension heatmap** — rows = agents, columns = dimensions, cells = recent avg score
- **Issue leaderboard** — most frequent issue types this week, clickable to offending calls
- **Tool health** — per-tool avg score + error rate; flags tools being misused
- **Call drilldown** — pick a call → transcript with turn-linked issues inline, scores per dimension, tool events

---

## Non-goals (explicit)

- No streaming / realtime scoring in v1. Batch evaluation only.
- No word-level confidence analysis in v1.
- No auto-remediation (generating prompt fixes from gaps). Future workflow.
- No re-scoring of already-scored calls unless `--force` flag passed.
- No auth/RLS on Supabase in v1 — single-user scoring. Add Row-Level Security before opening the dashboard broadly.

---

## Tech stack

- Python 3.11+
- `openai>=1.40` — judges (supports `beta.chat.completions.parse`)
- `pydantic>=2` — structured output schemas
- `supabase>=2` + `psycopg[binary]` — Supabase writes; raw SQL when needed
- `python-dotenv` — env management
- `sqlite3` (stdlib) — Phase 1 local source
- `pytest`, `pytest-asyncio` — tests
- `ruff` — linting

**Models:**
- `gpt-4o-mini` — call classifier (simple classification, 10× cheaper than 4o)
- `gpt-4o` — all 5 dimension judges (rubric-following + structured outputs)
- Consider A/B'ing `o1` on Conversion later (most branching logic, may benefit from reasoning)

**Estimated cost per full scoring run (76 calls):**
- Classifier on gpt-4o-mini: ~$0.10
- 5 judges × gpt-4o × 76 calls @ ~8K context tokens each: ~$15–25
- Output tokens negligible
- **Total: ~$15–25 per full fleet run**

---

## Working style

- Commit after each phase milestone. Each commit runs cleanly end-to-end.
- Every public function: docstring with inputs, outputs, failure modes.
- JSON schemas in `src/schemas.py` using Pydantic (for structured outputs) + TypedDict (for internal types).
- No silent failures. Raise on missing data.
- Test fixtures in `tests/fixtures/` — regenerate explicitly.
- Secrets in `.env`, never committed. `.env.example` checked in.
- Supabase writes always in transactions (per-call atomicity).

---

## Reference call for manual testing

**Call ID:** `019d6a86-8665-788e-a91b-8b9cf7247192`

- Agent: Emily Carter (Wolf Chase Honda)
- 32 messages, 3 tool calls
- Customer called wrong dealer (looking for Nissan)
- Transfer to sales returned `DEPARTMENT_CLOSED`; agent correctly pivoted to callback
- Known issues: "Still with me?" repeated, "It's taking longer than expected" leaked to customer
- Exercises multiple dimensions — use for every phase smoke test
