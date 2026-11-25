-- Phase 1: tenants, API keys (SHA-256), FHIR resources (JSONB, per-tenant isolation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-entropy keys only; store SHA-256 hex (64 chars) for indexed lookup
CREATE TABLE IF NOT EXISTS api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_key_tenant ON api_key (tenant_id);

CREATE TABLE IF NOT EXISTS fhir_resource (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  logical_id TEXT NOT NULL,
  version_id INT NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow re-create after soft-delete: uniqueness only among live rows
CREATE UNIQUE INDEX IF NOT EXISTS fhir_resource_active_logical
  ON fhir_resource (tenant_id, resource_type, logical_id)
  WHERE NOT deleted;

CREATE INDEX IF NOT EXISTS fhir_resource_tenant_type_live
  ON fhir_resource (tenant_id, resource_type)
  WHERE NOT deleted;

CREATE INDEX IF NOT EXISTS fhir_resource_data_gin ON fhir_resource USING gin (data jsonb_path_ops);

COMMENT ON TABLE fhir_resource IS 'Phase 1 store; US Core validation added in CI/Phase 5.';
