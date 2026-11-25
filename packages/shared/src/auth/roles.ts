/**
 * Placeholder role model for hub + SMART apps.
 * Map to OIDC claims / SMART scopes in Phase 3.
 */
export type HubRole =
  | "system"
  | "org_admin"
  | "integration"
  | "clinician"
  | "nurse"
  | "patient"
  | "auditor";

export const HUB_ROLES: readonly HubRole[] = [
  "system",
  "org_admin",
  "integration",
  "clinician",
  "nurse",
  "patient",
  "auditor",
] as const;
