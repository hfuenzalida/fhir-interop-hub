/**
 * Phase 1 REST resource types enabled for generic CRUD + search (where implemented).
 * Expand deliberately with profiles and validation.
 */
export const PHASE1_RESOURCE_TYPES = [
  "Patient",
  "Observation",
  "Condition",
  "Encounter",
  "DocumentReference",
  "Consent",
  "Provenance",
] as const;

export type Phase1ResourceType = (typeof PHASE1_RESOURCE_TYPES)[number];

export function isPhase1ResourceType(
  t: string,
): t is Phase1ResourceType {
  return (PHASE1_RESOURCE_TYPES as readonly string[]).includes(t);
}
