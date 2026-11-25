import type pg from "pg";
import type { FastifyRequest } from "fastify";
import type { Env } from "../env.js";
import type { FhirJson } from "./resource-store.js";
import { getStringParam, parsePatientReference } from "./query-params.js";

/** Creating/updating a Consent record does not require a matching prior Consent (bootstrap). */
export function isConsentBootstrapWrite(
  method: string,
  resourceType: string | undefined,
): boolean {
  return (
    resourceType === "Consent" &&
    (method === "POST" || method === "PUT")
  );
}

/** Patient id for consent evaluation from a loaded FHIR resource (subject or Consent.patient). */
export function extractPatientLogicalIdFromResource(
  resourceType: string,
  logicalId: string,
  resource: FhirJson,
): string | null {
  if (resourceType === "Patient") return logicalId;
  if (resourceType === "Consent") {
    const ref = resource.patient;
    if (ref && typeof ref === "object") {
      const r = (ref as { reference?: unknown }).reference;
      if (typeof r === "string") {
        const m = r.match(/Patient\/([^/]+)\s*$/);
        if (m?.[1]) return m[1];
      }
    }
    return null;
  }
  const subj = resource.subject;
  if (subj && typeof subj === "object") {
    const ref = (subj as { reference?: unknown }).reference;
    if (typeof ref === "string") {
      const m = ref.match(/Patient\/([^/]+)\s*$/);
      if (m?.[1]) return m[1];
    }
  }
  return null;
}

export function extractPatientLogicalIdFromCreateBody(
  resourceType: string,
  body: FhirJson,
): string | null {
  if (resourceType === "Patient") {
    const id = typeof body.id === "string" ? body.id : undefined;
    return id && id.length > 0 ? id : null;
  }
  if (resourceType === "Consent") {
    return extractPatientLogicalIdFromResource("Consent", "", body);
  }
  const subj = body.subject;
  if (subj && typeof subj === "object") {
    const ref = (subj as { reference?: unknown }).reference;
    if (typeof ref === "string") {
      const m = ref.match(/Patient\/([^/]+)\s*$/);
      if (m?.[1]) return m[1];
    }
  }
  return null;
}

function normalizePurposeToken(s: string): string {
  return s.trim().toLowerCase();
}

/** Collect purpose codes/displays/text from Consent R4 `provision` (best-effort). */
export function extractDeclaredPurposes(consent: FhirJson): string[] {
  const out: string[] = [];
  const walkPurpose = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const purpose = (node as { purpose?: unknown }).purpose;
    if (!Array.isArray(purpose)) return;
    for (const pc of purpose) {
      if (!pc || typeof pc !== "object") continue;
      const coding = (pc as { coding?: unknown }).coding;
      if (Array.isArray(coding)) {
        for (const c of coding) {
          if (!c || typeof c !== "object") continue;
          const code = (c as { code?: unknown }).code;
          const display = (c as { display?: unknown }).display;
          if (typeof code === "string" && code.length > 0)
            out.push(normalizePurposeToken(code));
          if (typeof display === "string" && display.length > 0)
            out.push(normalizePurposeToken(display));
        }
      }
      const text = (pc as { text?: unknown }).text;
      if (typeof text === "string" && text.length > 0)
        out.push(normalizePurposeToken(text));
    }
  };

  const rootProv = (consent as { provision?: unknown }).provision;
  if (Array.isArray(rootProv)) {
    for (const p of rootProv) walkPurpose(p);
  } else if (rootProv && typeof rootProv === "object") {
    walkPurpose(rootProv);
    const nested = (rootProv as { provision?: unknown }).provision;
    if (Array.isArray(nested)) {
      for (const p of nested) walkPurpose(p);
    }
  }
  return [...new Set(out)];
}

function purposeHeaderMatchesDeclared(
  declared: string[],
  purposeHeader: string | undefined,
): boolean {
  if (declared.length === 0) return true;
  if (!purposeHeader || purposeHeader.trim().length === 0) return false;
  const h = normalizePurposeToken(purposeHeader);
  return declared.some((d) => d === h || h.includes(d) || d.includes(h));
}

async function loadConsentResourcesForPatient(
  pool: pg.Pool,
  tenantUuid: string,
  patientLogicalId: string,
): Promise<FhirJson[]> {
  const refExact = `Patient/${patientLogicalId}`;
  const likePat = `%Patient/${patientLogicalId}`;
  const r = await pool.query<{ data: FhirJson }>(
    `SELECT data FROM fhir_resource
     WHERE tenant_id = $1::uuid
       AND resource_type = 'Consent'
       AND NOT deleted
       AND (
         data->'patient'->>'reference' = $2
         OR data->'patient'->>'reference' = $3
         OR data->'patient'->>'reference' LIKE $4
       )`,
    [tenantUuid, refExact, patientLogicalId, likePat],
  );
  return r.rows.map((row) => row.data);
}

function isActiveConsent(c: FhirJson): boolean {
  return String(c.status ?? "").toLowerCase() === "active";
}

export type ConsentEvaluation = { ok: true } | { ok: false; reason: string };

/**
 * When policy is enabled: if the patient has active Consent resources with declared purposes,
 * the request must carry a matching purpose (via `complianceMeta` / `X-Purpose-Of-Use`).
 * Consents with no declared purposes are treated as permitting any purpose header (including absent).
 */
export async function evaluateConsentForRequest(
  pool: pg.Pool,
  env: Env,
  request: FastifyRequest,
  tenantUuid: string,
  patientLogicalId: string,
): Promise<ConsentEvaluation> {
  if (!env.CONSENT_POLICY_ENABLED) return { ok: true };

  const consents = (await loadConsentResourcesForPatient(
    pool,
    tenantUuid,
    patientLogicalId,
  )).filter(isActiveConsent);

  if (consents.length === 0) return { ok: true };

  const purposeHeader = request.complianceMeta?.purposeOfUse?.trim();
  let anyDeclared = false;
  for (const c of consents) {
    const declared = extractDeclaredPurposes(c);
    if (declared.length > 0) anyDeclared = true;
    if (purposeHeaderMatchesDeclared(declared, purposeHeader)) {
      return { ok: true };
    }
  }

  if (!anyDeclared) return { ok: true };

  if (!env.CONSENT_REQUIRE_PURPOSE_HEADER) return { ok: true };

  return {
    ok: false,
    reason:
      "Active Consent record(s) declare restricted purposes; send a matching X-Purpose-Of-Use (or configured) header.",
  };
}

export function extractPatientHintFromRequest(
  request: FastifyRequest,
): string | null {
  const auth = request.hubAuth;
  if (auth?.kind === "jwt" && auth.patient) return auth.patient;

  const rawUrl = request.url.split("?")[0] ?? "";
  const params = request.params as { resourceType?: string; id?: string };
  if (rawUrl.includes("$everything") && params.id) {
    return params.id;
  }
  if (params.resourceType === "Patient" && params.id) return params.id;

  const q = request.query as Record<string, unknown>;
  return parsePatientReference(getStringParam(q, "patient"));
}
