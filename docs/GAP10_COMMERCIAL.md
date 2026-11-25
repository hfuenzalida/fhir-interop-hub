# GAP 10 — Commercial & GTM enablers (foundation)

This slice adds **usage visibility** and **operator tooling** so deployments can support metering, billing handoffs, and tenant support without building a full product console.

## Metering (Prometheus)

When `METRICS_ENABLED=true`, the hub exposes Prometheus text at `GET /internal/metrics` (protect in production with `INTERNAL_METRICS_TOKEN`).

- **`hub_metered_requests_total`** — labels `tenant_external_key`, `api_family` (`fhir`, `oauth`, `internal`, `system`, `other`). Anonymous traffic is labeled `_anonymous`. Scrapes of `/internal/metrics` are excluded from HTTP/metered counters to avoid self-noise.
- **`hub_oauth_tokens_issued_total`** — OAuth token volume by `grant_type`.
- Standard HTTP histograms: `hub_http_requests_total`, `hub_http_request_duration_seconds`.

Export volume and object-storage egress require infrastructure-level metrics outside this API.

## Tenant usage summary (API)

Authenticated with the same API key as other `/internal/v1/*` routes:

```http
GET /internal/v1/usage/summary?hours=24
Authorization: Bearer <api_key>
```

Returns:

- Rollup of **`audit_event`** rows for the caller’s tenant (`tenant_id` = external key string), grouped by **`action`**, over the requested window (default 24h, max 168h).
- Pointers to Prometheus metric names for billing adapters.

Each successful call emits an audit event (READ on a logical entity), so usage of the endpoint itself appears in subsequent rollups.

## Tenant admin CLI (operators)

`npm run tenant-admin -- …` runs **`scripts/tenant-admin.mjs`** against **`DATABASE_URL`**. It lists tenants and shows API key **metadata** (never secrets) and OAuth client registration fields for a given **`external_key`**.

**Security:** run only from a trusted operator workstation or CI with DB credentials; do not expose connection strings in logs.

## SLA & support

- Draft SLA template: **`docs/templates/SLA-draft.md`** — tie narrative targets to measured SLOs (`/ready`, error rates, migration health).
- Support tiers / escalation: **`docs/support/SUPPORT-TIERS.md`** — L1/L2 scope and engineering escalation with **log packs excluding PHI**.
- **Support bundle template:** **`docs/templates/SUPPORT_LOG_PACK.md`**.

## Phase VIII — commercial launch (rollout)

**`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** — pricing/packaging, tenant onboarding runbook, billing/CRM wiring patterns, support go-live, first-tenant post-mortem. Not a substitute for your billing CRM or ticketing product.

See **`ROADMAP.md`** §10 for the full capability matrix.
