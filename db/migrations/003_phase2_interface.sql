-- Phase 2: connector runs, dead-letter visibility, KPI-friendly aggregates
CREATE TABLE IF NOT EXISTS interface_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  connector TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'success', 'failed')),
  raw_sha256 TEXT,
  raw_preview TEXT,
  error TEXT,
  outcome JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS interface_message_tenant_created
  ON interface_message (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS interface_message_tenant_status
  ON interface_message (tenant_id, status, created_at DESC);

COMMENT ON TABLE interface_message IS 'Ingestion / interface runs; raw_preview truncated; use raw_sha256 for dedup hints.';
