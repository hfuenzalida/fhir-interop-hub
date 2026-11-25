# FHIR Interoperability Hub

## Business case

Health systems and digital health vendors cannot afford a full **EHR rip-and-replace** for every innovation, yet regulators and buyers expect **FHIR-native exchange**, SMART apps, and **auditable access** to clinical data. The gap is a **controlled hub** where new apps ingest, read, and extend data without becoming the system of record for the entire hospital.

This hub is deliberately a **beachhead**: FHIR R4 JSON APIs, tenant-scoped keys, SQL migrations, WORM-style audit events, and paths toward OAuth/SMART and commercial metering ([docs/GAP10_COMMERCIAL.md](docs/GAP10_COMMERCIAL.md))—sitting **next to** incumbent EHRs, not claiming to replace them. **Intent:** give partners and integrators a **credible interoperability product skeleton** (shared types, hub client, hub-api) they can deploy and extend, with phased gaps documented for testing, production delivery, and GTM.

**Stack:** Node.js 22+ · TypeScript · Fastify · PostgreSQL · Docker  
**License:** [MIT](LICENSE)  
**Topics:** `fhir` · `healthcare` · `smart-on-fhir` · `interop` · `typescript` · `hl7`

---

## Request workflow

<p align="center">
  <img src="docs/workflows/fhir-request.svg" alt="SMART app or partner client through hub-api auth to PostgreSQL FHIR store and audit trail" width="880"/>
</p>

---

## Product intent (phases 1–7)

Beachhead: **FHIR data hub + SMART on FHIR apps** adjacent to incumbent EHRs. This repo holds shared types, audit taxonomy, and **hub-api** with a **FHIR R4 JSON** REST API (`/fhir`).

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Docker (recommended, for local Postgres)

## Quick start

```bash
npm install
npm run build -w @fhir-hub/shared
```

### Database + migrations (required for FHIR)

```bash
docker compose up -d postgres
set PGPASSWORD=hub
psql -h localhost -U hub -d hub -f db/migrations/001_audit_event.sql
psql -h localhost -U hub -d hub -f db/migrations/002_phase1_tenant_fhir.sql
psql -h localhost -U hub -d hub -f db/migrations/003_phase2_interface.sql
# … apply 004+ in numeric order for OAuth, search, GAPs (see db/migrations/). For audit chain + WORM:
psql -h localhost -U hub -d hub -f db/migrations/009_audit_integrity_consent_support.sql
```

Copy `.env.example` to `.env`, set `DATABASE_URL=postgresql://hub:hub@localhost:5432/hub`.

### API key

```bash
npm run seed
```

Copy the printed API key into your shell (shown once). Ensure `DEV_TENANT_ID` in `.env` matches the seeded tenant (`dev-tenant-001` by default).

### Run

```bash
npm run dev:hub
```

**CapabilityStatement (no auth):**

```bash
curl -s http://127.0.0.1:3000/fhir/metadata
```

**Create a Patient (replace `YOUR_KEY`):**

```bash
curl -s -X POST http://127.0.0.1:3000/fhir/Patient ^
  -H "Authorization: Bearer YOUR_KEY" ^
  -H "Content-Type: application/fhir+json" ^
  -d "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"Doe\",\"given\":[\"Jane\"]}],\"gender\":\"female\",\"birthDate\":\"1990-01-01\"}"
```

(Use `\` line continuations on bash/macOS instead of `^`.)

**Health / readiness**

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/ready
```

**Prometheus** (when `METRICS_ENABLED=true`): `curl -s http://127.0.0.1:3000/internal/metrics` — set **`INTERNAL_METRICS_TOKEN`** in production and send `Authorization: Bearer …`.

**Usage & GTM (GAP 10):** tenant-scoped **`GET /internal/v1/usage/summary`** (Bearer API key); metering counters include **`hub_metered_requests_total`**. Operators with **`DATABASE_URL`** can run **`npm run tenant-admin -- list-tenants`** or **`npm run tenant-admin -- show --external-key YOUR_KEY`** (metadata only — see **`docs/GAP10_COMMERCIAL.md`**).

Without `DATABASE_URL`, `/fhir/*` (except what you add later) returns **503**; `/health` still responds with `dataPlane: "no_database"`.

### Container image (Phase I — **`docs/PROD_PHASE1_DELIVERY.md`**)

Requires [Docker](https://docs.docker.com/get-docker/). Build the API image from the repo root: **`npm run docker:build`**. For API + Postgres (stage-like): **`npm run docker:compose:hub`**, then apply migrations against the exposed DB (**`npm run migrate:apply-all`** with `DATABASE_URL` pointing at Postgres). TLS and cloud networking are **not** included — see **`deploy/README.md`**.

## Layout

| Path | Purpose |
|------|---------|
| `packages/shared` | FHIR IG pins, Phase 1 resource allowlist, audit types |
| `packages/hub-client` | Minimal TypeScript client (`@fhir-hub/hub-client`) for partners |
| `services/hub-api` | FHIR REST, ingestion (`/internal/v1`), API-key auth, audit |
| `db/migrations` | SQL migrations |
| `docs/openapi/hub-partner-api.yaml` | OpenAPI 3 partner subset (`/fhir`, OAuth, `/internal/v1`) |
| `postman/` | Postman collection + local environment (smoke requests) |
| `fixtures/sandbox/` | Sample NDJSON for import dry-runs |
| `scripts/seed-phase1.mjs` | Tenant + API key |
| `scripts/apply-all-migrations.mjs` | Apply all `db/migrations/*.sql` in order (CI + local smoke) |
| `scripts/load/` | k6 smoke (**`scripts/load/README.md`**) — Phase III capacity / Phase VII perf |
| `scripts/perf/` | Optional soak/heavier benchmarks (**`scripts/perf/README.md`**) |
| `docs/prometheus/` | Scrape **`/internal/metrics`** + example alert rules (**Phase IV**) |
| `docs/` | GAP guides (**`docs/GAP9_TESTING.md`**, **`docs/GAP10_COMMERCIAL.md`**, …); rollout **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`** → **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:hub` | Hub API with watch |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run migrate:apply-all` | Run every SQL migration in order (needs `DATABASE_URL`) |
| `npm run seed` | Insert dev tenant + API key (optional **`CI_SEED_API_KEY`** for fixed keys in CI) |
| `npm run test:integration` | Postgres + Fastify **`inject`** suite (needs **`RUN_INTEGRATION_TESTS=1`**, **`DATABASE_URL`**, seeded key — see **`docs/GAP9_TESTING.md`**) |
| `npm test` | Unit tests (hub-api) |
| `npm run docker:build` | **`Dockerfile`** → tag `fhir-hub-api:local` |
| `npm run docker:compose:hub` | Compose stack (**`docker-compose.hub.yml`**) — run **`migrate:apply-all`** after Postgres is up |

## CI

Push/PR runs **`.github/workflows/ci.yml`** (build/lint/typecheck/unit tests, migration smoke, **`integration-tests`** job with Postgres + **`test:integration`**), **`docker-build.yml`** ( **`Dockerfile`** build), **`codeql.yml`** (CodeQL SAST), and **`dependency-audit.yml`** (`npm audit` on hub-api). Optional **full HTTP smoke**: GitHub **Actions** → **HTTP smoke (Newman)** (**`workflow_dispatch`** only) — **`docs/GAP8_PLATFORM.md`**. Phase II security — **`docs/PROD_PHASE2_SECURITY.md`**. Phase IV observability — **`docs/PROD_PHASE4_OBSERVABILITY.md`**. Phase V compliance & trust — **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**. Phase VI product backlog — **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**. Phase VII quality gates — **`docs/PROD_PHASE7_QUALITY.md`**. Phase VIII commercial launch — **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**.

## Production roadmap

- **`ROADMAP.md`** — full cross-dimension plan from current phases to production (security, FHIR, ops, compliance, GTM).

## Phase checkpoints

- `docs/PHASE0.md` — foundations  
- `docs/PHASE1.md` — FHIR MVP  
- `docs/PHASE2.md` — Bundle + HL7 ORU ingest, interface metrics  
- `docs/PHASE3.md` — SMART OAuth + JWT compartment reads  
- `docs/PHASE4.md` — Patient `$everything` + expanded compartment types  
- `docs/PHASE5.md` — tenant API key lifecycle (`/internal/v1/api-keys`)
- `docs/PHASE6.md` — FHIR transaction Bundle (`POST /fhir`)
- `docs/PHASE7.md` — FHIR batch Bundle (`POST /fhir`, non-atomic)

### Internal ingestion API (Phase 2)

Same API key as `/fhir/*`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/internal/v1/ingest/bundle` | FHIR `Bundle` (`batch` / `collection` / `transaction`) |
| `POST` | `/internal/v1/ingest/hl7v2` | ORU^R01 text (`text/plain` or JSON `{"message":"..."}`) |
| `GET` | `/internal/v1/metrics/interfaces` | Last 24h ingest counts by status |

Examples: `docs/PHASE2.md`.

### Internal tenant API keys (Phase 5)

Same API key as `/fhir/*`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/internal/v1/api-keys` | List API keys (metadata only) |
| `POST` | `/internal/v1/api-keys` | Issue new key (plaintext returned once) |
| `DELETE` | `/internal/v1/api-keys/:keyId` | Revoke key |

See `docs/PHASE5.md`.

---

## Related portfolio repositories

| Repository | Focus |
|------------|--------|
| [rag-retail-analyst](https://github.com/hfuenzalida/rag-retail-analyst) | RAG · analytics |
| [security-suite-orchestrator](https://github.com/hfuenzalida/security-suite-orchestrator) | DevSecOps |
| [digital-brain](https://github.com/hfuenzalida/digital-brain) | Founder business OS |
| [ig-video-to-text](https://github.com/hfuenzalida/ig-video-to-text) | Local media ML |
| [ai-3-layer-coder](https://github.com/hfuenzalida/ai-3-layer-coder) | AI cost routing |
