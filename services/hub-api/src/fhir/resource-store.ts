import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { LastUpdatedFilter } from "./query-params.js";

/** Pool or client connection — supports running writes inside an explicit DB transaction. */
export type PgExecutor = pg.Pool | pg.PoolClient;

/** Thrown when `If-Match` does not match current `version_id`. */
export class IfMatchFailedError extends Error {
  constructor() {
    super("If-Match version mismatch");
    this.name = "IfMatchFailedError";
  }
}

function appendLastUpdatedWhere(
  cond: string[],
  args: unknown[],
  startIdx: number,
  lu?: LastUpdatedFilter,
): number {
  let p = startIdx;
  if (!lu) return p;
  if (lu.ge) {
    cond.push(`last_updated >= $${p}::timestamptz`);
    args.push(lu.ge);
    p++;
  }
  if (lu.gt) {
    cond.push(`last_updated > $${p}::timestamptz`);
    args.push(lu.gt);
    p++;
  }
  if (lu.lt) {
    cond.push(`last_updated < $${p}::timestamptz`);
    args.push(lu.lt);
    p++;
  }
  if (lu.le) {
    cond.push(`last_updated <= $${p}::timestamptz`);
    args.push(lu.le);
    p++;
  }
  return p;
}

export type FhirJson = Record<string, unknown>;

/** `Consent.patient` resolves to `Patient/{id}`. */
export function patientReferenceMatches(
  resource: FhirJson,
  patientLogicalId: string,
): boolean {
  const p = resource.patient;
  if (!p || typeof p !== "object") return false;
  const ref = (p as { reference?: unknown }).reference;
  if (typeof ref !== "string") return false;
  const tail = `Patient/${patientLogicalId}`;
  return ref === tail || ref.endsWith(`/${tail}`);
}

/** `subject.reference` resolves to `Patient/{id}` (Observation, Condition, Encounter, DocumentReference). */
export function subjectReferencesPatient(
  resource: FhirJson,
  patientLogicalId: string,
): boolean {
  const subj = resource.subject;
  if (!subj || typeof subj !== "object") return false;
  const ref = (subj as { reference?: unknown }).reference;
  if (typeof ref !== "string") return false;
  const tail = `Patient/${patientLogicalId}`;
  return ref === tail || ref.endsWith(`/${tail}`);
}

/** Alias for {@link subjectReferencesPatient}. */
export function observationReferencesPatient(
  obs: FhirJson,
  patientLogicalId: string,
): boolean {
  return subjectReferencesPatient(obs, patientLogicalId);
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureMeta(
  data: FhirJson,
  logicalId: string,
  versionId: number,
): FhirJson {
  const meta = (typeof data.meta === "object" && data.meta !== null
    ? (data.meta as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    ...data,
    id: logicalId,
    meta: {
      ...meta,
      versionId: String(versionId),
      lastUpdated: nowIso(),
    },
  };
}

export async function readResource(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  logicalId: string,
): Promise<FhirJson | null> {
  const r = await pool.query<{ data: FhirJson }>(
    `SELECT data FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted`,
    [tenantUuid, resourceType, logicalId],
  );
  return r.rows[0]?.data ?? null;
}

export async function createResource(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  body: FhirJson,
): Promise<{ resource: FhirJson; created: boolean }> {
  const logicalId =
    typeof body.id === "string" && body.id.length > 0 ? body.id : randomUUID();
  const versionId = 1;
  const withMeta = ensureMeta({ ...body, resourceType }, logicalId, versionId);
  await pool.query(
    `INSERT INTO fhir_resource (tenant_id, resource_type, logical_id, version_id, data, deleted, last_updated)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb, false, NOW())`,
    [tenantUuid, resourceType, logicalId, versionId, JSON.stringify(withMeta)],
  );
  return { resource: withMeta, created: true };
}

export async function upsertResource(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  logicalId: string,
  body: FhirJson,
  opts?: { ifMatch?: string | null },
): Promise<{ resource: FhirJson; created: boolean }> {
  const existing = await pool.query<{ version_id: number }>(
    `SELECT version_id FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted
     FOR UPDATE`,
    [tenantUuid, resourceType, logicalId],
  );
  if (existing.rows.length === 0) {
    const versionId = 1;
    const withMeta = ensureMeta(
      { ...body, resourceType, id: logicalId },
      logicalId,
      versionId,
    );
    await pool.query(
      `INSERT INTO fhir_resource (tenant_id, resource_type, logical_id, version_id, data, deleted, last_updated)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, false, NOW())`,
      [tenantUuid, resourceType, logicalId, versionId, JSON.stringify(withMeta)],
    );
    return { resource: withMeta, created: true };
  }
  const currentVid = existing.rows[0].version_id;
  if (opts?.ifMatch) {
    const raw = opts.ifMatch.trim().replace(/^W\//i, "").replace(/^"+|"+$/g, "");
    if (raw !== String(currentVid)) {
      throw new IfMatchFailedError();
    }
  }
  const nextVid = currentVid + 1;
  const withMeta = ensureMeta(
    { ...body, resourceType, id: logicalId },
    logicalId,
    nextVid,
  );
  await pool.query(
    `UPDATE fhir_resource
     SET version_id = $4, data = $5::jsonb, last_updated = NOW()
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted`,
    [tenantUuid, resourceType, logicalId, nextVid, JSON.stringify(withMeta)],
  );
  return { resource: withMeta, created: false };
}

export async function softDeleteResource(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  logicalId: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE fhir_resource SET deleted = true, last_updated = NOW()
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted`,
    [tenantUuid, resourceType, logicalId],
  );
  return (r.rowCount ?? 0) > 0;
}

export type RestoreSoftDeleteResult =
  | "ok"
  | "not_found"
  | "not_deleted"
  | "conflict_live_row";

/**
 * Restores a soft-deleted row. Fails with `conflict_live_row` if a live
 * resource already exists for the same tenant/type/logical id (re-create
 * after delete).
 */
export async function restoreSoftDeletedResource(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  logicalId: string,
): Promise<RestoreSoftDeleteResult> {
  const live = await pool.query(
    `SELECT 1 FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted`,
    [tenantUuid, resourceType, logicalId],
  );
  if ((live.rowCount ?? 0) > 0) {
    return "conflict_live_row";
  }
  const r = await pool.query(
    `UPDATE fhir_resource SET deleted = false, last_updated = NOW()
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND deleted`,
    [tenantUuid, resourceType, logicalId],
  );
  if ((r.rowCount ?? 0) > 0) {
    return "ok";
  }
  const any = await pool.query<{ deleted: boolean }>(
    `SELECT deleted FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3`,
    [tenantUuid, resourceType, logicalId],
  );
  if (any.rows.length === 0) {
    return "not_found";
  }
  return "not_deleted";
}

export async function searchByIds(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  ids: string[],
): Promise<FhirJson[]> {
  if (ids.length === 0) return [];
  const r = await pool.query<{ data: FhirJson }>(
    `SELECT data FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND NOT deleted
       AND logical_id = ANY($3::text[])`,
    [tenantUuid, resourceType, ids],
  );
  return r.rows.map((row) => row.data);
}

export type SearchPatientParams = {
  ids?: string[];
  name?: string;
  birthdate?: string;
  identifier?: string;
  gender?: string;
  lastUpdated?: LastUpdatedFilter;
  sortLastUpdated?: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function searchPatients(
  pool: PgExecutor,
  tenantUuid: string,
  params: SearchPatientParams,
): Promise<{ rows: FhirJson[]; total: number }> {
  const cond: string[] = [
    "tenant_id = $1::uuid",
    "resource_type = 'Patient'",
    "NOT deleted",
  ];
  const args: unknown[] = [tenantUuid];
  let p = 2;

  if (params.ids && params.ids.length > 0) {
    cond.push(`logical_id = ANY($${p}::text[])`);
    args.push(params.ids);
    p++;
  }
  if (params.birthdate) {
    cond.push(`data->>'birthDate' = $${p}`);
    args.push(params.birthdate);
    p++;
  }
  if (params.name) {
    cond.push(`data::text ILIKE $${p}`);
    args.push(`%${params.name}%`);
    p++;
  }
  if (params.gender) {
    cond.push(`data->>'gender' = $${p}`);
    args.push(params.gender);
    p++;
  }
  if (params.identifier) {
    const token = params.identifier;
    const pipe = token.indexOf("|");
    const sys = pipe >= 0 ? token.slice(0, pipe) : null;
    const val = pipe >= 0 ? token.slice(pipe + 1) : token;
    if (sys && val) {
      cond.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(data->'identifier','[]'::jsonb)) e WHERE e->>'system' = $${p} AND e->>'value' = $${p + 1})`,
      );
      args.push(sys, val);
      p += 2;
    } else {
      cond.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(data->'identifier','[]'::jsonb)) e WHERE e->>'value' = $${p})`,
      );
      args.push(val);
      p++;
    }
  }
  p = appendLastUpdatedWhere(cond, args, p, params.lastUpdated);

  const whereSql = cond.join(" AND ");
  const countQ = `SELECT COUNT(*)::int AS c FROM fhir_resource WHERE ${whereSql}`;
  const countR = await pool.query<{ c: number }>(countQ, args);
  const total = countR.rows[0]?.c ?? 0;

  const sortDir = params.sortLastUpdated === "asc" ? "ASC" : "DESC";
  const limitIdx = p;
  const offsetIdx = p + 1;
  const dataArgs = [...args, params.limit, params.offset];
  const dataQ = `
    SELECT data FROM fhir_resource
    WHERE ${whereSql}
    ORDER BY last_updated ${sortDir}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const dataR = await pool.query<{ data: FhirJson }>(dataQ, dataArgs);
  return { rows: dataR.rows.map((r) => r.data), total };
}

/** Patient compartment search via `subject.reference` → Patient/{id}. */
export type SearchWithSubjectParams = {
  limit: number;
  offset: number;
  lastUpdated?: LastUpdatedFilter;
  sortLastUpdated?: "asc" | "desc";
};

export async function searchResourcesWithPatientSubject(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  patientLogicalId: string,
  params: SearchWithSubjectParams,
): Promise<{ rows: FhirJson[]; total: number }> {
  const refExact = `Patient/${patientLogicalId}`;
  const cond = [
    "tenant_id = $1::uuid",
    "resource_type = $2",
    "NOT deleted",
    `(
      (data->'subject'->>'reference' = $3 OR data->'subject'->>'reference' LIKE $4)
      OR
      (data->'patient'->>'reference' = $3 OR data->'patient'->>'reference' LIKE $4)
    )`,
  ];
  const likePat = `%Patient/${patientLogicalId}`;
  const args: unknown[] = [tenantUuid, resourceType, refExact, likePat];
  const p = appendLastUpdatedWhere(cond, args, 5, params.lastUpdated);
  const whereSql = cond.join(" AND ");
  const countR = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM fhir_resource WHERE ${whereSql}`,
    args,
  );
  const total = countR.rows[0]?.c ?? 0;
  const sortDir = params.sortLastUpdated === "asc" ? "ASC" : "DESC";
  const limitIdx = p;
  const offsetIdx = p + 1;
  const dataR = await pool.query<{ data: FhirJson }>(
    `SELECT data FROM fhir_resource
     WHERE ${whereSql}
     ORDER BY last_updated ${sortDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...args, params.limit, params.offset],
  );
  return { rows: dataR.rows.map((r) => r.data), total };
}

export async function searchObservationsForPatient(
  pool: PgExecutor,
  tenantUuid: string,
  patientLogicalId: string,
  params: SearchWithSubjectParams,
): Promise<{ rows: FhirJson[]; total: number }> {
  return searchResourcesWithPatientSubject(
    pool,
    tenantUuid,
    "Observation",
    patientLogicalId,
    params,
  );
}

export type PatientEverythingEntry = {
  resourceType: string;
  resource: FhirJson;
};

/** Patient + compartment resources (subject → Patient); max `perTypeLimit` rows per companion type. */
export async function loadPatientEverything(
  pool: PgExecutor,
  tenantUuid: string,
  patientLogicalId: string,
  opts: { perTypeLimit: number },
): Promise<{ patient: FhirJson | null; companion: PatientEverythingEntry[] }> {
  const patient = await readResource(
    pool,
    tenantUuid,
    "Patient",
    patientLogicalId,
  );
  const companionTypes = [
    "Observation",
    "Condition",
    "Encounter",
    "DocumentReference",
  ] as const;
  const companion: PatientEverythingEntry[] = [];
  for (const rt of companionTypes) {
    const { rows } = await searchResourcesWithPatientSubject(
      pool,
      tenantUuid,
      rt,
      patientLogicalId,
      { limit: opts.perTypeLimit, offset: 0 },
    );
    for (const resource of rows) {
      companion.push({ resourceType: rt, resource });
    }
  }
  return { patient, companion };
}

export type SearchGenericParams = {
  ids?: string[];
  limit: number;
  offset: number;
  lastUpdated?: LastUpdatedFilter;
  sortLastUpdated?: "asc" | "desc";
};

export async function searchGeneric(
  pool: PgExecutor,
  tenantUuid: string,
  resourceType: string,
  params: SearchGenericParams,
): Promise<{ rows: FhirJson[]; total: number }> {
  if (params.ids && params.ids.length > 0) {
    const rows = await searchByIds(pool, tenantUuid, resourceType, params.ids);
    let filtered = rows;
    if (params.lastUpdated) {
      const lu = params.lastUpdated;
      filtered = rows.filter((r) => {
        const meta = r.meta as { lastUpdated?: string } | undefined;
        const raw = meta?.lastUpdated;
        if (!raw) return false;
        const t = new Date(raw).getTime();
        if (Number.isNaN(t)) return false;
        if (lu.ge && t < lu.ge.getTime()) return false;
        if (lu.gt && t <= lu.gt.getTime()) return false;
        if (lu.le && t > lu.le.getTime()) return false;
        if (lu.lt && t >= lu.lt.getTime()) return false;
        return true;
      });
    }
    const sortDesc = params.sortLastUpdated !== "asc";
    filtered.sort((a, b) => {
      const ta = new Date(
        String((a.meta as { lastUpdated?: string })?.lastUpdated ?? 0),
      ).getTime();
      const tb = new Date(
        String((b.meta as { lastUpdated?: string })?.lastUpdated ?? 0),
      ).getTime();
      return sortDesc ? tb - ta : ta - tb;
    });
    const slice = filtered.slice(
      params.offset,
      params.offset + params.limit,
    );
    return { rows: slice, total: filtered.length };
  }
  const cond = [
    "tenant_id = $1::uuid",
    "resource_type = $2",
    "NOT deleted",
  ];
  const args: unknown[] = [tenantUuid, resourceType];
  const p = appendLastUpdatedWhere(cond, args, 3, params.lastUpdated);
  const whereSql = cond.join(" AND ");
  const countR = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM fhir_resource WHERE ${whereSql}`,
    args,
  );
  const total = countR.rows[0]?.c ?? 0;
  const sortDir = params.sortLastUpdated === "asc" ? "ASC" : "DESC";
  const limitIdx = p;
  const offsetIdx = p + 1;
  const dataR = await pool.query<{ data: FhirJson }>(
    `SELECT data FROM fhir_resource
     WHERE ${whereSql}
     ORDER BY last_updated ${sortDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...args, params.limit, params.offset],
  );
  return { rows: dataR.rows.map((r) => r.data), total };
}
