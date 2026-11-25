/**
 * Seeds a tenant + hashed API key. Run after migrations.
 * Usage: npm run seed  (from repo root)
 *
 * Loads `.env` from the repo root without the `dotenv` package so this works
 * even when node_modules is incomplete. Still requires `pg` (`npm install`).
 *
 * **CI / automation:** set `CI_SEED_API_KEY` to a fixed plaintext key so scripts
 * (e.g. Newman) can authenticate without parsing stdout. Ephemeral DB only.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env parser; does not override existing process.env. */
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
  console.error(
    "Missing package `pg`. From the repo root run: npm install\n",
    e.message,
  );
  process.exit(1);
}

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const tenantKey = process.env.DEV_TENANT_ID || "dev-tenant-001";

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Add it to .env in the repo root (see .env.example).",
    );
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const t = await client.query(
      `INSERT INTO tenant (external_key, display_name)
       VALUES ($1, $2)
       ON CONFLICT (external_key) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [tenantKey, "Development tenant"],
    );
    const tenantId = t.rows[0]?.id;
    if (!tenantId) throw new Error("tenant insert failed");

    const fromEnv =
      typeof process.env.CI_SEED_API_KEY === "string"
        ? process.env.CI_SEED_API_KEY.trim()
        : "";
    const rawKey =
      fromEnv.length > 0
        ? fromEnv
        : `hub_${randomBytes(32).toString("base64url")}`;
    const keyHash = sha256Hex(rawKey);
    await client.query(
      `INSERT INTO api_key (tenant_id, key_hash, label)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (key_hash) DO NOTHING`,
      [tenantId, keyHash, "seed-phase1"],
    );
    await client.query("COMMIT");
    console.log("Tenant external_key:", tenantKey);
    console.log("API key (store securely; shown once):");
    console.log(rawKey);
    console.log("Use: Authorization: Bearer <key>  or  X-Hub-Api-Key: <key>");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
