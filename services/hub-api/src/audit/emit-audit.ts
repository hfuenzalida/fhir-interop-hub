import type { FastifyRequest } from "fastify";
import {
  createAuditEventId,
  type AuditEvent,
  type AuditNetworkContext,
} from "@fhir-hub/shared";
import type { AuditSink } from "./sink.js";

function mergeNetwork(
  request: FastifyRequest | undefined,
  existing?: AuditNetworkContext,
): AuditNetworkContext | undefined {
  if (!request && !existing) return undefined;
  const uaRaw = request?.headers["user-agent"];
  const ua =
    typeof uaRaw === "string"
      ? uaRaw
      : Array.isArray(uaRaw)
        ? uaRaw[0]
        : undefined;
  return {
    ...existing,
    requestId: existing?.requestId ?? request?.id ?? "unknown",
    sourceIp: existing?.sourceIp ?? request?.ip,
    userAgent: existing?.userAgent ?? ua,
  };
}

/**
 * Append-only audit with optional compliance enrichment (break-glass, purpose-of-use, client IP).
 */
export async function emitAudit(
  sink: AuditSink,
  request: FastifyRequest | undefined,
  input: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  const meta = request?.complianceMeta;
  const actor = { ...input.actor };
  if (meta?.breakGlassReason) {
    actor.breakGlassReason = meta.breakGlassReason;
  }
  if (meta?.purposeOfUse) {
    actor.purposeOfUse = meta.purposeOfUse;
  }
  const event: AuditEvent = {
    ...input,
    actor,
    network: mergeNetwork(request, input.network),
    id: createAuditEventId(),
    timestamp: new Date().toISOString(),
  };
  await sink.append(event);
}
