import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Env } from "../env.js";

function headerFirst(
  request: FastifyRequest,
  lowerName: string,
): string | undefined {
  const v = request.headers[lowerName];
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (Array.isArray(v) && v[0] !== undefined) {
    const t = String(v[0]).trim();
    return t.length ? t : undefined;
  }
  return undefined;
}

/**
 * Reads optional compliance headers into `request.complianceMeta` for downstream audit rows.
 */
export function registerComplianceRequestHooks(
  app: FastifyInstance,
  env: Env,
): void {
  const breakGlassHeader = (
    env.BREAK_GLASS_HEADER ?? "x-break-glass-reason"
  ).toLowerCase();
  const purposeHeader = (
    env.PURPOSE_OF_USE_HEADER ?? "x-purpose-of-use"
  ).toLowerCase();

  app.addHook("onRequest", async (request) => {
    const breakGlassReason = headerFirst(request, breakGlassHeader)?.slice(
      0,
      500,
    );
    const purposeOfUse = headerFirst(request, purposeHeader)?.slice(0, 200);
    if (breakGlassReason || purposeOfUse) {
      request.complianceMeta = { breakGlassReason, purposeOfUse };
    }
  });
}
