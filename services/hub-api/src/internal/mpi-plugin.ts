import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import { resolveTenant } from "../auth/api-key.js";
import type { Env } from "../env.js";
import {
  buildProbabilisticCandidates,
  scorePatientPair,
  type PatientMini,
} from "../fhir/patient-match-score.js";
import {
  readResource,
  restoreSoftDeletedResource,
} from "../fhir/resource-store.js";
import { executePatientMerge } from "./mpi-merge.js";
import {
  fetchLivePatientsByIds,
  findPatientDuplicateCandidates,
  insertPatientLink,
  isPatientLinkType,
  listPatientLinks,
  loadBirthDateBlockingGroups,
  normalizePatientPair,
  patientResourceExists,
} from "./mpi.js";

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
 * Data-quality / MPI helpers: duplicate Patient preview, patient_link edges,
 * soft-delete restore. Authenticated like other `/internal/v1/*` routes.
 */
export async function registerMpiRoutes(
  app: FastifyInstance,
  opts: { env: Env; sink: AuditSink },
): Promise<void> {
  const pool = app.pg;
  if (!pool) {
    throw new Error("registerMpiRoutes requires DATABASE_URL (pg pool).");
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

      secured.get("/mpi/patient-duplicate-candidates", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const q = request.query as { limit?: string };
        const limit = q.limit ? Number.parseInt(q.limit, 10) : undefined;
        const groups = await findPatientDuplicateCandidates(pool, tenant, {
          limit: Number.isFinite(limit) ? limit : undefined,
        });
        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Patient", id: "duplicate-scan" },
          api: { method: "GET", path: request.url },
          network: { requestId: request.id },
          detail: `mpi duplicate groups=${groups.length}`,
        });
        return reply.send({ groups });
      });

      secured.get(
        "/mpi/patient-probabilistic-candidates",
        async (request, reply) => {
          const tenant = request.tenantUuid!;
          const ext = request.tenantExternalKey!;
          const q = request.query as { minScore?: string; maxPairs?: string };
          const minScore = q.minScore
            ? Number.parseFloat(q.minScore)
            : 75;
          const maxPairs = q.maxPairs
            ? Number.parseInt(q.maxPairs, 10)
            : 100;
          const ms = Number.isFinite(minScore) ? Math.min(100, Math.max(0, minScore)) : 75;
          const mp = Number.isFinite(maxPairs)
            ? Math.min(500, Math.max(1, maxPairs))
            : 100;

          const bdGroups = await loadBirthDateBlockingGroups(pool, tenant);
          const det = await findPatientDuplicateCandidates(pool, tenant, {
            limit: 500,
          });
          const identifierGroups: {
            system: string;
            value: string;
            patients: PatientMini[];
          }[] = [];
          for (const g of det) {
            const patients = await fetchLivePatientsByIds(
              pool,
              tenant,
              g.patientLogicalIds,
            );
            identifierGroups.push({
              system: g.system,
              value: g.value,
              patients,
            });
          }
          const candidates = buildProbabilisticCandidates(
            bdGroups,
            identifierGroups,
            ms,
            mp,
          );
          await audit(sink, request, {
            action: "READ",
            outcome: "success",
            actor: {
              tenantId: ext,
              clientId: "api-key",
              role: "integration",
            },
            entity: { type: "Patient", id: "probabilistic-scan" },
            api: { method: "GET", path: request.url },
            network: { requestId: request.id },
            detail: `mpi probabilistic candidates=${candidates.length}`,
          });
          return reply.send({
            minScore: ms,
            maxPairs: mp,
            candidates,
          });
        },
      );

      secured.post("/mpi/patient-match-score", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const body = request.body as {
          patientLogicalIdA?: unknown;
          patientLogicalIdB?: unknown;
        };
        const a =
          typeof body.patientLogicalIdA === "string"
            ? body.patientLogicalIdA.trim()
            : "";
        const b =
          typeof body.patientLogicalIdB === "string"
            ? body.patientLogicalIdB.trim()
            : "";
        if (!a || !b) {
          return jsonReply(reply, 400, {
            error: "patientLogicalIdA and patientLogicalIdB are required",
          });
        }
        const [pa, pb] = await Promise.all([
          readResource(pool, tenant, "Patient", a),
          readResource(pool, tenant, "Patient", b),
        ]);
        if (!pa || !pb) {
          return jsonReply(reply, 404, {
            error: "One or both Patient resources not found",
          });
        }
        const scored = scorePatientPair(pa, pb);
        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Patient", id: `${a}|${b}` },
          api: { method: "POST", path: request.url },
          network: { requestId: request.id },
          detail: "mpi patient_match_score",
        });
        return reply.send({
          patientLogicalIdA: a,
          patientLogicalIdB: b,
          ...scored,
        });
      });

      secured.post("/mpi/patient-merge", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const body = request.body as {
          survivorPatientLogicalId?: unknown;
          duplicatePatientLogicalId?: unknown;
          rewriteReferences?: unknown;
          softDeleteDuplicate?: unknown;
        };
        const survivor =
          typeof body.survivorPatientLogicalId === "string"
            ? body.survivorPatientLogicalId.trim()
            : "";
        const duplicate =
          typeof body.duplicatePatientLogicalId === "string"
            ? body.duplicatePatientLogicalId.trim()
            : "";
        const rewriteReferences = Boolean(body.rewriteReferences);
        const softDeleteDuplicate =
          body.softDeleteDuplicate === undefined
            ? true
            : Boolean(body.softDeleteDuplicate);
        if (!survivor || !duplicate) {
          return jsonReply(reply, 400, {
            error:
              "survivorPatientLogicalId and duplicatePatientLogicalId are required",
          });
        }
        try {
          const result = await executePatientMerge(pool, tenant, {
            survivorPatientLogicalId: survivor,
            duplicatePatientLogicalId: duplicate,
            rewriteReferences,
            softDeleteDuplicate,
          });
          await audit(sink, request, {
            action: "UPDATE",
            outcome: "success",
            actor: {
              tenantId: ext,
              clientId: "api-key",
              role: "integration",
            },
            entity: { type: "Patient", id: `${survivor}|${duplicate}` },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: `mpi merge provenance=${result.provenanceLogicalId} refs=${result.referencesUpdated}`,
          });
          return reply.code(200).send(result);
        } catch (e: unknown) {
          const code =
            e && typeof e === "object" && "code" in e
              ? String((e as { code?: string }).code)
              : "";
          if (code === "23505") {
            return jsonReply(reply, 409, {
              error: "Patient link already exists for this pair",
            });
          }
          const msg = e instanceof Error ? e.message : "";
          if (msg === "patient_not_found") {
            return jsonReply(reply, 404, {
              error: "One or both Patient resources not found",
            });
          }
          if (msg === "invalid_merge_ids") {
            return jsonReply(reply, 400, { error: "Invalid survivor or duplicate id" });
          }
          if (msg === "soft_delete_failed") {
            return jsonReply(reply, 500, {
              error: "Could not soft-delete duplicate Patient",
            });
          }
          throw e;
        }
      });

      secured.get("/mpi/patient-links", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const links = await listPatientLinks(pool, tenant);
        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Patient", id: "links" },
          api: { method: "GET", path: request.url },
          network: { requestId: request.id },
          detail: `mpi patient_links count=${links.length}`,
        });
        return reply.send({ links });
      });

      secured.post("/mpi/patient-links", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const body = request.body as {
          patientLogicalIdA?: unknown;
          patientLogicalIdB?: unknown;
          linkType?: unknown;
          matchRule?: unknown;
        };
        const a =
          typeof body.patientLogicalIdA === "string"
            ? body.patientLogicalIdA.trim()
            : "";
        const b =
          typeof body.patientLogicalIdB === "string"
            ? body.patientLogicalIdB.trim()
            : "";
        const linkType =
          typeof body.linkType === "string" ? body.linkType.trim() : "";
        const matchRule =
          typeof body.matchRule === "string" && body.matchRule.trim().length > 0
            ? body.matchRule.trim()
            : null;
        if (!a || !b || !linkType) {
          return jsonReply(reply, 400, {
            error: "patientLogicalIdA, patientLogicalIdB, and linkType are required",
          });
        }
        if (!isPatientLinkType(linkType)) {
          return jsonReply(reply, 400, {
            error: "linkType must be one of: replaced-by, see-also, duplicate",
          });
        }
        const pair = normalizePatientPair(a, b);
        if (!pair) {
          return jsonReply(reply, 400, { error: "patient ids must differ" });
        }
        const [existsLeft, existsRight] = await Promise.all([
          patientResourceExists(pool, tenant, pair.left),
          patientResourceExists(pool, tenant, pair.right),
        ]);
        if (!existsLeft || !existsRight) {
          return jsonReply(reply, 404, {
            error: "One or both Patient resources not found (live)",
          });
        }
        try {
          const created = await insertPatientLink(
            pool,
            tenant,
            pair.left,
            pair.right,
            linkType,
            matchRule,
          );
          await audit(sink, request, {
            action: "CREATE",
            outcome: "success",
            actor: {
              tenantId: ext,
              clientId: "api-key",
              role: "integration",
            },
            entity: { type: "Patient", id: `${pair.left}|${pair.right}` },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: `mpi patient_link type=${linkType}`,
          });
          return reply.code(201).send(created);
        } catch (e: unknown) {
          const code =
            e && typeof e === "object" && "code" in e
              ? String((e as { code?: string }).code)
              : "";
          if (code === "23505") {
            return jsonReply(reply, 409, {
              error: "Link for this patient pair already exists",
            });
          }
          throw e;
        }
      });

      secured.post(
        "/mpi/fhir-resources/:resourceType/:logicalId/restore",
        async (request, reply) => {
          const tenant = request.tenantUuid!;
          const ext = request.tenantExternalKey!;
          const resourceType = (request.params as { resourceType: string })
            .resourceType;
          const logicalId = (request.params as { logicalId: string }).logicalId;
          if (!resourceType || !logicalId) {
            return jsonReply(reply, 400, { error: "Missing path parameters" });
          }
          const result = await restoreSoftDeletedResource(
            pool,
            tenant,
            resourceType,
            logicalId,
          );
          if (result === "not_found") {
            return jsonReply(reply, 404, { error: "Resource not found" });
          }
          if (result === "not_deleted") {
            return jsonReply(reply, 409, {
              error: "Resource is not soft-deleted",
            });
          }
          if (result === "conflict_live_row") {
            return jsonReply(reply, 409, {
              error:
                "Cannot restore: a live resource already exists for this id (re-created after delete)",
            });
          }
          await audit(sink, request, {
            action: "UPDATE",
            outcome: "success",
            actor: {
              tenantId: ext,
              clientId: "api-key",
              role: "integration",
            },
            entity: { type: resourceType, id: logicalId },
            api: { method: "POST", path: request.url },
            network: { requestId: request.id },
            detail: "restore soft-deleted fhir_resource",
          });
          return reply.code(204).send();
        },
      );
    },
    { prefix: "/internal/v1" },
  );
}
