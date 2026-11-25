# GAP 8 — Internal platform & developer experience

## OpenAPI 3 (partner subset)

Maintained spec: **`docs/openapi/hub-partner-api.yaml`**.

Covers `/fhir`, SMART/OAuth discovery + token paths, `/internal/v1` integration endpoints (API keys, MPI), and `/health` / `/ready` / optional `/internal/metrics`. Import into Postman, Stoplight, or codegen tools; adjust `servers.baseUrl` for your deployment.

## TypeScript client (`@fhir-hub/hub-client`)

Minimal **`fetch`** wrapper for API-key auth + FHIR JSON, SMART discovery, OAuth **`application/x-www-form-urlencoded`** token POST, and raw **`internalJson`** calls.

```typescript
import { HubClient } from "@fhir-hub/hub-client";

const hub = new HubClient({
  baseUrl: "http://127.0.0.1:3000",
  apiKey: process.env.HUB_API_KEY!,
});

const meta = await hub.getCapabilityStatement();
const patient = await hub.createResource("Patient", {
  resourceType: "Patient",
  identifier: [{ system: "http://example/mrn", value: "1" }],
  name: [{ family: "Doe", given: ["Jane"] }],
});
```

Build: `npm run build -w @fhir-hub/hub-client`.

## Sandbox fixtures

**`fixtures/sandbox/sample-patient.ndjson`** — one-line Patient for dry runs.

Load into a tenant after migrations + seed:

```bash
npm run import-tenant-ndjson -- --tenant dev-tenant-001 < fixtures/sandbox/sample-patient.ndjson
```

(Use your tenant `external_key`; remap flags optional.)

## Postman

- **`postman/FHIR-Hub-Partner.postman_collection.json`** — smoke folder structure (health, metadata, Patient POST/search, SMART discovery, internal api-keys).
- **`postman/local.postman_environment.json`** — `baseUrl`, `apiKey`, optional `metricsToken`.

Import both in Postman; set **`apiKey`** after `npm run seed`.

**Newman (optional):**

```bash
npx newman run postman/FHIR-Hub-Partner.postman_collection.json \
  -e postman/local.postman_environment.json \
  --env-var baseUrl=http://127.0.0.1:3000 \
  --env-var apiKey=YOUR_KEY
```

Requires **`hub-api` running** with DB + env; default CI does **not** start the server.

## CI gates

**`.github/workflows/ci.yml`** runs on push/PR to `main`/`master`:

1. **`build-test-lint`** — `npm ci`, build **`@fhir-hub/shared`** + **`@fhir-hub/hub-client`**, workspace **lint**, **typecheck**, **unit tests**.
2. **`migration-smoke`** — Postgres **16** service, **`DATABASE_URL`**, **`node scripts/apply-all-migrations.mjs`** (ordered `db/migrations/*.sql`).

### Optional full HTTP smoke (manual only)

**`.github/workflows/ci-http-smoke.yml`** — **`workflow_dispatch`** only (GitHub → **Actions** → **HTTP smoke (Newman)** → **Run workflow**). Spins Postgres, applies migrations, seeds with fixed **`CI_SEED_API_KEY`** (see `scripts/seed-phase1.mjs`), starts **`hub-api`**, waits for **`/health`**, runs **Newman** on **`postman/FHIR-Hub-Partner.postman_collection.json`**. Does **not** run on every PR.

Hosted long-lived sandboxes remain deployment-specific.

## Phase VI — partner surface changes

When adding or changing partner-visible HTTP behavior, use **`docs/templates/PARTNER_API_CHANGE_CHECKLIST.md`** and **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**.
