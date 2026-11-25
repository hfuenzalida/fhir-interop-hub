import type { FastifyInstance } from "fastify";
import type { Env } from "../env.js";

/**
 * Binds `correlationId` on the request logger when the configured header is present
 * (defaults to `x-correlation-id`). Complements `x-request-id` (request id).
 */
export function registerCorrelationLogging(
  app: FastifyInstance,
  env: Env,
): void {
  const headerName = (env.CORRELATION_ID_HEADER ?? "x-correlation-id").toLowerCase();
  app.addHook("onRequest", async (request) => {
    const raw = request.headers[headerName];
    const val =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw[0]
          : undefined;
    const trimmed = val !== undefined ? String(val).trim() : "";
    if (trimmed.length > 0) {
      request.log = request.log.child({ correlationId: trimmed });
    }
  });
}
