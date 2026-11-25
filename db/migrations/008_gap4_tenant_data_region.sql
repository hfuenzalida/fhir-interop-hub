-- GAP 4: optional tenant data residency / region label for contracts and audit narratives
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS data_region TEXT;

COMMENT ON COLUMN tenant.data_region IS 'Optional region label (e.g. us-east-1, EU) for residency / DPA mapping; not enforced by the API alone.';
