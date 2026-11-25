import { scopeAllowsPatientResource } from "./smart-scopes.js";
import {
  patientReferenceMatches,
  subjectReferencesPatient,
  type FhirJson,
} from "../fhir/resource-store.js";
import type { HubAuth } from "./hub-auth.js";

const PHASE1_WRITE_TYPES = [
  "Patient",
  "Observation",
  "Condition",
  "Encounter",
  "DocumentReference",
  "Consent",
] as const;

/**
 * True for single-type REST mutations we allow for SMART JWT (not Bundle /fhir).
 */
export function isSmartJwtRestWritePath(
  pathWithQuery: string,
  method: string,
): boolean {
  const path = (pathWithQuery.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const types = PHASE1_WRITE_TYPES.join("|");
  if (method === "POST") {
    return new RegExp(`^/fhir/(${types})$`, "i").test(path);
  }
  if (method === "PUT" || method === "DELETE") {
    return new RegExp(`^/fhir/(${types})/[^/]+$`, "i").test(path);
  }
  return false;
}

export function assertJwtWriteScope(
  auth: HubAuth,
  resourceType: string,
): string | null {
  if (auth.kind !== "jwt") return null;
  if (!scopeAllowsPatientResource(auth.scopes, resourceType, "write")) {
    return `Insufficient write scope for ${resourceType}.`;
  }
  return null;
}

/**
 * Enforce patient compartment for create (POST). Patient resource id must match launch patient.
 */
export function assertJwtCreateCompartment(
  auth: HubAuth,
  resourceType: string,
  body: FhirJson,
): string | null {
  if (auth.kind !== "jwt") return null;
  if (!auth.patient) return "Patient launch context required for write.";
  if (resourceType === "Patient") {
    const id = typeof body.id === "string" ? body.id : undefined;
    if (id && id !== auth.patient) {
      return "Cannot create Patient for a different id than the launch context.";
    }
    return null;
  }
  if (resourceType === "Consent") {
    if (!patientReferenceMatches(body, auth.patient)) {
      return "Consent.patient must reference the launch patient for SMART write.";
    }
    return null;
  }
  if (!subjectReferencesPatient(body, auth.patient)) {
    return "Resource subject must reference the launch patient for SMART write.";
  }
  return null;
}

/**
 * For PUT, body should reference the same patient; Patient id must match URL and launch.
 */
export function assertJwtUpdateCompartment(
  auth: HubAuth,
  resourceType: string,
  logicalId: string,
  body: FhirJson,
): string | null {
  if (auth.kind !== "jwt") return null;
  if (!auth.patient) return "Patient launch context required for write.";
  if (resourceType === "Patient") {
    if (logicalId !== auth.patient) {
      return "Cannot update a Patient other than the launch patient.";
    }
    return null;
  }
  if (resourceType === "Consent") {
    if (!patientReferenceMatches(body, auth.patient)) {
      return "Consent.patient must reference the launch patient for SMART write.";
    }
    return null;
  }
  if (!subjectReferencesPatient(body, auth.patient)) {
    return "Resource subject must reference the launch patient for SMART write.";
  }
  return null;
}

export function assertJwtDeleteCompartment(
  auth: HubAuth,
  resourceType: string,
  logicalId: string,
  existing: FhirJson,
): string | null {
  if (auth.kind !== "jwt") return null;
  if (!auth.patient) return "Patient launch context required for write.";
  if (resourceType === "Patient") {
    if (logicalId !== auth.patient) {
      return "Cannot delete a Patient other than the launch patient.";
    }
    return null;
  }
  if (resourceType === "Consent") {
    if (!patientReferenceMatches(existing, auth.patient)) {
      return "Cannot delete a Consent outside the launch patient compartment.";
    }
    return null;
  }
  if (!subjectReferencesPatient(existing, auth.patient)) {
    return "Cannot delete a resource outside the launch patient compartment.";
  }
  return null;
}
