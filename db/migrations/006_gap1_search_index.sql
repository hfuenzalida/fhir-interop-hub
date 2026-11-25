-- GAP 1: speed up search sorted by last_updated (tenant + type + time)
CREATE INDEX IF NOT EXISTS fhir_resource_tenant_type_updated
  ON fhir_resource (tenant_id, resource_type, last_updated DESC)
  WHERE NOT deleted;
