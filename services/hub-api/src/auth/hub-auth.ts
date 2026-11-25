import type pg from "pg";
import type { Env } from "../env.js";
import { extractBearer, resolveTenant } from "./api-key.js";
import { hasJwtSigningMaterial, verifyHubAccessToken } from "./jwt-access.js";

export type HubAuth =
  | { kind: "api-key"; tenantUuid: string; externalKey: string }
  | {
      kind: "jwt";
      tenantUuid: string;
      externalKey: string;
      patient?: string;
      scopes: string[];
      clientId: string;
    };

function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * API key via `X-Hub-Api-Key`, or Bearer (JWT first when configured, else API key hash).
 */
export async function resolveHubAuth(
  pool: pg.Pool,
  env: Env,
  authorization: string | undefined,
  xHubApiKey: string | undefined,
): Promise<HubAuth | null> {
  if (xHubApiKey?.trim()) {
    const r = await resolveTenant(pool, env, undefined, xHubApiKey);
    if (!r) return null;
    return {
      kind: "api-key",
      tenantUuid: r.tenantUuid,
      externalKey: r.externalKey,
    };
  }
  const bearer = extractBearer(authorization);
  if (!bearer) return null;
  if (looksLikeJwt(bearer) && hasJwtSigningMaterial(env)) {
    const j = await verifyHubAccessToken(env, bearer);
    if (j) {
      return {
        kind: "jwt",
        tenantUuid: j.tenantUuid,
        externalKey: j.externalKey,
        patient: j.patient,
        scopes: j.scopes,
        clientId: j.clientId,
      };
    }
  }
  const r = await resolveTenant(pool, env, authorization, undefined);
  if (!r) return null;
  return {
    kind: "api-key",
    tenantUuid: r.tenantUuid,
    externalKey: r.externalKey,
  };
}

export function hubAuthActorClientId(auth: HubAuth): string {
  return auth.kind === "api-key" ? "api-key" : auth.clientId;
}
