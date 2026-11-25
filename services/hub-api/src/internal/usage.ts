import type pg from "pg";

export type AuditActionCount = { action: string; count: number };

/**
 * Rollup of append-only `audit_event` rows for a tenant (tenant_id = external key string).
 */
export async function summarizeTenantAudit(
  pool: pg.Pool,
  tenantExternalKey: string,
  hours: number,
): Promise<{ byAction: AuditActionCount[]; total: number; hours: number }> {
  const h = Math.min(168, Math.max(1, Math.floor(hours)));
  const by = await pool.query<{ action: string; c: string }>(
    `SELECT action, count(*)::text AS c
     FROM audit_event
     WHERE tenant_id = $1
       AND timestamp >= NOW() - ($2::double precision * INTERVAL '1 hour')
     GROUP BY action
     ORDER BY action`,
    [tenantExternalKey, h],
  );
  const totalR = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c
     FROM audit_event
     WHERE tenant_id = $1
       AND timestamp >= NOW() - ($2::double precision * INTERVAL '1 hour')`,
    [tenantExternalKey, h],
  );
  const total = Number(totalR.rows[0]?.c ?? "0");
  const byAction = by.rows.map((row) => ({
    action: row.action,
    count: Number(row.c),
  }));
  return { byAction, total, hours: h };
}
