/**
 * Applies every `db/migrations/*.sql` file in lexical order (fresh DB smoke).
 * Requires DATABASE_URL and `pg` (npm install at repo root).
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

let pg;
try {
  ({ default: pg } = await import("pg"));
} catch (e) {
  console.error("Missing package `pg`. Run: npm install\n", e.message);
  process.exit(1);
}

async function waitForDb(connectionString, attempts = 40, delayMs = 1000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
    });
    try {
      await pool.query("SELECT 1");
      await pool.end();
      return;
    } catch (e) {
      lastErr = e;
      await pool.end().catch(() => {});
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr ?? new Error("database not reachable");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  await waitForDb(databaseUrl);

  const migDir = join(rootDir, "db", "migrations");
  const names = (await readdir(migDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    for (const name of names) {
      const sql = await readFile(join(migDir, name), "utf8");
      await client.query(sql);
      console.log("applied:", name);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
