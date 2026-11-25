# GAP 9 — Testing & quality assurance

## Integration tests (HTTP + Postgres)

**`services/hub-api/test/integration/hub.integration.test.ts`** exercises the running Fastify stack via **`inject()`** (no TCP listen):

- **FHIR Patient CRUD** — create, read, update, delete, verify 404 after soft-delete.
- **Transaction Bundle rollback** — valid `PUT Patient/{id}` followed by invalid `POST Observation`; expects HTTP **400** and **no** persisted Patient (rolled back).
- **Batch Bundle partial failure** — first entry succeeds (`201`), second returns **`400`** + **OperationOutcome** on that entry; HTTP **200** overall.
- **Performance smoke** — repeated **`GET /fhir/metadata`**; median latency must stay below **`PERF_METADATA_MAX_MS`** (default **4000 ms**) for noisy CI runners.

### Enabling locally

Requires **`DATABASE_URL`**, migrations applied, tenant + API key seeded (same key you pass to tests):

```bash
set DATABASE_URL=postgresql://hub:hub@localhost:5432/hub
set RUN_INTEGRATION_TESTS=1
set CI_SEED_API_KEY=your_plaintext_key
npm run seed
npm run test:integration -w @fhir-hub/hub-api
```

Or set **`INTEGRATION_API_KEY`** instead of **`CI_SEED_API_KEY`** if you use a random seed (must match the hash stored for the tenant).

When **`RUN_INTEGRATION_TESTS`** is unset and **`CI`** is not true, the suite is **skipped** so default **`npm test`** stays fast and DB-free.

### App factory

**`services/hub-api/src/build-app.ts`** exports **`buildHubApplication()`** so tests (and **`src/index.ts`**) share one wiring path.

## CI

**`.github/workflows/ci.yml`** includes an **`integration-tests`** job: Postgres **16**, **`apply-all-migrations`**, **`npm run seed`** with fixed **`CI_SEED_API_KEY`**, then **`npm run test:integration`**.

## Conformance (Touchstone / Inferno)

Not automated in-repo. For US Core / SMART certification, run vendor tooling against a deployed hub using credentials from your environment; pin **`US_CORE_PACKAGE`** / **`US_CORE_VERSION`** from **`@fhir-hub/shared`** in procurement artifacts.

**Phase VII — evidence tracking:** use **`docs/templates/CONFORMANCE_EVIDENCE_PACK.md`** per release tag; see **`docs/PROD_PHASE7_QUALITY.md`**.

## Performance regression

The integration suite includes a **median latency** check on **`GET /fhir/metadata`**. For heavier benchmarks (k6, soak tests), add scripts under **`scripts/perf/`** and gate releases manually or via an optional workflow.

## Chaos / failure injection

Out of scope for automated CI — exercise in **staging** per **`docs/runbooks/CHAOS_NONPROD.md`** (DB kill, failover, skew).
