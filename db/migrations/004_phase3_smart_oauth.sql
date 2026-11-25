-- Phase 3: SMART-style OAuth clients + launch context + auth codes

CREATE TABLE IF NOT EXISTS oauth_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_client_tenant ON oauth_client (tenant_id);

CREATE TABLE IF NOT EXISTS smart_launch_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS smart_launch_exp ON smart_launch_context (expires_at);

CREATE TABLE IF NOT EXISTS oauth_authorization_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  launch_id UUID REFERENCES smart_launch_context (id) ON DELETE SET NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Demo confidential client (secret: demo-smart-secret — change in production)
INSERT INTO oauth_client (tenant_id, client_id, client_secret_hash, redirect_uris, name)
SELECT t.id,
       'demo-smart-app',
       'dab4fddf8ad62281a786d81aafd97fb70f3aa50eb9d46a5ad245a7f210150d9e',
       ARRAY[
         'http://127.0.0.1:4200/callback',
         'http://localhost:4200/callback'
       ]::text[],
       'Demo SMART app (dev)'
FROM tenant t
WHERE t.external_key = 'dev-tenant-001'
ON CONFLICT (client_id) DO NOTHING;

COMMENT ON TABLE oauth_client IS 'SMART confidential clients per tenant; secret stored as SHA-256 hex.';
COMMENT ON TABLE smart_launch_context IS 'Opaque launch parameter resolved before /authorize.';
