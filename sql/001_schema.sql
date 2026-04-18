CREATE TABLE calls (
    call_id             TEXT PRIMARY KEY,
    enterprise_id       TEXT,
    team_id             TEXT,
    agent_name          TEXT,
    agent_type          TEXT,
    call_type_raw       TEXT,
    ended_reason        TEXT,
    call_start_time     TIMESTAMPTZ,
    call_end_time       TIMESTAMPTZ,
    duration_ms         INTEGER,
    total_messages      INTEGER,
    source_file         TEXT,
    ingested_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE call_contexts (
    call_id                         TEXT PRIMARY KEY REFERENCES calls(call_id),
    dealership_name                 TEXT,
    dealership_address              TEXT,
    dealership_inventory_type       TEXT,
    dealership_sales_hours          JSONB,
    dealership_service_hours        JSONB,
    customer_name                   TEXT,
    customer_phone                  TEXT,
    customer_email                  TEXT,
    customer_city                   TEXT,
    customer_state                  TEXT,
    interested_vehicle              JSONB,
    trade_in                        JSONB,
    context_datetime                TIMESTAMPTZ,
    raw_system_prompt               TEXT,
    formatted_transcript            TEXT
);

CREATE TABLE messages (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             TEXT NOT NULL REFERENCES calls(call_id),
    turn                INTEGER NOT NULL,
    role                TEXT NOT NULL,
    message             TEXT,
    time_ms             BIGINT,
    end_time_ms         BIGINT,
    duration_ms         INTEGER,
    seconds_from_start  REAL,
    UNIQUE (call_id, turn)
);

CREATE TABLE tool_events (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             TEXT NOT NULL REFERENCES calls(call_id),
    turn                INTEGER,
    tool_call_id        TEXT NOT NULL,
    tool_name           TEXT NOT NULL,
    args                JSONB NOT NULL,
    result              JSONB,
    had_error           BOOLEAN GENERATED ALWAYS AS (
                            result->>'success' = 'false'
                            OR result->>'status' LIKE '%FAILED%'
                            OR result->>'status' LIKE '%CLOSED%'
                        ) STORED,
    invoked_time_ms     BIGINT,
    result_time_ms      BIGINT,
    UNIQUE (call_id, tool_call_id)
);

CREATE TABLE call_classifications (
    call_id             TEXT PRIMARY KEY REFERENCES calls(call_id),
    call_type           TEXT NOT NULL,
    primary_intent      TEXT,
    reasoning           TEXT,
    model               TEXT,
    classified_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dimension_scores (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             TEXT NOT NULL REFERENCES calls(call_id),
    dimension           TEXT NOT NULL,
    score               SMALLINT,
    score_na            BOOLEAN NOT NULL DEFAULT FALSE,
    reasoning           TEXT,
    weight              REAL NOT NULL,
    model               TEXT,
    scored_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (call_id, dimension)
);

CREATE TABLE tool_scores (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             TEXT NOT NULL REFERENCES calls(call_id),
    tool_call_id        TEXT NOT NULL,
    tool_name           TEXT NOT NULL,
    score               SMALLINT NOT NULL,
    reasoning           TEXT,
    scored_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (call_id, tool_call_id)
);

CREATE TABLE issues (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             TEXT NOT NULL REFERENCES calls(call_id),
    dimension           TEXT NOT NULL,
    issue_type          TEXT NOT NULL,
    severity            TEXT NOT NULL,
    turn_number         INTEGER,
    evidence            JSONB NOT NULL,
    detected_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE call_overall_scores (
    call_id             TEXT PRIMARY KEY REFERENCES calls(call_id),
    overall_score       REAL NOT NULL,
    calculation         TEXT NOT NULL,
    critical_count      INTEGER NOT NULL DEFAULT 0,
    warning_count       INTEGER NOT NULL DEFAULT 0,
    recommendation      TEXT,
    scored_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE batch_runs (
    batch_id            TEXT PRIMARY KEY,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    calls_evaluated     INTEGER NOT NULL,
    average_score       REAL,
    median_score        REAL,
    stats               JSONB,
    ran_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE capability_gaps (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            TEXT NOT NULL REFERENCES batch_runs(batch_id),
    gap_type            TEXT NOT NULL,
    pattern             TEXT NOT NULL,
    affected_calls      TEXT[] NOT NULL,
    recommendation      TEXT,
    surfaced_at         TIMESTAMPTZ DEFAULT NOW()
);
