import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import type { Env } from "../env.js";
import { operationOutcome } from "../fhir/operation-outcome.js";
import { buildCorsOptions } from "./cors-config.js";

export async function registerSecurityPlugins(
  app: FastifyInstance,
  env: Env,
): Promise<void> {
  await app.register(cors, buildCorsOptions(env));

  if (!env.RATE_LIMIT_ENABLED) return;

  await app.register(rateLimit, {
    global: true,
    hook: "onRequest",
    max: (req) => {
      const path = (req.url ?? "").split("?")[0] ?? "";
      if (path.startsWith("/oauth/token") || path.startsWith("/oauth/authorize")) {
        return env.RATE_LIMIT_OAUTH_MAX;
      }
      return env.RATE_LIMIT_GLOBAL_MAX;
    },
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req) => {
      const keyHdr = req.headers["x-hub-api-key"];
      const apiFrag =
        typeof keyHdr === "string" ? keyHdr.slice(0, 24) : "nokey";
      return `${req.ip}:${apiFrag}`;
    },
    allowList: env.RATE_LIMIT_ALLOW_LOOPBACK
      ? (req) => {
          const ip = req.ip;
          return ip === "127.0.0.1" || ip === "::1";
        }
      : undefined,
    errorResponseBuilder: (req, context) => {
      const retrySec = Math.max(1, Math.ceil(context.ttl / 1000));
      const path = (req.url ?? "").split("?")[0] ?? "";
      if (path.startsWith("/fhir")) {
        return {
          statusCode: 429,
          ...operationOutcome(
            "error",
            "processing",
            `Rate limit exceeded. Retry after ${retrySec} seconds.`,
          ),
        };
      }
      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Retry after ${retrySec} seconds.`,
      };
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });
}
