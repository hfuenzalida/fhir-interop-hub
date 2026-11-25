/**
 * Export live FHIR resources for one tenant as NDJSON (one JSON resource per line).
 *
 * Usage:
 *   node ./scripts/export-tenant-ndjson.mjs --tenant <external_key> > bundle.ndjson
 *
 * Requires DATABASE_URL (see repo root .env).
 */
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
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

function argvTenant() {
  const i = process.argv.indexOf("--tenant");
  if (i === -1 || !process.argv[i + 1]) {
    console.error("Usage: node export-tenant-ndjson.mjs --tenant <external_key>");
    process.exit(1);
  }
  return process.argv[i + 1].trim();
}

async function main() {
  const externalKey = argvTenant();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (.env at repo root).");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const tr = await pool.query(`SELECT id FROM tenant WHERE external_key = $1`, [
      externalKey,
    ]);
    const tenantId = tr.rows[0]?.id;
    if (!tenantId) {
      console.error(`Unknown tenant external_key: ${externalKey}`);
      process.exit(1);
    }

    const cursor = await pool.query(
      `SELECT data FROM fhir_resource
       WHERE tenant_id = $1::uuid AND NOT deleted
       ORDER BY resource_type, logical_id`,
      [tenantId],
    );

    const out = process.stdout;
    for (const row of cursor.rows) {
      out.write(`${JSON.stringify(row.data)}\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
