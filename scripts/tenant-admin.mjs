/**
 * Operator CLI: tenants + API key metadata + OAuth clients (no secrets).
 * Requires DATABASE_URL and root `pg` package (`npm install`).
 *
 *   npm run tenant-admin -- list-tenants
 *   npm run tenant-admin -- show --external-key <tenant_external_key>
 */
import pg from "pg";

function usage() {
  console.log(`Usage:
  node scripts/tenant-admin.mjs list-tenants
  node scripts/tenant-admin.mjs show --external-key <external_key>
`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    if (cmd === "list-tenants") {
      const r = await pool.query(
        `SELECT id::text, external_key, created_at
         FROM tenant
         ORDER BY external_key`,
      );
      console.log(JSON.stringify(r.rows, null, 2));
      return;
    }

    if (cmd === "show") {
      let ext;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === "--external-key" && argv[i + 1]) {
          ext = argv[i + 1];
          break;
        }
      }
      if (!ext) {
        console.error("Missing --external-key");
        usage();
        process.exit(1);
      }

      const t = await pool.query(
        `SELECT id::text, external_key, created_at FROM tenant WHERE external_key = $1 LIMIT 1`,
        [ext],
      );
      const tenant = t.rows[0];
      if (!tenant) {
        console.error(`No tenant with external_key=${ext}`);
        process.exit(1);
      }

      const keys = await pool.query(
        `SELECT id::text, label, created_at
         FROM api_key
         WHERE tenant_id = $1::uuid
         ORDER BY created_at DESC`,
        [tenant.id],
      );

      const clients = await pool.query(
        `SELECT client_id, name, is_public, redirect_uris, created_at
         FROM oauth_client
         WHERE tenant_id = $1::uuid
         ORDER BY client_id`,
        [tenant.id],
      );

      console.log(
        JSON.stringify(
          {
            tenant,
            apiKeys: keys.rows,
            oauthClients: clients.rows,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
