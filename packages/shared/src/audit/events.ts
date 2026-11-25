/**
 * Append-only audit event taxonomy (ONC-style attestation alignment).
 * Persist: who, what, when, patient context, outcome, request correlation.
 *
 * IDs use Web Crypto `randomUUID` (Node 18+ / browsers) — no `node:` imports so
 * `tsc` does not depend on `@types/node` layout in npm workspaces.
 */

export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "EXECUTE";

export type AuditOutcome = "success" | "failure" | "partial";

export interface AuditActor {
  /** Subject id from IdP (opaque) */
  subject?: string;
  /** Service account / client id for M2M */
  clientId?: string;
  role?: string;
  tenantId: string;
  /** Emergency / elevated access attestation (from `X-Break-Glass-Reason` or configured header). */
  breakGlassReason?: string;
  /** Purpose-of-use label (from `X-Purpose-Of-Use` or configured header). */
  purposeOfUse?: string;
}

export interface AuditNetworkContext {
  requestId: string;
  sourceIp?: string;
  userAgent?: string;
}

/** FHIR or logical resource being accessed */
export interface AuditEntity {
  type: string;
  id?: string;
  patientId?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: AuditAction;
  outcome: AuditOutcome;
  actor: AuditActor;
  entity: AuditEntity;
  api: {
    method: string;
    path: string;
  };
  network?: AuditNetworkContext;
  /** Non-PHI summary for operators; avoid raw payloads */
  detail?: string;
}

export function createAuditEventId(): string {
  const cryptoRef = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  const id = cryptoRef.crypto?.randomUUID?.();
  if (id) return id;
  throw new Error(
    "Web Crypto randomUUID() is required (use Node.js 18+ or a modern runtime)",
  );
}
