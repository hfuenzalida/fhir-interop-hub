import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import type { Env } from "../env.js";
import { resolveTenant } from "../auth/api-key.js";
import { assertJsonDepthLimit } from "../security/json-depth.js";
import type { FhirJson } from "../fhir/resource-store.js";
import { createResource, upsertResource } from "../fhir/resource-store.js";
import { ingestFhirBundle } from "./bundle-ingest.js";
import { getInterfaceMetrics24h, logInterfaceMessage } from "./interface-log.js";
import { mapOruR01ToFhir } from "./hl7/oru-r01.js";

function jsonReply(reply: FastifyReply, code: number, body: unknown) {
  return reply.code(code).type("application/json").send(body);
}

/** Raw HL7 text or JSON wrapper for Windows/curl friendliness. */
function extractHl7Raw(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && body !== null && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return null;
}

function audit(
  sink: AuditSink,
  request: FastifyRequest | undefined,
  input: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  return emitAudit(sink, request, input);
}

export async function registerIngestionRoutes(
  app: FastifyInstance,
  opts: { env: Env; sink: AuditSink },
): Promise<void> {
  const pool = app.pg;
  if (!pool) {
    throw new Error("registerIngestionRoutes requires DATABASE_URL (pg pool).");
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

      secured.post("/ingest/bundle", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const depthErr = assertJsonDepthLimit(
          request.body,
          env.FHIR_JSON_MAX_DEPTH,
        );
        if (depthErr) {
          return jsonReply(reply, 400, { error: depthErr });
        }
        const raw = JSON.stringify(request.body);
        try {
          const result = await ingestFhirBundle(
            pool,
            tenant,
            request.body as FhirJson,
          );
          const bundleStatus: "success" | "failed" =
            result.processed === 0 && result.failed > 0 ? "failed" : "success";
          await logInterfaceMessage(pool, {
            tenantUuid: tenant,
            connector: "fhir_bundle",
            status: bundleStatus,
            raw,
            error:
              result.failed > 0
                ? result.errors.slice(0, 5).join("; ")
                : undefined,
            outcome: result,
          });
          await audit(sink, request, {
            action: "CREATE",
            outcome: "success",
            actor: { tenantId: ext, clientId: "ingest", role: "integration" },
            entity: { type: "Bundle", id: "ingest" },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: `bundle processed=${result.processed} failed=${result.failed}`,
          });
          return jsonReply(reply, 200, {
            resourceType: "IngestResult",
            connector: "fhir_bundle",
            ...result,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logInterfaceMessage(pool, {
            tenantUuid: tenant,
            connector: "fhir_bundle",
            status: "failed",
            raw,
            error: msg,
          });
          await audit(sink, request, {
            action: "CREATE",
            outcome: "failure",
            actor: { tenantId: ext, clientId: "ingest", role: "integration" },
            entity: { type: "Bundle", id: "ingest" },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: msg,
          });
          return jsonReply(reply, 400, { error: msg });
        }
      });

      secured.post("/ingest/hl7v2", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const raw = extractHl7Raw(request.body);
        if (!raw || raw.length === 0) {
          return jsonReply(reply, 400, {
            error:
              "Send HL7 as text/plain, or JSON {\"message\":\"MSH|...\\rPID|...\"}",
          });
        }
        if (raw.length > env.HL7_INGEST_MAX_CHARS) {
          return jsonReply(reply, 413, {
            error: `HL7 message exceeds maximum length (${env.HL7_INGEST_MAX_CHARS} characters).`,
          });
        }

        const mapped = mapOruR01ToFhir(raw);
        if ("error" in mapped) {
          void logInterfaceMessage(pool, {
            tenantUuid: tenant,
            connector: "hl7v2_oru",
            status: "failed",
            raw,
            error: mapped.error,
          });
          return jsonReply(reply, 422, { error: mapped.error });
        }

        try {
          const pid = String(mapped.patient.id);
          await upsertResource(pool, tenant, "Patient", pid, mapped.patient);
          let obsCount = 0;
          for (const obs of mapped.observations) {
            await createResource(pool, tenant, "Observation", obs);
            obsCount++;
          }
          const outcome = {
            patientId: pid,
            observationCount: obsCount,
            messageControlId: mapped.messageControlId,
          };
          await logInterfaceMessage(pool, {
            tenantUuid: tenant,
            connector: "hl7v2_oru",
            status: "success",
            raw,
            outcome,
          });
          await audit(sink, request, {
            action: "CREATE",
            outcome: "success",
            actor: { tenantId: ext, clientId: "ingest", role: "integration" },
            entity: { type: "Message", id: mapped.messageControlId },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: `hl7 ORU patient=${pid} obs=${obsCount}`,
          });
          return jsonReply(reply, 200, {
            resourceType: "IngestResult",
            connector: "hl7v2_oru",
            ...outcome,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logInterfaceMessage(pool, {
            tenantUuid: tenant,
            connector: "hl7v2_oru",
            status: "failed",
            raw,
            error: msg,
          });
          return jsonReply(reply, 500, { error: msg });
        }
      });

      secured.get("/metrics/interfaces", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const metrics = await getInterfaceMetrics24h(pool, tenant);
        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: { tenantId: ext, clientId: "metrics", role: "integration" },
          entity: { type: "System", id: "interface-metrics" },
          api: { method: "GET", path: request.url },
          network: { requestId: request.id },
        });
        const emptyWindow =
          metrics.byStatus.length === 0 && metrics.totalRowsAllTime === 0;
        return jsonReply(reply, 200, {
          resourceType: "InterfaceMetrics",
          windowHours: 24,
          byStatus: metrics.byStatus,
          totalRowsAllTime: metrics.totalRowsAllTime,
          ...(emptyWindow
            ? {
                hint:
                  "No ingest logged yet for this tenant. Apply migration 003_phase2_interface.sql, restart the API, then POST /internal/v1/ingest/hl7v2 or /ingest/bundle.",
              }
            : metrics.byStatus.length === 0 && metrics.totalRowsAllTime > 0
              ? {
                  hint:
                    "Last 24h has no runs; older ingests exist (see totalRowsAllTime).",
                }
              : {}),
        });
      });
    },
    { prefix: "/internal/v1" },
  );
}
