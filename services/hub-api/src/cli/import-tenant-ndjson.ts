/**
 * NDJSON tenant import with optional id remap + reference rewriting.
 *
 *   npm run import-ndjson -w @fhir-hub/hub-api -- --tenant <external_key> [--remap-file path.json] [--record-map]
 *
 * remap-file JSON shape: { "Patient": { "oldId": "newId" }, "Observation": { ... } }
 */
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  applyRemapToResource,
  type RemapByType,
} from "../fhir/reference-remap.js";
import type { FhirJson } from "../fhir/resource-store.js";
import { recordIdImportMap } from "../internal/mpi.js";

const rootDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

function loadEnvFromRepoRoot() {
  const p = join(rootDir, ".env");
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFromRepoRoot();

function nowIso() {
  return new Date().toISOString();
}

function ensureMeta(
  data: Record<string, unknown>,
  logicalId: string,
  versionId: number,
) {
  const meta =
    typeof data.meta === "object" && data.meta !== null
      ? { ...(data.meta as Record<string, unknown>) }
      : {};
  return {
    ...data,
    id: logicalId,
    meta: {
      ...meta,
      versionId: String(versionId),
      lastUpdated: nowIso(),
    },
  };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let tenant = "";
  let remapFile: string | null = null;
  let recordMap = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tenant" && argv[i + 1]) {
      tenant = argv[++i]!.trim();
    } else if (argv[i] === "--remap-file" && argv[i + 1]) {
      remapFile = argv[++i]!.trim();
    } else if (argv[i] === "--record-map") {
      recordMap = true;
    }
  }
  return { tenant, remapFile, recordMap };
}

async function upsertLine(
  client: pg.PoolClient,
  tenantId: string,
  raw: string,
  remap: RemapByType | null,
  recordMap: boolean,
): Promise<{ ok: boolean; reason?: string; action?: string }> {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const resourceType =
    typeof obj.resourceType === "string" ? obj.resourceType.trim() : "";
  const logicalIdBefore =
    typeof obj.id === "string" ? obj.id.trim() : "";
  if (!resourceType || !logicalIdBefore) {
    return { ok: false, reason: "missing_resourceType_or_id" };
  }

  let body = obj;
  if (remap && Object.keys(remap).length > 0) {
    body = applyRemapToResource(obj as FhirJson, remap);
    if (recordMap) {
      const newId =
        typeof body.id === "string" ? body.id.trim() : logicalIdBefore;
      if (newId !== logicalIdBefore) {
        await recordIdImportMap(
          client,
          tenantId,
          resourceType,
          logicalIdBefore,
          newId,
        );
      }
    }
  }

  const logicalId =
    typeof body.id === "string" ? body.id.trim() : logicalIdBefore;

  const existing = await client.query(
    `SELECT version_id, deleted FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3`,
    [tenantId, resourceType, logicalId],
  );

  if (existing.rows.length === 0) {
    const versionId = 1;
    const withMeta = ensureMeta(
      { ...body, resourceType },
      logicalId,
      versionId,
    );
    await client.query(
      `INSERT INTO fhir_resource (tenant_id, resource_type, logical_id, version_id, data, deleted, last_updated)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, false, NOW())`,
      [
        tenantId,
        resourceType,
        logicalId,
        versionId,
        JSON.stringify(withMeta),
      ],
    );
    return { ok: true, action: "insert" };
  }

  const row = existing.rows[0];
  const nextVid = row.version_id + 1;
  const withMeta = ensureMeta(
    { ...body, resourceType, id: logicalId },
    logicalId,
    nextVid,
  );
  await client.query(
    `UPDATE fhir_resource
     SET version_id = $4, data = $5::jsonb, deleted = false, last_updated = NOW()
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3`,
    [
      tenantId,
      resourceType,
      logicalId,
      nextVid,
      JSON.stringify(withMeta),
    ],
  );
  return {
    ok: true,
    action: row.deleted ? "revive" : "update",
  };
}

async function main() {
  const { tenant: externalKey, remapFile, recordMap } = parseArgs();
  if (!externalKey) {
    console.error(
      "Usage: import-ndjson --tenant <external_key> [--remap-file map.json] [--record-map] < stdin.ndjson",
    );
    process.exit(1);
  }

  let remap: RemapByType | null = null;
  if (remapFile) {
    const raw = readFileSync(remapFile, "utf8");
    remap = JSON.parse(raw) as RemapByType;
    if (!remap || typeof remap !== "object") {
      console.error("remap-file must be a JSON object");
      process.exit(1);
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const tr = await client.query(`SELECT id FROM tenant WHERE external_key = $1`, [
      externalKey,
    ]);
    const tenantId = tr.rows[0]?.id as string | undefined;
    if (!tenantId) {
      console.error(`Unknown tenant external_key: ${externalKey}`);
      process.exit(1);
    }

    let lineNo = 0;
    let inserted = 0;
    let updated = 0;
    let revived = 0;
    let errors = 0;

    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      lineNo++;
      await client.query("BEGIN");
      try {
        const r = await upsertLine(
          client,
          tenantId,
          trimmed,
          remap,
          recordMap,
        );
        if (!r.ok) {
          await client.query("ROLLBACK");
          errors++;
          console.error(`Line ${lineNo}: ${r.reason}`);
          continue;
        }
        await client.query("COMMIT");
        if (r.action === "insert") inserted++;
        else if (r.action === "revive") revived++;
        else updated++;
      } catch (e) {
        await client.query("ROLLBACK");
        errors++;
        console.error(
          `Line ${lineNo}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    console.error(
      JSON.stringify({
        lines: lineNo,
        inserted,
        updated,
        revived,
        errors,
        remap: Boolean(remap),
        recordMap,
      }),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
