import type { FhirJson } from "./resource-store.js";

/**
 * Lightweight checks aligned with common US Core expectations for Phase 1 resources.
 * Not a full IG validator — avoids obviously broken Patient/Observation payloads.
 */
export function validateUsCoreLite(
  resourceType: string,
  body: FhirJson,
): string | null {
  switch (resourceType) {
    case "Patient":
      return validatePatient(body);
    case "Observation":
      return validateObservation(body);
    case "Condition":
      return validateCondition(body);
    case "Consent":
      return validateConsent(body);
    case "Provenance":
      return validateProvenance(body);
    default:
      return null;
  }
}

function hasNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function validatePatient(body: FhirJson): string | null {
  const ids = body.identifier;
  const idOk =
    Array.isArray(ids) &&
    ids.some((id) => {
      if (!id || typeof id !== "object") return false;
      const o = id as { system?: unknown; value?: unknown };
      return hasNonEmptyString(o.value);
    });

  const names = body.name;
  const nameOk =
    Array.isArray(names) &&
    names.some((n) => {
      if (!n || typeof n !== "object") return false;
      const o = n as { family?: unknown; given?: unknown[] };
      if (hasNonEmptyString(o.family)) return true;
      if (Array.isArray(o.given) && o.given.some((g) => hasNonEmptyString(g)))
        return true;
      return false;
    });

  const telecom = body.telecom;
  const telecomOk =
    Array.isArray(telecom) &&
    telecom.some((t) => {
      if (!t || typeof t !== "object") return false;
      return hasNonEmptyString((t as { value?: unknown }).value);
    });

  if (idOk || nameOk || telecomOk) return null;
  return "US Core–style Patient requires at least one of: identifier (with value), name (family or given), or telecom (with value).";
}

function validateObservation(body: FhirJson): string | null {
  if (!hasNonEmptyString(body.status)) {
    return "Observation.status is required.";
  }
  const code = body.code;
  if (!code || typeof code !== "object") {
    return "Observation.code is required.";
  }
  const c = code as { coding?: unknown; text?: unknown };
  const codingOk =
    Array.isArray(c.coding) &&
    c.coding.some((x) => {
      if (!x || typeof x !== "object") return false;
      return hasNonEmptyString((x as { code?: unknown }).code);
    });
  const textOk = hasNonEmptyString(c.text);
  if (!codingOk && !textOk) {
    return "Observation.code must include a coding with code and/or a text value.";
  }
  const subj = body.subject;
  if (!subj || typeof subj !== "object") {
    return "Observation.subject is required with a reference to a Patient.";
  }
  const ref = (subj as { reference?: unknown }).reference;
  if (typeof ref !== "string" || !ref.includes("Patient/")) {
    return "Observation.subject.reference must point to a Patient (e.g. Patient/123).";
  }
  return null;
}

function validateConsent(body: FhirJson): string | null {
  if (!hasNonEmptyString(body.status)) {
    return "Consent.status is required.";
  }
  const st = String(body.status).toLowerCase();
  if (st === "entered-in-error") {
    return null;
  }
  const p = body.patient;
  if (!p || typeof p !== "object") {
    return "Consent.patient is required.";
  }
  const ref = (p as { reference?: unknown }).reference;
  if (!hasNonEmptyString(ref)) {
    return "Consent.patient.reference is required.";
  }
  const scope = body.scope;
  if (!scope || typeof scope !== "object") {
    return "Consent.scope is required.";
  }
  const codings = (scope as { coding?: unknown }).coding;
  const codingOk =
    Array.isArray(codings) &&
    codings.some((c) => {
      if (!c || typeof c !== "object") return false;
      return hasNonEmptyString((c as { code?: unknown }).code);
    });
  const textOk = hasNonEmptyString((scope as { text?: unknown }).text);
  if (!codingOk && !textOk) {
    return "Consent.scope must include coding with code and/or text.";
  }
  return null;
}

function validateProvenance(body: FhirJson): string | null {
  const targets = body.target;
  if (!Array.isArray(targets) || targets.length === 0) {
    return "Provenance.target must be a non-empty array.";
  }
  if (!hasNonEmptyString(body.recorded)) {
    return "Provenance.recorded is required.";
  }
  return null;
}

function validateCondition(body: FhirJson): string | null {
  const subj = body.subject;
  if (!subj || typeof subj !== "object") {
    return "Condition.subject is required with a reference to a Patient.";
  }
  const ref = (subj as { reference?: unknown }).reference;
  if (typeof ref !== "string" || !ref.includes("Patient/")) {
    return "Condition.subject.reference must point to a Patient.";
  }
  const code = body.code;
  if (!code || typeof code !== "object") {
    return "Condition.code is required.";
  }
  return null;
}
