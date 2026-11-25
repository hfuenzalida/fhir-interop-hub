-- Append-only audit store (no UPDATE/DELETE via application role in production)
CREATE TABLE IF NOT EXISTS audit_event (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor JSONB NOT NULL,
  entity JSONB NOT NULL,
  api JSONB NOT NULL,
  network JSONB,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS audit_event_tenant_time
  ON audit_event (tenant_id, timestamp DESC);

COMMENT ON TABLE audit_event IS 'Tamper-evident operational trail; align with ONC audit expectations for certified-adjacent hub.';
