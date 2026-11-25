-- GAP 7: MPI-style patient links and optional NDJSON import id remapping

CREATE TABLE IF NOT EXISTS patient_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  left_patient_logical_id TEXT NOT NULL,
  right_patient_logical_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (
    link_type IN ('replaced-by', 'see-also', 'duplicate')
  ),
  match_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_link_ordered CHECK (left_patient_logical_id < right_patient_logical_id),
  CONSTRAINT patient_link_distinct CHECK (left_patient_logical_id <> right_patient_logical_id),
  UNIQUE (tenant_id, left_patient_logical_id, right_patient_logical_id)
);

CREATE INDEX IF NOT EXISTS patient_link_tenant ON patient_link (tenant_id);

COMMENT ON TABLE patient_link IS
  'MPI/dedup edges between Patient logical ids; deterministic ordering of pair.';

-- Tracks source logical ids from a bulk import so references can be rewritten in a second pass
CREATE TABLE IF NOT EXISTS fhir_id_import_map (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  source_logical_id TEXT NOT NULL,
  target_logical_id TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resource_type, source_logical_id)
);

CREATE INDEX IF NOT EXISTS fhir_id_import_map_tenant ON fhir_id_import_map (tenant_id);

COMMENT ON TABLE fhir_id_import_map IS
  'Maps exported logical ids to tenant-local ids after NDJSON import (onboarding / migration).';
