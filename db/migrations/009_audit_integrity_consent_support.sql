-- GAP 4+: tamper-evident per-tenant audit chain + append-only enforcement (WORM at DB layer)

-- Chain head: one row per tenant_id (matches audit_event.tenant_id text keying)
CREATE TABLE IF NOT EXISTS audit_chain_head (
  tenant_id TEXT PRIMARY KEY,
  last_event_id UUID NOT NULL,
  last_row_hash TEXT NOT NULL
);

COMMENT ON TABLE audit_chain_head IS 'Latest audit chain link per tenant; updated in the same transaction as each audit_event insert.';

ALTER TABLE audit_event
  ADD COLUMN IF NOT EXISTS chain_prev_id UUID,
  ADD COLUMN IF NOT EXISTS entry_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_hash TEXT;

COMMENT ON COLUMN audit_event.chain_prev_id IS 'Previous event in the integrity chain (same tenant); NULL for first event.';
COMMENT ON COLUMN audit_event.entry_hash IS 'SHA-256 hex of canonical audit payload (without chain fields).';
COMMENT ON COLUMN audit_event.row_hash IS 'Chained integrity hash (HMAC-SHA256 when AUDIT_CHAIN_SECRET is set in app, else SHA-256 link).';

DO $$
BEGIN
  ALTER TABLE audit_event
    ADD CONSTRAINT audit_event_chain_prev_fk
    FOREIGN KEY (chain_prev_id) REFERENCES audit_event (id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION audit_event_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_event rows are append-only (immutable)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_event_append_only ON audit_event;
CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW
  EXECUTE PROCEDURE audit_event_reject_mutation();

COMMENT ON TRIGGER audit_event_append_only ON audit_event IS 'WORM-style guarantee: prevents UPDATE/DELETE even if application misconfigures GRANTs.';
