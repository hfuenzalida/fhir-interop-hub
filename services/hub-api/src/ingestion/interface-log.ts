import { createHash } from "node:crypto";
import type pg from "pg";

export type InterfaceConnector = "fhir_bundle" | "hl7v2_oru";

export async function logInterfaceMessage(
  pool: pg.Pool,
  input: {
    tenantUuid: string;
    connector: InterfaceConnector;
    status: "success" | "failed";
    raw?: string;
    error?: string;
    outcome?: unknown;
  },
): Promise<string> {
  const rawSha256 = input.raw
    ? createHash("sha256").update(input.raw, "utf8").digest("hex")
    : null;
  const rawPreview =
    input.raw !== undefined ? input.raw.slice(0, 4000) : null;
  const processedAt = new Date();
  const r = await pool.query<{ id: string }>(
    `INSERT INTO interface_message (
       tenant_id, connector, status, raw_sha256, raw_preview, error, outcome, processed_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING id`,
    [
      input.tenantUuid,
      input.connector,
      input.status,
      rawSha256,
      rawPreview,
      input.error ?? null,
      input.outcome !== undefined ? JSON.stringify(input.outcome) : null,
      processedAt,
    ],
  );
  return r.rows[0]!.id;
}

export async function getInterfaceMetrics24h(
  pool: pg.Pool,
  tenantUuid: string,
): Promise<{
  byStatus: { status: string; count: number }[];
  /** Total rows for tenant (helps debug empty 24h window). */
  totalRowsAllTime: number;
}> {
  const window = await pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
     FROM interface_message
     WHERE tenant_id = $1::uuid
       AND created_at > NOW() - INTERVAL '24 hours'
     GROUP BY status
     ORDER BY status`,
    [tenantUuid],
  );
  const allTime = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM interface_message WHERE tenant_id = $1::uuid`,
    [tenantUuid],
  );
  const totalRowsAllTime = parseInt(allTime.rows[0]?.n ?? "0", 10);
  const byStatus = window.rows.map((row) => ({
    status: row.status,
    count: parseInt(row.count, 10),
  }));
  return { byStatus, totalRowsAllTime };
}
