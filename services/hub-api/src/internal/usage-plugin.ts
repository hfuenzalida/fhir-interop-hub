import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import { resolveTenant } from "../auth/api-key.js";
import type { Env } from "../env.js";
import { summarizeTenantAudit } from "./usage.js";

function jsonReply(reply: FastifyReply, code: number, body: unknown) {
  return reply.code(code).type("application/json").send(body);
}

function audit(
  sink: AuditSink,
  request: FastifyRequest | undefined,
  input: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  return emitAudit(sink, request, input);
}

/**
 * Tenant-scoped usage summary from audit trail + pointers to Prometheus metering.
 */
export async function registerUsageRoutes(
  app: FastifyInstance,
  opts: { env: Env; sink: AuditSink },
): Promise<void> {
  const pool = app.pg;
  if (!pool) {
    throw new Error("registerUsageRoutes requires DATABASE_URL (pg pool).");
  }
  const { env, sink } = opts;

  await app.register(
    async (secured) => {
      secured.addHook(
        "preHandler",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const resolved = await resolveTenant(
            pool,
            env,
            request.headers.authorization,
            request.headers["x-hub-api-key"]?.toString(),
          );
          if (!resolved) {
            return jsonReply(reply, 401, {
              error: "Missing or invalid API credentials",
            });
          }
          request.tenantUuid = resolved.tenantUuid;
          request.tenantExternalKey = resolved.externalKey;
        },
      );

      secured.get("/usage/summary", async (request, reply) => {
        const ext = request.tenantExternalKey!;
        const q = request.query as { hours?: string };
        const hoursRaw = q.hours ? Number.parseInt(q.hours, 10) : 24;
        const hours = Number.isFinite(hoursRaw) ? hoursRaw : 24;

        const rollup = await summarizeTenantAudit(pool, ext, hours);

        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "DocumentReference", id: "usage-summary" },
          api: { method: "GET", path: request.url },
          network: { requestId: request.id },
          detail: `usage summary hours=${rollup.hours} total=${rollup.total}`,
        });

        return reply.send({
          tenantExternalKey: ext,
          periodHours: rollup.hours,
          auditEventsInPeriod: rollup.total,
          auditEventsByAction: rollup.byAction,
          metering: {
            prometheusHistograms: [
              "hub_http_requests_total",
              "hub_http_request_duration_seconds",
              "hub_metered_requests_total",
              "hub_oauth_tokens_issued_total",
            ],
            scrapePath: "/internal/metrics",
            note:
              "hub_metered_requests_total labels: tenant_external_key, api_family (fhir|oauth|internal|system|other). Export volume billing requires object storage metrics outside this API.",
          },
        });
      });
    },
    { prefix: "/internal/v1" },
  );
}
