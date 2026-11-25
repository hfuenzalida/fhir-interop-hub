# GAP 5 — Reliability, performance & scale (in-repo foundation)

## Connection pooling

Environment variables tune **`node-pg`** pools (see `.env.example`):

| Variable | Role |
|----------|------|
| **`PG_POOL_MAX`** | Max clients per process for **`DATABASE_URL`** (primary). |
| **`PG_READ_POOL_MAX`** | Optional override for **`DATABASE_READ_URL`** (defaults to **`PG_POOL_MAX`**). |
| **`PG_POOL_MIN`** | Minimum idle connections kept open. |
| **`PG_IDLE_TIMEOUT_MS`** | Idle timeout before connection is closed. |
| **`PG_CONNECTION_TIMEOUT_MS`** | Wait for a slot from the pool (`0` = wait indefinitely). |

**Operational:** Put **PgBouncer** (transaction mode) or RDS Proxy in front of Postgres when many hub replicas connect — document max connections per instance × replica count vs Postgres **max_connections**.

## Read replicas

When **`DATABASE_READ_URL`** is set, the hub opens a **second pool** and routes **FHIR read** queries (`read`, `search`, `$everything`, Consent policy reads) to **`pgRead`**. **Writes**, **OAuth**, **ingestion**, **internal API keys**, **audit append**, and **auth resolution** always use **`DATABASE_URL`** (primary) to avoid replica lag breaking login or immediate read-after-write.

## Stateless horizontal scaling

The API is **stateless**: JWT validation uses configured keys; no server-side sessions. Multiple instances can sit behind a load balancer **without sticky sessions** unless your deployment adds them for unrelated reasons.

## Caching

| Surface | Env | Behavior |
|---------|-----|----------|
| **`GET /fhir/metadata`** | **`CAPABILITY_CACHE_TTL_MS`** | In-memory TTL cache keyed by computed base URL (`proto` + `Host`). `0` disables. |
| **`/.well-known/*`** | **`DISCOVERY_CACHE_TTL_MS`** | In-memory TTL for SMART config, OpenID config, and JWKS JSON. `0` disables. |

Use short TTLs (e.g. 30–120s) so CapabilityStatement and JWKS refresh after config changes without restart.

## Readiness

**`GET /ready`** returns **`readReplica`**: `skipped` (no read URL), `ok`, or `unreachable` (primary passed `SELECT 1` but replica failed).

## Load testing

| Script | Doc |
|--------|-----|
| `scripts/load/k6-metadata-smoke.js` | Public metadata + `/ready` |
| `scripts/load/k6-fhir-read-smoke.js` | Patient search (requires `K6_BEARER_TOKEN`) |

See **`scripts/load/README.md`**. Phase III capacity & SLO templates: **`docs/PROD_PHASE3_RELIABILITY.md`**, **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`**, **`docs/templates/SLO_BUDGET_TABLE.md`**.

## SLOs & error budgets (template)

Define externally (Notion / wiki); suggested starter:

| Tier | Availability | Latency (p95) | Error budget / month |
|------|----------------|-----------------|-------------------------|
| Read FHIR | 99.9% | &lt; 500 ms | ~43 min downtime |
| Write FHIR | 99.5% | &lt; 1 s | ~3.6 h downtime |

## Not in this codebase

- **HA Postgres**, **PITR**, **failover drills** — cloud provider / DBA; **checklists** in **`docs/PROD_PHASE3_RELIABILITY.md`** and **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**.
- **Background job queues** (`$export`, subscriptions) — future service or worker.
- **Full observability** (Prometheus metrics, tracing) — see **GAP 6** in `ROADMAP.md`.
