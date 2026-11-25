# Phase 1 — FHIR hub MVP (read/write path)

## Delivered

- **FHIR R4 JSON** REST surface under `/fhir` with tenant isolation (Postgres `tenant_id`).
- **Resources (Phase 1 allowlist):** `Patient`, `Observation`, `Condition`, `Encounter`, `DocumentReference` — generic CRUD; **Patient** adds search (`_id`, `name`, `birthdate`, `identifier`, `_count`, `_offset`).
- **CapabilityStatement** at `GET /fhir/metadata` (no auth; for discovery).
- **Auth:** `Authorization: Bearer <api-key>` or `X-Hub-Api-Key` — API keys stored as **SHA-256** hex; optional **`DEV_API_KEY`** maps to `DEV_TENANT_ID` when both are set and the tenant row exists.
- **Audit:** FHIR operations emit `AuditEvent` records (console + Postgres when `DATABASE_URL` is set).
- **Soft delete** with partial unique index so a new resource can reuse a logical id after delete.
- **Readiness:** `GET /ready` checks DB connectivity when `DATABASE_URL` is configured.

## SLO draft (tune with real traffic)

| Surface | Target (initial) |
|---------|-------------------|
| `GET /fhir/{type}/{id}` (warm) | p95 &lt; 300 ms |
| Search `GET /fhir/Patient` | p95 &lt; 800 ms |
| Error rate (5xx) | &lt; 0.1% excluding customer infra |

## Exit criteria (Phase 1)

- [x] CRUD + search for Patient with tenant isolation.
- [x] `CapabilityStatement` published for SMART discovery prep.
- [x] API key auth + audit trail for data-plane calls.
- [ ] US Core **validator in CI** (Phase 5 / parallel track).
- [ ] Load test against expected concurrency (before first pilot).

## Next — Phase 2

Ingestion connectors (HL7 v2 / bulk FHIR), normalization, and interface monitoring KPIs.
