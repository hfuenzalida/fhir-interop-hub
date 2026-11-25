import type { AuditEvent } from "@fhir-hub/shared";
import pg from "pg";
import {
  auditEntryCanonicalJson,
  computeAuditRowHash,
  sha256Hex,
} from "./integrity.js";

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

export type PostgresAuditSinkOptions = {
  /** When false, insert without populating the integrity chain (columns stay null). */
  integrityEnabled: boolean;
  /** Optional HMAC key; see `computeAuditRowHash`. */
  chainSecret: string | undefined;
};

function redactAuditDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  return detail
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [REDACTED]")
    .replace(/x-hub-api-key[=:]\s*[\w-]+/gi, "x-hub-api-key=[REDACTED]");
}

/** Structured JSON lines to stdout (always on; operators aggregate from log stack). */
export class ConsoleAuditSink implements AuditSink {
  async append(event: AuditEvent): Promise<void> {
    const safe = {
      ...event,
      detail: redactAuditDetail(event.detail),
    };
    console.log(
      JSON.stringify({
        type: "AUDIT",
        ...safe,
      }),
    );
  }
}

/** Append-only Postgres sink (optional when DATABASE_URL is set). */
export class PostgresAuditSink implements AuditSink {
  constructor(
    private readonly pool: pg.Pool,
    private readonly opts: PostgresAuditSinkOptions = {
      integrityEnabled: true,
      chainSecret: undefined,
    },
  ) {}

  async append(event: AuditEvent): Promise<void> {
    if (!this.opts.integrityEnabled) {
      await this.legacyInsert(event);
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const head = await client.query<{
        last_event_id: string;
        last_row_hash: string;
      }>(
        `SELECT last_event_id, last_row_hash
         FROM audit_chain_head
         WHERE tenant_id = $1
         FOR UPDATE`,
        [event.actor.tenantId],
      );
      let chainPrevId: string | null = null;
      let prevRowHash: string | null = null;
      if (head.rows[0]) {
        chainPrevId = head.rows[0].last_event_id;
        prevRowHash = head.rows[0].last_row_hash;
      }
      const entryHash = sha256Hex(auditEntryCanonicalJson(event));
      const rowHash = computeAuditRowHash(
        prevRowHash,
        entryHash,
        this.opts.chainSecret,
      );

      await client.query(
        `INSERT INTO audit_event (
          id, tenant_id, timestamp, action, outcome,
          actor, entity, api, network, detail,
          chain_prev_id, entry_hash, row_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          event.id,
          event.actor.tenantId,
          event.timestamp,
          event.action,
          event.outcome,
          JSON.stringify(event.actor),
          JSON.stringify(event.entity),
          JSON.stringify(event.api),
          event.network ? JSON.stringify(event.network) : null,
          event.detail ?? null,
          chainPrevId,
          entryHash,
          rowHash,
        ],
      );

      await client.query(
        `INSERT INTO audit_chain_head (tenant_id, last_event_id, last_row_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id) DO UPDATE
         SET last_event_id = EXCLUDED.last_event_id,
             last_row_hash = EXCLUDED.last_row_hash`,
        [event.actor.tenantId, event.id, rowHash],
      );
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async legacyInsert(event: AuditEvent): Promise<void> {
    const q = `
      INSERT INTO audit_event (
        id, tenant_id, timestamp, action, outcome,
        actor, entity, api, network, detail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await this.pool.query(q, [
      event.id,
      event.actor.tenantId,
      event.timestamp,
      event.action,
      event.outcome,
      JSON.stringify(event.actor),
      JSON.stringify(event.entity),
      JSON.stringify(event.api),
      event.network ? JSON.stringify(event.network) : null,
      event.detail ?? null,
    ]);
  }
}

export class FanoutAuditSink implements AuditSink {
  constructor(private readonly sinks: AuditSink[]) {}

  async append(event: AuditEvent): Promise<void> {
    await Promise.all(this.sinks.map((s) => s.append(event)));
  }
}
