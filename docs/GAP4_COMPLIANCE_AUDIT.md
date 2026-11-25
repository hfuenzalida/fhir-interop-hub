# GAP 4 — Compliance, privacy & audit (in-app foundation)

This slice adds **audit enrichment**, **PHI-safe logging hooks**, optional **data residency metadata** in the database, and documentation for what still belongs in legal / deployment layers.

## Audit model (`@fhir-hub/shared`)

- **`AuditActor.breakGlassReason`** — optional string from a configurable HTTP header (default `x-break-glass-reason`), capped in the hub when ingested.
- **`AuditActor.purposeOfUse`** — optional string from a configurable header (default `x-purpose-of-use`), capped when ingested.

These fields are merged into every audit event emitted through **`emitAudit`** when the request carries `complianceMeta` (see below). The Postgres sink stores **`actor` as JSON**, so new fields appear in `audit_event.actor` without a migration.

## Request hooks (`registerComplianceRequestHooks`)

- Runs on **`onRequest`** and sets **`request.complianceMeta`** when either header is present.
- Header names are configurable:
  - **`BREAK_GLASS_HEADER`** — if unset, the hub uses **`x-break-glass-reason`** (compared case-insensitively via Fastify’s normalized header keys).
  - **`PURPOSE_OF_USE_HEADER`** — if unset, uses **`x-purpose-of-use`**.

**Operational note:** Gate or strip these headers at your edge if only trusted break-glass clients should set them; the API records what it receives.

## `emitAudit` (hub-api)

- Central path for **`id`**, **`timestamp`**, **`network`** merge (request id, IP, user-agent when a `FastifyRequest` is passed), and **compliance fields** on **`actor`**.
- Prefer **`emitAudit(sink, request, input)`** over ad-hoc event construction so audits stay consistent.

## Console audit sink redaction

- **`detail`** strings are lightly scrubbed before **`console.log`** (Bearer tokens, crude `x-hub-api-key=` patterns).
- This does **not** replace a full PHI logging policy; it reduces accidental secret leakage in dev and sidecar log shipping.

## Fastify request log redaction

- When **`LOG_REDACT_ENABLED`** is `true` (default), Pino is configured to **redact** `Authorization` and Hub API key headers from structured request logs.

## Data residency hint (database)

- Migration **`008_gap4_tenant_data_region.sql`** adds optional **`tenant.data_region`** (text, commented in SQL) for **contract / runbook** mapping (e.g. `us-east-1`, `EU`). The API does **not** enforce placement or routing from this column alone.

## Extended compliance artifacts (see also)

- **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** — maps HIPAA Security Rule technical themes to this codebase (non-exhaustive).
- **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** — FHIR **Consent**–backed purpose checks, audit hash chain, WORM trigger.
- **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`** — Phase V templates (customer packet, DPA checklist, sign-off).

## Still deployment / legal (not code-complete)

- **BAA**, workforce policies, and **SOC2** program artifacts.
- **HSM** / Cloud KMS for audit signing keys; **retention** and off-site WORM in object storage.
- **Purpose-of-use** enforcement against a central terminology/registry — the hub matches declared Consent `purpose` codings to the purpose header string.

See **`ROADMAP.md`** §4 for the full gap list and production goals.
