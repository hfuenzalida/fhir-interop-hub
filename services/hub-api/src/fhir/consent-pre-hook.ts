import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import type { Env } from "../env.js";
import {
  evaluateConsentForRequest,
  extractPatientHintFromRequest,
  isConsentBootstrapWrite,
} from "./consent-policy.js";
import { operationOutcome } from "./operation-outcome.js";

/**
 * Runs after hub auth. Evaluates optional FHIR Consent–backed purpose rules when
 * a patient id can be inferred from the request (JWT launch, Patient reads, `?patient=`).
 */
export function registerConsentPolicyPreHandler(
  secured: FastifyInstance,
  pool: pg.Pool,
  env: Env,
  sink: AuditSink,
): void {
  if (!env.CONSENT_POLICY_ENABLED) return;

  secured.addHook("preHandler", async (request, reply) => {
    const routePath = request.routeOptions?.url ?? "";
    if (request.method === "POST" && (routePath === "/" || routePath === "")) {
      return;
    }

    const rt = (request.params as { resourceType?: string }).resourceType;
    if (isConsentBootstrapWrite(request.method, rt)) {
      return;
    }

    const tenant = request.tenantUuid;
    if (!tenant) return;

    const patientId = extractPatientHintFromRequest(request);
    if (!patientId) return;

    const ev = await evaluateConsentForRequest(
      pool,
      env,
      request,
      tenant,
      patientId,
    );
    if (ev.ok) return;

    await emitAudit(sink, request, {
      action: "EXECUTE",
      outcome: "failure",
      actor: {
        tenantId: request.tenantExternalKey ?? "unknown",
        clientId: "consent-policy",
        role: "system",
      },
      entity: { type: "Consent", id: "policy" },
      api: { method: request.method, path: request.url },
      network: { requestId: request.id },
      detail: ev.reason,
    });

    return reply
      .code(403)
      .type("application/fhir+json")
      .send(operationOutcome("error", "security", ev.reason));
  });
}
