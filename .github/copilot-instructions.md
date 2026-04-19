# Project Guidelines

## Code Style
Python code follows standard practices with ruff for linting. Reference `src/judges/_base.py` for async patterns and `src/schemas.py` for Pydantic models.

## Architecture
QC scoring pipeline for AI voice-agent sales calls with two parallel tracks: technical (6 correctness dimensions) and behavioral (6 SDR-performance dimensions). Key load-bearing decisions: Context JSON contract, DataSource abstraction, OpenAI structured outputs with Pydantic response_format, async parallel judges.

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design spec and data flow.

## Build and Test
Essential commands (agents run these automatically):
- Full pipeline: `python3 -m src.orchestrator --all`
- Single call: `python3 -m src.orchestrator --call-id <id>`
- Tests: `pytest tests/ -v`
- Linting: `ruff check src/ tests/`

## Conventions
Project-specific patterns:
- Async judges with `asyncio.gather` for parallelism
- N/A renormalization in aggregation (never hardcode denominators)
- Issue evidence as string (OpenAI strict mode disallows dicts)
- Supabase upserts always include `on_conflict` for idempotency
- Behavioral-only path uses UPDATE (not upsert) on overall scores

See [CLAUDE.md](CLAUDE.md) for detailed commands, quirks, and known pitfalls.