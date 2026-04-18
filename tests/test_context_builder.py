import pytest
import json
import os
from src.context_builder import build_context
from src.latency import compute_latency
from src.data_source import SQLiteDataSource

@pytest.fixture
def sqlite_source():
    # tests usually run from the project root
    db_path = "calls.db"
    if not os.path.exists(db_path):
        pytest.skip("calls.db not found. Run etl.py first.")
    return SQLiteDataSource(db_path)

def test_context_builder_happy_path(sqlite_source):
    call_id = "019d6a86-8665-788e-a91b-8b9cf7247192"
    ctx = build_context(call_id, sqlite_source)
    ctx = compute_latency(ctx)
    
    assert ctx["call_id"] == call_id
    assert len(ctx["transcript"]) == 32
    # Verify tool events
    assert len(ctx["tool_events"]) == 3
    assert "latency_metrics" in ctx
    
    metrics = ctx["latency_metrics"]
    # Check if there are latency metrics extracted
    if metrics.get("format") != "legacy":
        assert len(metrics["agent_latencies_ms"]) > 0
        assert "median_agent_latency_ms" in metrics
        
def test_context_builder_fixture_regression(sqlite_source):
    call_id = "019d6a86-8665-788e-a91b-8b9cf7247192"
    ctx = build_context(call_id, sqlite_source)
    ctx = compute_latency(ctx)
    
    # We will look for an exact fixture
    base_id = call_id.split('-')[0]
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", f"expected_{base_id}.json")
    
    if not os.path.exists(fixture_path):
        pytest.skip(f"Golden fixture {fixture_path} not found.")
        
    with open(fixture_path, "r") as f:
        expected = json.load(f)
        
    assert ctx == expected
