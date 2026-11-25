import type { FhirJson, PgExecutor } from "../fhir/resource-store.js";
import type { PatientMini } from "../fhir/patient-match-score.js";

export type PatientDuplicateGroup = {
  system: string;
  value: string;
  patientLogicalIds: string[];
};

export type PatientLinkRow = {
  id: string;
  leftPatientLogicalId: string;
  rightPatientLogicalId: string;
  linkType: string;
  matchRule: string | null;
  createdAt: string;
};

const LINK_TYPES = new Set(["replaced-by", "see-also", "duplicate"]);

export function normalizePatientPair(
  a: string,
  b: string,
): { left: string; right: string } | null {
  if (a === b) return null;
  return a < b ? { left: a, right: b } : { left: b, right: a };
}

export function isPatientLinkType(v: string): boolean {
  return LINK_TYPES.has(v);
}

export async function findPatientDuplicateCandidates(
  pool: PgExecutor,
  tenantUuid: string,
  opts?: { limit?: number },
): Promise<PatientDuplicateGroup[]> {
  const limit =
    typeof opts?.limit === "number" && opts.limit > 0
      ? Math.min(opts.limit, 500)
      : 200;
  const r = await pool.query<{
    system: string;
    value: string;
    patient_logical_ids: string[];
  }>(
    `WITH ids AS (
       SELECT
         fr.logical_id,
         NULLIF(trim(elem->>'system'), '') AS sys,
         NULLIF(trim(elem->>'value'), '') AS val
       FROM fhir_resource fr,
       LATERAL jsonb_array_elements(COALESCE(fr.data->'identifier', '[]'::jsonb)) elem
       WHERE fr.tenant_id = $1::uuid
         AND fr.resource_type = 'Patient'
         AND NOT fr.deleted
     ),
     crowded AS (
       SELECT sys, val, array_agg(logical_id ORDER BY logical_id) AS patient_logical_ids
       FROM ids
       WHERE sys IS NOT NULL AND val IS NOT NULL
       GROUP BY sys, val
       HAVING count(*) > 1
     )
     SELECT sys AS system, val AS value, patient_logical_ids
     FROM crowded
     ORDER BY sys, val
     LIMIT $2::int`,
    [tenantUuid, limit],
  );
  return r.rows.map((row) => ({
    system: row.system,
    value: row.value,
    patientLogicalIds: row.patient_logical_ids,
  }));
}

export async function insertPatientLink(
  pool: PgExecutor,
  tenantUuid: string,
  left: string,
  right: string,
  linkType: string,
  matchRule: string | null,
): Promise<{ id: string; createdAt: string }> {
  const r = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO patient_link (
       tenant_id, left_patient_logical_id, right_patient_logical_id, link_type, match_rule
     )
     VALUES ($1::uuid, $2, $3, $4, $5)
     RETURNING id::text, created_at`,
    [tenantUuid, left, right, linkType, matchRule],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("insertPatientLink: no row returned");
  }
  return { id: row.id, createdAt: row.created_at.toISOString() };
}

export async function listPatientLinks(
  pool: PgExecutor,
  tenantUuid: string,
): Promise<PatientLinkRow[]> {
  const r = await pool.query<{
    id: string;
    left_patient_logical_id: string;
    right_patient_logical_id: string;
    link_type: string;
    match_rule: string | null;
    created_at: Date;
  }>(
    `SELECT id::text, left_patient_logical_id, right_patient_logical_id,
            link_type, match_rule, created_at
     FROM patient_link
     WHERE tenant_id = $1::uuid
     ORDER BY created_at DESC`,
    [tenantUuid],
  );
  return r.rows.map((row) => ({
    id: row.id,
    leftPatientLogicalId: row.left_patient_logical_id,
    rightPatientLogicalId: row.right_patient_logical_id,
    linkType: row.link_type,
    matchRule: row.match_rule,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function patientResourceExists(
  pool: PgExecutor,
  tenantUuid: string,
  logicalId: string,
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = 'Patient'
       AND logical_id = $2 AND NOT deleted`,
    [tenantUuid, logicalId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function recordIdImportMap(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  sourceLogicalId: string,
  targetLogicalId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO fhir_id_import_map (tenant_id, resource_type, source_logical_id, target_logical_id)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (tenant_id, resource_type, source_logical_id)
     DO UPDATE SET target_logical_id = EXCLUDED.target_logical_id, imported_at = NOW()`,
    [tenantUuid, resourceType, sourceLogicalId, targetLogicalId],
  );
}

/** Birth-date groups with two or more live Patients (for probabilistic blocking). */
export async function loadBirthDateBlockingGroups(
  pool: PgExecutor,
  tenantUuid: string,
): Promise<Map<string, PatientMini[]>> {
  const r = await pool.query<{
    logical_id: string;
    data: FhirJson;
    bd: string | null;
  }>(
    `SELECT logical_id, data, data->>'birthDate' AS bd
     FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = 'Patient' AND NOT deleted
       AND data->>'birthDate' IS NOT NULL AND trim(data->>'birthDate') <> ''`,
    [tenantUuid],
  );
  const m = new Map<string, PatientMini[]>();
  for (const row of r.rows) {
    const bd = row.bd?.trim() ?? "";
    if (!bd) continue;
    const list = m.get(bd) ?? [];
    list.push({ logicalId: row.logical_id, data: row.data });
    m.set(bd, list);
  }
  const out = new Map<string, PatientMini[]>();
  for (const [bd, list] of m) {
    if (list.length > 1) out.set(bd, list);
  }
  return out;
}

export async function fetchLivePatientsByIds(
  pool: PgExecutor,
  tenantUuid: string,
  ids: string[],
): Promise<PatientMini[]> {
  if (ids.length === 0) return [];
  const r = await pool.query<{ logical_id: string; data: FhirJson }>(
    `SELECT logical_id, data FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = 'Patient' AND NOT deleted
       AND logical_id = ANY($2::text[])`,
    [tenantUuid, ids],
  );
  return r.rows.map((row) => ({
    logicalId: row.logical_id,
    data: row.data,
  }));
}
