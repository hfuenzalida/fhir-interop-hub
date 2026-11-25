import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { renderMetricsText, refreshPgPoolGauges } from "./prometheus-metrics.js";
import type { Env } from "../env.js";

/**
 * `GET /internal/metrics` — Prometheus text format.
 * When `INTERNAL_METRICS_TOKEN` is set, requires `Authorization: Bearer <token>`.
 */
export async function registerInternalObservabilityRoutes(
  app: FastifyInstance,
  env: Env,
  pools?: { primary: pg.Pool; read?: pg.Pool },
): Promise<void> {
  if (!env.METRICS_ENABLED) return;

  await app.register(
    async (r) => {
      r.get("/metrics", async (request, reply) => {
        if (env.INTERNAL_METRICS_TOKEN) {
          const want = `Bearer ${env.INTERNAL_METRICS_TOKEN}`;
          if (request.headers.authorization !== want) {
            return reply.code(401).type("text/plain").send("Unauthorized");
          }
        }
        if (pools) {
          refreshPgPoolGauges(pools.primary, pools.read);
        }
        const body = await renderMetricsText();
        return reply
          .type("text/plain; version=0.0.4; charset=utf-8")
          .send(body);
      });
    },
    { prefix: "/internal" },
  );
}
