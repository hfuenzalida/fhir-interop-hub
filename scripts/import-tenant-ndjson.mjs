/**
 * Minimal NDJSON upsert (no id/reference remap). Prefer:
 *   npm run import-tenant-ndjson -- --tenant <external_key> [--remap-file map.json] [--record-map]
 *
 * Usage:
 *   node ./scripts/import-tenant-ndjson.mjs --tenant <external_key> < bundle.ndjson
 *
 * Requires DATABASE_URL.
 */
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
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

loadEnvFile();

let pg;
try {
  ({ default: pg } = await import("pg"));
} catch (e) {
  console.error("Missing package `pg`. Run: npm install\n", e.message);
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureMeta(data, logicalId, versionId) {
  const meta =
    typeof data.meta === "object" && data.meta !== null
      ? { ...data.meta }
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

function argvTenant() {
  const i = process.argv.indexOf("--tenant");
  if (i === -1 || !process.argv[i + 1]) {
    console.error(
      "Usage: node import-tenant-ndjson.mjs --tenant <external_key> < stdin NDJSON",
    );
    process.exit(1);
  }
  return process.argv[i + 1].trim();
}

async function upsertLine(client, tenantId, raw) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  const resourceType =
    typeof obj.resourceType === "string" ? obj.resourceType.trim() : "";
  const logicalId = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!resourceType || !logicalId) {
    return { ok: false, reason: "missing_resourceType_or_id" };
  }

  const existing = await client.query(
    `SELECT version_id, deleted FROM fhir_resource
     WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3`,
    [tenantId, resourceType, logicalId],
  );

  if (existing.rows.length === 0) {
    const versionId = 1;
    const withMeta = ensureMeta(
      { ...obj, resourceType },
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
    { ...obj, resourceType, id: logicalId },
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
  const externalKey = argvTenant();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (.env at repo root).");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const tr = await client.query(`SELECT id FROM tenant WHERE external_key = $1`, [
      externalKey,
    ]);
    const tenantId = tr.rows[0]?.id;
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
        const r = await upsertLine(client, tenantId, trimmed);
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
        console.error(`Line ${lineNo}:`, e.message || e);
      }
    }

    console.error(
      JSON.stringify({
        lines: lineNo,
        inserted,
        updated,
        revived,
        errors,
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
