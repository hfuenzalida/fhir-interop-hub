import { createHash, timingSafeEqual } from "node:crypto";
import type pg from "pg";
import type { Env } from "../env.js";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function extractBearer(
  authorization: string | undefined,
): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export type ResolvedTenant = {
  tenantUuid: string;
  externalKey: string;
};

/**
 * Resolves tenant from Bearer / X-Hub-Api-Key.
 * - Optional DEV_API_KEY matches DEV_TENANT_ID row in DB.
 * - Otherwise SHA-256(api_key) lookup in api_key.
 */
export async function resolveTenant(
  pool: pg.Pool,
  env: Env,
  authorization: string | undefined,
  xHubApiKey: string | undefined,
): Promise<ResolvedTenant | null> {
  const token = extractBearer(authorization) ?? xHubApiKey?.trim();
  if (!token) return null;

  if (env.DEV_API_KEY && timingSafeStringEqual(token, env.DEV_API_KEY)) {
    const r = await pool.query<{ id: string; external_key: string }>(
      `SELECT id, external_key FROM tenant WHERE external_key = $1 LIMIT 1`,
      [env.DEV_TENANT_ID],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { tenantUuid: row.id, externalKey: row.external_key };
  }

  const hash = sha256Hex(token);
  const r = await pool.query<{ id: string; external_key: string }>(
    `SELECT t.id, t.external_key
     FROM api_key k
     JOIN tenant t ON t.id = k.tenant_id
     WHERE k.key_hash = $1
     LIMIT 1`,
    [hash],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { tenantUuid: row.id, externalKey: row.external_key };
}
