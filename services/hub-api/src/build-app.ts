import "./env-bootstrap.js";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import formbody from "@fastify/formbody";
import pg from "pg";
import {
  type AuditEvent,
  US_CORE_PACKAGE,
  US_CORE_VERSION,
  FHIR_VERSION,
} from "@fhir-hub/shared";
import { registerComplianceRequestHooks } from "./audit/compliance-hooks.js";
import { emitAudit } from "./audit/emit-audit.js";
import { loadEnv, type Env } from "./env.js";
import {
  createPrimaryPool,
  createReadReplicaPool,
} from "./db/pool-factory.js";
import { assertJsonDepthLimit } from "./security/json-depth.js";
import { registerSecurityPlugins } from "./security/register-security.js";
import {
  ConsoleAuditSink,
  FanoutAuditSink,
  PostgresAuditSink,
  type AuditSink,
} from "./audit/sink.js";
import { registerFhirRoutes } from "./fhir/plugin.js";
import { registerIngestionRoutes } from "./ingestion/plugin.js";
import { registerSmartRoutes } from "./smart/plugin.js";
import { registerApiKeyManagementRoutes } from "./internal/api-keys-plugin.js";
import { registerMpiRoutes } from "./internal/mpi-plugin.js";
import { registerUsageRoutes } from "./internal/usage-plugin.js";
import { operationOutcome } from "./fhir/operation-outcome.js";
import { buildCapabilityStatement } from "./fhir/capability.js";
import { TtlCache } from "./util/ttl-cache.js";
import { registerCorrelationLogging } from "./observability/correlation-logging.js";
import {
  initPrometheusMetrics,
  registerHttpMetricsHooks,
} from "./observability/prometheus-metrics.js";
import { registerInternalObservabilityRoutes } from "./observability/register-internal-routes.js";

function buildAuditSink(
  pool: pg.Pool | undefined,
  env: Env,
): { sink: AuditSink; close: () => Promise<void> } {
  const consoleSink = new ConsoleAuditSink();
  if (!pool) {
    return {
      sink: consoleSink,
      close: async () => {},
    };
  }
  return {
    sink: new FanoutAuditSink([
      consoleSink,
      new PostgresAuditSink(pool, {
        integrityEnabled: env.AUDIT_INTEGRITY_ENABLED,
        chainSecret: env.AUDIT_CHAIN_SECRET,
      }),
    ]),
    close: async () => {},
  };
}

function syntheticHealthCheckAuditInput(
  tenantId: string,
  requestId: string,
): Omit<AuditEvent, "id" | "timestamp"> {
  return {
    action: "READ",
    outcome: "success",
    actor: {
      tenantId,
      subject: undefined,
      clientId: "hub-internal-health",
      role: "system",
    },
    entity: { type: "System", id: "health" },
    api: { method: "GET", path: "/health" },
    network: { requestId },
    detail: "Synthetic audit for connectivity check",
  };
}

async function registerFhirUnavailable(app: FastifyInstance): Promise<void> {
  await app.register(
    async (r) => {
      r.route({
        method: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
        url: "/*",
        handler: async (_req, reply) => {
          return reply
            .code(503)
            .type("application/fhir+json")
            .send(
              operationOutcome(
                "error",
                "not-supported",
                "FHIR API requires DATABASE_URL (Phase 1).",
              ),
            );
        },
      });
    },
    { prefix: "/fhir" },
  );
}

export type BuiltHubApplication = {
  app: FastifyInstance;
  env: Env;
  close: () => Promise<void>;
};

/**
 * Builds configured Fastify app + DB pools (no listen). Used by `index.ts` and integration tests.
 */
export async function buildHubApplication(): Promise<BuiltHubApplication> {
  const env = loadEnv();
  initPrometheusMetrics(env);
  const pool = env.DATABASE_URL ? createPrimaryPool(env) : undefined;
  const poolRead =
    pool && env.DATABASE_READ_URL
      ? createReadReplicaPool(env)
      : undefined;

  const { sink, close: closeAudit } = buildAuditSink(pool, env);
  const capabilityCache = new TtlCache<Record<string, unknown>>(
    env.CAPABILITY_CACHE_TTL_MS,
  );

  const logLevel =
    env.LOG_LEVEL ?? (env.NODE_ENV === "development" ? "info" : "warn");

  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: logLevel,
            ...(env.LOG_REDACT_ENABLED
              ? {
                  redact: [
                    "req.headers.authorization",
                    'req.headers["x-hub-api-key"]',
                    'req.headers["X-Hub-Api-Key"]',
                  ],
                }
              : {}),
          },
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
    bodyLimit: env.REQUEST_BODY_LIMIT_BYTES,
    trustProxy: env.TRUST_PROXY,
  });

  registerHttpMetricsHooks(app);
  registerCorrelationLogging(app, env);
  registerComplianceRequestHooks(app, env);
  await registerSecurityPlugins(app, env);
  await app.register(formbody);

  const fhirBodyLimit = env.REQUEST_BODY_LIMIT_BYTES;

  app.addContentTypeParser(
    /^application\/(fhir\+json|json\+fhir)/i,
    { parseAs: "string", bodyLimit: fhirBodyLimit },
    (_req, body, done) => {
      try {
        const parsed: unknown = JSON.parse(body as string);
        const depthErr = assertJsonDepthLimit(parsed, env.FHIR_JSON_MAX_DEPTH);
        if (depthErr) {
          done(
            Object.assign(new Error(depthErr), { statusCode: 400 }),
            undefined,
          );
          return;
        }
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  const textPlainLimit = Math.min(
    fhirBodyLimit,
    env.HL7_INGEST_MAX_CHARS + 65_536,
  );

  app.addContentTypeParser(
    "text/plain",
    { parseAs: "string", bodyLimit: textPlainLimit },
    (_req, body, done) => {
      done(null, body);
    },
  );

  if (pool) {
    app.decorate("pg", pool);
    if (poolRead) {
      app.decorate("pgRead", poolRead);
    }
    app.decorate("auditSink", sink);

    app.get("/fhir/metadata", async (request, reply) => {
      const proto =
        request.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ??
        "http";
      const host = request.headers.host ?? "localhost";
      const base = `${proto}://${host}`;
      const cached = capabilityCache.get(base);
      if (cached) {
        return reply.code(200).type("application/fhir+json").send(cached);
      }
      const body = buildCapabilityStatement(base) as Record<string, unknown>;
      capabilityCache.set(base, body);
      return reply.code(200).type("application/fhir+json").send(body);
    });

    await registerFhirRoutes(app, { env });
    await registerIngestionRoutes(app, { env, sink });
    await registerSmartRoutes(app, { env, sink });
    await registerApiKeyManagementRoutes(app, { env, sink });
    await registerMpiRoutes(app, { env, sink });
    await registerUsageRoutes(app, { env, sink });
  } else {
    await registerFhirUnavailable(app);
  }

  app.get("/health", async (request, reply) => {
    await emitAudit(
      sink,
      request,
      syntheticHealthCheckAuditInput(env.DEV_TENANT_ID, request.id),
    );
    return reply.send({
      status: "ok",
      phase: 7,
      fhir: {
        version: FHIR_VERSION,
        usCore: `${US_CORE_PACKAGE}#${US_CORE_VERSION}`,
      },
      dataPlane: pool ? "connected" : "no_database",
    });
  });

  app.get("/ready", async (_request, reply) => {
    if (!pool) {
      return reply.code(503).send({
        status: "not_ready",
        reason: "DATABASE_URL not configured",
      });
    }
    try {
      await pool.query("SELECT 1");
      let readReplica: "ok" | "skipped" | "unreachable" = "skipped";
      if (poolRead) {
        try {
          await poolRead.query("SELECT 1");
          readReplica = "ok";
        } catch {
          readReplica = "unreachable";
        }
      }
      return reply.send({ status: "ready", readReplica });
    } catch {
      return reply
        .code(503)
        .send({ status: "not_ready", reason: "database_unreachable" });
    }
  });

  await registerInternalObservabilityRoutes(
    app,
    env,
    pool ? { primary: pool, read: poolRead } : undefined,
  );

  const close = async () => {
    await app.close();
    await closeAudit();
    if (poolRead) await poolRead.end();
    if (pool) await pool.end();
  };

  return { app, env, close };
}
