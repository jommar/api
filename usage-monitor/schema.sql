-- Applied once by src/db.ts, while PRAGMA user_version is 0.

CREATE TABLE session (
  id         TEXT PRIMARY KEY,
  started_ts INTEGER NOT NULL,
  last_ts    INTEGER NOT NULL,
  cwd        TEXT
) STRICT;

CREATE INDEX session_started_ts ON session (started_ts);

CREATE TABLE agent (
  session TEXT NOT NULL,
  agent   TEXT NOT NULL,
  label   TEXT NOT NULL DEFAULT '',
  model   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (session, agent)
) STRICT;

CREATE TABLE usage_event (
  event_id    TEXT NOT NULL UNIQUE,
  session     TEXT NOT NULL,
  agent       TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  model       TEXT NOT NULL,
  input       INTEGER NOT NULL,
  output      INTEGER NOT NULL,
  cache_read  INTEGER NOT NULL,
  cache_write INTEGER NOT NULL,
  cost_usd    REAL
) STRICT;

CREATE INDEX usage_event_session ON usage_event (session, agent);
CREATE INDEX usage_event_ts ON usage_event (ts);

CREATE TABLE tool_call (
  event_id TEXT NOT NULL UNIQUE,
  session  TEXT NOT NULL,
  agent    TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  tool     TEXT NOT NULL
) STRICT;

CREATE INDEX tool_call_session ON tool_call (session, agent);
CREATE INDEX tool_call_ts ON tool_call (ts);

-- `agent` and `session` events are state upserts and keep no row of their own;
-- their ids are remembered here so a retried batch reports them as duplicates too.
CREATE TABLE state_event (
  event_id TEXT PRIMARY KEY
) STRICT, WITHOUT ROWID;

PRAGMA user_version = 1;
