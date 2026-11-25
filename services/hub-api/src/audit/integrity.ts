import { createHash, createHmac } from "node:crypto";
import type { AuditEvent } from "@fhir-hub/shared";

/** First chain link when no prior row exists for the tenant. */
export const AUDIT_CHAIN_GENESIS_PREV =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Stable JSON for hashing (order-fixed keys). */
export function auditEntryCanonicalJson(event: AuditEvent): string {
  return JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    tenantId: event.actor.tenantId,
    action: event.action,
    outcome: event.outcome,
    actor: event.actor,
    entity: event.entity,
    api: event.api,
    network: event.network ?? null,
    detail: event.detail ?? null,
  });
}

export function sha256Hex(utf8: string): string {
  return createHash("sha256").update(utf8, "utf8").digest("hex");
}

/**
 * Chained row hash: HMAC-SHA256(secret, prevRowHash + "|" + entryHash) when secret is set,
 * else SHA-256 of the same material (tamper-evident ordering without a shared secret).
 */
export function computeAuditRowHash(
  previousRowHashHex: string | null,
  entryHashHex: string,
  chainSecret: string | undefined,
): string {
  const prev = previousRowHashHex ?? AUDIT_CHAIN_GENESIS_PREV;
  const material = `${prev}|${entryHashHex}`;
  if (chainSecret && chainSecret.length > 0) {
    return createHmac("sha256", chainSecret)
      .update(material, "utf8")
      .digest("hex");
  }
  return sha256Hex(material);
}
