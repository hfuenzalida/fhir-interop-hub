import { randomBytes } from "node:crypto";
import type pg from "pg";
import { sha256Hex } from "../auth/api-key.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export async function listTenantApiKeys(
  pool: pg.Pool,
  tenantUuid: string,
): Promise<{ id: string; label: string | null; created_at: string }[]> {
  const r = await pool.query<{
    id: string;
    label: string | null;
    created_at: Date;
  }>(
    `SELECT id::text, label, created_at
     FROM api_key
     WHERE tenant_id = $1::uuid
     ORDER BY created_at DESC`,
    [tenantUuid],
  );
  return r.rows.map((row) => ({
    id: row.id,
    label: row.label,
    created_at: row.created_at.toISOString(),
  }));
}

/** Returns plaintext API key exactly once — store only SHA-256 in DB. */
export async function insertTenantApiKey(
  pool: pg.Pool,
  tenantUuid: string,
  label: string | undefined,
): Promise<{ id: string; plaintextKey: string }> {
  const plaintextKey = `hub_${randomBytes(32).toString("base64url")}`;
  const keyHash = sha256Hex(plaintextKey);
  const ins = await pool.query<{ id: string }>(
    `INSERT INTO api_key (tenant_id, key_hash, label)
     VALUES ($1::uuid, $2, $3)
     RETURNING id::text`,
    [tenantUuid, keyHash, label ?? null],
  );
  const row = ins.rows[0];
  if (!row) throw new Error("api_key insert failed");
  return { id: row.id, plaintextKey };
}

export async function revokeTenantApiKeyById(
  pool: pg.Pool,
  tenantUuid: string,
  keyId: string,
): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM api_key WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantUuid, keyId],
  );
  return (res.rowCount ?? 0) > 0;
}
