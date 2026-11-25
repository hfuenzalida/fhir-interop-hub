-- GAP 2: PKCE on auth codes, optional public OAuth clients, refresh tokens

ALTER TABLE oauth_client
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE oauth_authorization_code
  ADD COLUMN IF NOT EXISTS code_challenge TEXT,
  ADD COLUMN IF NOT EXISTS code_challenge_method TEXT,
  ADD COLUMN IF NOT EXISTS nonce TEXT;

COMMENT ON COLUMN oauth_client.is_public IS 'PKCE-only confidential-less clients (native/public SMART apps).';

CREATE TABLE IF NOT EXISTS oauth_refresh_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  launch_id UUID REFERENCES smart_launch_context (id) ON DELETE SET NULL,
  patient_id TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_from_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_refresh_token_lookup
  ON oauth_refresh_token (token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS oauth_refresh_token_client
  ON oauth_refresh_token (client_id, tenant_id);

COMMENT ON TABLE oauth_refresh_token IS 'Opaque refresh tokens (hash stored); rotation via rotated_from_hash.';
