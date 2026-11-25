import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import { resolveTenant } from "../auth/api-key.js";
import type { Env } from "../env.js";
import {
  insertTenantApiKey,
  isUuidString,
  listTenantApiKeys,
  revokeTenantApiKeyById,
} from "./api-keys.js";

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
 * Tenant-scoped API key lifecycle (list metadata, create with one-time plaintext, revoke).
 * Same authentication as other `/internal/v1/*` routes (API key only).
 */
export async function registerApiKeyManagementRoutes(
  app: FastifyInstance,
  opts: { env: Env; sink: AuditSink },
): Promise<void> {
  const pool = app.pg;
  if (!pool) {
    throw new Error(
      "registerApiKeyManagementRoutes requires DATABASE_URL (pg pool).",
    );
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

      secured.get("/api-keys", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const keys = await listTenantApiKeys(pool, tenant);
        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Security" },
          api: { method: "GET", path: "/internal/v1/api-keys" },
          network: { requestId: request.id },
          detail: `list api_keys count=${keys.length}`,
        });
        return reply.send({ keys });
      });

      secured.post("/api-keys", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const body = request.body as { label?: unknown } | undefined;
        const label =
          body &&
          typeof body.label === "string" &&
          body.label.trim().length > 0
            ? body.label.trim().slice(0, 200)
            : undefined;

        let created: { id: string; plaintextKey: string };
        try {
          created = await insertTenantApiKey(pool, tenant, label);
        } catch {
          return jsonReply(reply, 500, { error: "Failed to create API key" });
        }

        await audit(sink, request, {
          action: "CREATE",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Security", id: created.id },
          api: { method: "POST", path: "/internal/v1/api-keys" },
          network: { requestId: request.id },
          detail: "created api_key (plaintext not logged)",
        });

        return reply.code(201).send({
          id: created.id,
          apiKey: created.plaintextKey,
          warning:
            "Store apiKey securely; it cannot be retrieved again from the hub.",
        });
      });

      secured.delete("/api-keys/:keyId", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const { keyId } = request.params as { keyId: string };
        if (!isUuidString(keyId)) {
          return jsonReply(reply, 400, { error: "Invalid key id" });
        }

        const ok = await revokeTenantApiKeyById(pool, tenant, keyId);
        if (!ok) {
          return jsonReply(reply, 404, { error: "API key not found" });
        }

        await audit(sink, request, {
          action: "DELETE",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Security", id: keyId },
          api: { method: "DELETE", path: request.url },
          network: { requestId: request.id },
          detail: "revoked api_key",
        });

        return reply.code(204).send();
      });
    },
    { prefix: "/internal/v1" },
  );
}
