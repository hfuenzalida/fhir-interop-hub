# Production roadmap — FHIR interoperability hub

This document is a **complete, dimension-by-dimension** view of work to evolve the current system (Phases 0–7) into a **production-grade** offering. It is not a commitment order: **prioritize by ICP, contract requirements, and risk**.

**Current baseline (as implemented in-repo):** tenant-isolated FHIR R4 JSON API, API keys + dev bypass, HL7 v2 (ORU^R01) and FHIR bundle ingestion, interface metrics, SMART-style OAuth (HS256) + scoped JWT reads, Patient `$everything`, internal API key lifecycle, FHIR `transaction` + `batch` Bundles, audit sink (console + optional Postgres), CapabilityStatement, health/ready.

---

## 1. Product & API surface (FHIR & integration)

| Item | Description | Production goal |
|------|-------------|-----------------|
| **US Core alignment** | Validate create/update/search against **US Core** profiles (structure, cardinality, must-support). | Pass partner conformance reviews; reduce clinical/legal risk from bad data. |
| **Search completeness** | Implement standard search params per resource (`_id`, `identifier`, `name`, `birthdate`, `date`, `patient`, `subject`, `category`, etc.); `_lastUpdated`, `_sort`, `_count`/`_offset` semantics documented. | Replace ad hoc queries; match EHR integration expectations. |
| **`_include` / `_revinclude`** | Minimal viable includes for Patient-centric reads (e.g. Patient + Observation). | Fewer round-trips; faster SMART apps. |
| **Patch / conditional** | `PATCH`, `If-Match` / ETags, conditional create/update/delete. | Safe concurrent writes; fewer overwrites. |
| **History & versioning API** | `_history`, `vread`, Provenance on meaningful changes (optional). | Auditability and rollback narratives for buyers. |
| **Binary & DocumentReference** | Store blobs (S3-compatible or managed file store); presigned GET; **DocumentReference** + **Binary** lifecycle. | Documents are non-negotiable in many workflows. |
| **Bulk Data `$export`** | At minimum **Patient compartment** or **Group** export; async job + NDJSON; status/polling; cancel. | Analytics, AI pipelines, migration — common enterprise ask. |
| **Subscriptions** | **Subscription** resource + **rest-hook** delivery; retry/backoff; signing secrets; idempotency keys. | Event-driven products; eliminate polling costs. |
| **Additional HL7 v2** | ADT, ORM, SIU, etc., as **mapped** to FHIR with explicit message profiles. | Legacy hospital feeds beyond lab ORU. |
| **CDA / FHIR conversion** | Inbound CDA to FHIR (or bridge service); outbound where required. | Markets still bound to CCDA exchange. |
| **Terminology** | ValueSet expansion hooks; validation against licensed terminologies (SNOMED/LOINC/RxNorm) with **license posture** documented. | Semantic interoperability and reporting quality. |

**Foundation shipped in-repo (GAP 1 slice):** US Core–lite validation on FHIR REST writes + transaction/batch Bundle writes; expanded search (`_lastUpdated`, `_sort`, Patient `gender`, `patient` on subject-types); Patient search `_include=Observation:subject` (capped); `ETag` + `If-Match` on read/update; CapabilityStatement documents these. See `docs/GAP1_PRODUCT_API.md`. Full IG validation, `_revinclude`, PATCH, `_history`, Binary/$export, Subscriptions, etc. remain roadmap items.

---

## 2. SMART / OAuth / identity

| Item | Description | Production goal |
|------|-------------|-----------------|
| **Asymmetric keys & JWKS** | RS256 (or ES256); **`jwks_uri`** in discovery; key rotation; multi-key support. | Industry default for OAuth servers; removes shared-secret scaling issues. |
| **Refresh tokens** | Issue/rotate/revoke refresh tokens; rotation policy; theft detection basics. | Long-lived sessions without long-lived access tokens. |
| **PKCE** | Enforce or strongly recommend for public clients; document confidential vs public flows. | OAuth security baseline for SMART apps. |
| **Scopes & enforcement** | Full SMART scope taxonomy where committed; **write** scopes for JWT when product requires (with compartment rules). | Match SMART app certification expectations. |
| **`fhirUser` / OpenID** | Optional OpenID Connect layer if apps expect identity claims beyond patient context. | App portability from major EHR SMART ecosystems. |
| **Admin consent / branding** | Hosted authorize UI when customers require consent capture (not redirect-only). | Enterprise legal/compliance sign-off. |
| **Multi-tenant OAuth clients** | Client registry UI/API; per-environment promotion; secret rotation workflow. | Operate hundreds of tenants without SQL. |

**Foundation shipped in-repo (GAP 2 slice):** RS256 via `HUB_JWT_PRIVATE_KEY_PEM` (optional HS256 fallback); **`jwks_uri`** + `/.well-known/jwks.json`; **`/.well-known/openid-configuration`**; **PKCE S256** required on authorize + token; **refresh tokens** with one-time **rotation** on use; **public OAuth clients** (`oauth_client.is_public` + PKCE, no secret); **OpenID** `id_token` when `openid` scope; expanded **SMART scopes** in discovery; **JWT write** to single-resource `/fhir/{type}` and `PUT`/`DELETE` with **patient compartment** + `patient/*.write` scopes (bundles at `POST /fhir` still API-key only). See `docs/GAP2_SMART_OAUTH.md`. Remaining: consent UI, full client registry product, ES256, advanced refresh theft analytics, full SMART scope matrix.

---

## 3. Security & zero-trust

| Item | Description | Production goal |
|------|-------------|-----------------|
| **Secrets management** | No long-lived secrets in repo; integrate **Vault / cloud secret stores**; rotation runbooks. | Reduce credential leakage blast radius. |
| **mTLS / network policy** | Optional mTLS for internal ingestion endpoints; private link patterns. | Enterprise network requirements. |
| **Rate limiting & quotas** | Per API key, per tenant, per IP (edge + app); burst vs sustained; 429 + Retry-After. | Abuse prevention; predictable cost. |
| **WAF & DDoS** | Edge protection (Cloudflare/AWS WAF, etc.) in front of public endpoints. | Availability SLA credibility. |
| **Input hardening** | Payload size limits per route; JSON depth limits; HL7 message size/time limits. | DoS and parser abuse mitigation. |
| **CORS policy** | Replace “allow all origins” with configurable allowlist per environment. | Browser-based SMART apps without overexposure. |
| **Security testing** | Regular **SAST/DAST**, dependency scanning, periodic pen test scope for `/fhir`, `/oauth`, `/internal`. | Procurement and breach-risk reduction. |

**Foundation shipped in-repo (GAP 3 slice):** configurable **CORS** (`CORS_ORIGINS`); **`trustProxy`** for accurate client IP; global **rate limiting** with OAuth-specific caps, loopback exemption option, IP+API-key grouping, **429** + `Retry-After`; **JSON nesting depth** limits on FHIR + ingest bundle; **HL7 character cap**; unified **`REQUEST_BODY_LIMIT_BYTES`**; **`npm run audit:deps`** script. See `docs/GAP3_SECURITY.md`. Edge WAF/mTLS/Vault remain deployment layers.

---

## 4. Compliance, privacy & audit

| Item | Description | Production goal |
|------|-------------|-----------------|
| **HIPAA-aligned controls** | Document technical safeguards mapping (access control, audit, integrity, transmission — as applicable to your deployment model). | BAA conversations and trust. |
| **Audit completeness** | Append-only audit; **who/what/when** for all PHI paths; tamper evidence or WORM storage where required. | OCR-style accountability and internal forensics. |
| **Immuntable PHI logging policy** | Define what is never logged (bodies, tokens); structured redaction in logs. | Prevent accidental PHI in log vendors. |
| **Break-glass / emergency access** | Optional workflow hooks if regulatory context demands. | Some health system RFPs. |
| **Data residency** | Tenant region pinning; cross-border replication policy; DPA templates. | EU/UK and multi-national deals. |
| **Consent & purpose of use** | If aggregating across sources, model consent references (FHIR **Consent**) where applicable. | Secondary use and analytics compliance. |

**Foundation shipped in-repo (GAP 4+):** shared **`AuditActor`** fields; **`emitAudit`** + compliance headers; optional **`tenant.data_region`** (008); **HIPAA technical safeguards** narrative (`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`); **Postgres audit hash chain** + **`audit_chain_head`** + **append-only trigger** (009; **`AUDIT_CHAIN_SECRET`** optional); FHIR **`Consent`** as a Phase 1 type with optional **`CONSENT_POLICY_ENABLED`** purpose checks (`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`). Bundle POST consent remains a documented gap.

---

## 5. Reliability, performance & scale

| Item | Description | Production goal |
|------|-------------|-----------------|
| **HA Postgres** | Managed HA (e.g. RDS, Cloud SQL), failover tests, PITR backups, restore drills. | Meet RPO/RTO expectations. |
| **Connection pooling** | PgBouncer or pool tuning; max connections per instance documented. | Stability under load. |
| **Horizontal scaling** | Stateless API instances; sticky sessions only if required (prefer none); session-free JWT validation. | Scale API tier with load. |
| **Read replicas** | Route heavy read/search to replica when consistent-enough. | Cost-efficient scaling for analytics reads. |
| **Caching** | Metadata, CapabilityStatement, discovery docs; careful caching of auth decisions (short TTL only). | Latency and origin shielding. |
| **Background jobs** | Queue for `$export`, subscriptions, large ingest; dead-letter queues. | Predictable tail latency; recovery. |
| **Load & soak testing** | K6/Locust scenarios for FHIR search, ingest spikes, OAuth token storms. | Capacity planning and SLO evidence. |
| **SLOs & error budgets** | Define availability/latency SLOs; incident severity matrix. | Customer-facing SLAs and internal discipline. |

**Foundation shipped in-repo (GAP 5 slice):** configurable **`node-pg`** pools (**`PG_POOL_*`**); optional **`DATABASE_READ_URL`** with FHIR reads on **`pgRead`** (writes/auth on primary); TTL caches for **`/fhir/metadata`** and **`/.well-known/*`**; **`/ready`** reports **`readReplica`** status; **`scripts/load/k6-metadata-smoke.js`**; **`docs/GAP5_RELIABILITY.md`**. HA failover drills, PgBouncer at edge, job queues, and full soak suites remain operational / future work.

---

## 6. Observability & operations

| Item | Description | Production goal |
|------|-------------|-----------------|
| **Structured logging** | JSON logs; correlation IDs (`x-request-id`) propagated to DB and downstream; log levels per env. | Debug prod without PHI leakage. |
| **Metrics** | RED/USE for API; DB pool; ingest throughput; OAuth token issuance; 4xx/5xx by route. | Dashboards and alerting. |
| **Tracing** | OpenTelemetry HTTP + Postgres spans. | Latency debugging across services. |
| **Alerting** | On error rate, saturation, backup failure, queue depth, DLQ growth. | Reduce MTTR. |
| **Runbooks** | Common failures: DB full, migration failed, OAuth misconfig, token verification mismatch (`iss`/`aud`). | On-call efficiency. |
| **Deployment** | IaC (Terraform/Pulumi); blue/green or canary; migration job as release gate. | Safe releases. |

**Foundation shipped in-repo (GAP 6 slice):** **`LOG_LEVEL`**; optional **`CORRELATION_ID_HEADER`** → **`correlationId`** on logs; **Prometheus** at **`GET /internal/metrics`** (`hub_http_*`, **`hub_oauth_tokens_issued_total`**, **`hub_pg_pool_connections`**); optional **`INTERNAL_METRICS_TOKEN`**; optional Node default metrics (**`METRICS_NODE_COLLECT_DEFAULT`**); scrape path excluded from HTTP histogram noise; **`docs/GAP6_OBSERVABILITY.md`** + **`docs/RUNBOOKS.md`**. Full OpenTelemetry instrumentation, hosted alerting, and IaC templates remain deployment-specific.

---

## 7. Data model & quality

| Item | Description | Production goal |
|------|-------------|-----------------|
| **MPI / deduplication** | Deterministic match rules; optional probabilistic; merge/unmerge with **Provenance**. | Reduce duplicate patients — clinical and billing risk. |
| **Soft-delete semantics** | Document restore vs purge; retention jobs per policy. | Legal hold and retention compliance. |
| **Migration tooling** | Tenant import/export; bulk upsert from NDJSON; id mapping tables if needed. | Onboarding speed. |
| **Schema evolution** | Versioned migrations; expand/contract strategy; zero-downtime deploy patterns for DDL. | Continuous delivery without outage. |

**Foundation shipped in-repo (GAP 7 slice):** migration **`010_gap7_patient_link_id_map.sql`** (`patient_link`, **`fhir_id_import_map`**); MPI routes including **`patient-probabilistic-candidates`**, **`patient-match-score`**, **`patient-merge`** (Provenance + optional reference rewrite + soft-delete); **`restoreSoftDeletedResource`**; NDJSON export **`scripts/export-tenant-ndjson.mjs`**; import with **`reference-remap`** via **`npm run import-tenant-ndjson`**; **`Provenance`** as Phase 1 FHIR type; **`docs/GAP7_DATA_MODEL.md`**. Fine-tuned probabilistic models, unmerge workflows, and hosted migration jobs remain deployment follow-ons.

---

## 8. Internal platform & developer experience

| Item | Description | Production goal |
|------|-------------|-----------------|
| **OpenAPI** | Generated or maintained OpenAPI 3 for `/fhir`, `/oauth`, `/internal` (partner-facing subset). | Faster partner integration; SDK generation. |
| **Sandbox & fixtures** | Hosted sandbox tenant; synthetic data packs; Postman/Newman CI. | Sales engineering velocity. |
| **SDKs** | Official clients (TS at minimum) for auth + FHIR patterns. | Lower friction for app developers. |
| **CI/CD gates** | Lint, typecheck, unit + integration tests against disposable Postgres; migration smoke. | Regressions caught pre-merge. |

**Foundation shipped in-repo (GAP 8 slice):** maintained **`docs/openapi/hub-partner-api.yaml`**; **`@fhir-hub/hub-client`** (fetch + FHIR + OAuth token + internal JSON); **`fixtures/sandbox/sample-patient.ndjson`**; **Postman** collection + **local** environment under **`postman/`**; **`scripts/apply-all-migrations.mjs`** + **`.github/workflows/ci.yml`** (lint/typecheck/test + Postgres migration smoke); optional manual **`ci-http-smoke.yml`** (**workflow_dispatch**) boots **hub-api** + **Newman**. Hosted sandbox SaaS and codegen pipelines remain deployment-specific.

---

## 9. Testing & quality assurance

| Item | Description | Production goal |
|------|-------------|-----------------|
| **Integration tests** | FHIR CRUD roundtrips; SMART flow E2E; transaction rollback; batch partial failure. | Confidence in releases. |
| **Conformance tests** | Touchstone / Inferno-style runs where applicable (US Core, SMART). | Objective proof for RFPs. |
| **Performance regression** | Benchmark critical paths in CI (thresholds). | Prevent perf cliffs. |
| **Chaos / failure injection** | DB kill, slow network, OAuth clock skew. | Resilience validation. |

**Foundation shipped in-repo (GAP 9 slice):** **`buildHubApplication()`** in **`build-app.ts`** (shared with **`index.ts`**); **`test/integration/hub.integration.test.ts`** — CRUD, **transaction rollback**, **batch partial failure**, metadata **latency smoke**; **`npm run test:integration`**; CI job **`integration-tests`** in **`ci.yml`**; **`docs/GAP9_TESTING.md`**. Touchstone/Inferno-style conformance and chaos suites remain external / staging processes.

---

## 10. Commercial & GTM enablers

| Item | Description | Production goal |
|------|-------------|-----------------|
| **Metering & billing hooks** | Count API calls, tokens issued, GB exported; tenant usage reports. | Usage-based pricing accuracy. |
| **Tenant admin UX** | Minimal admin UI or CLI for tenants, keys, OAuth clients, webhooks. | Reduce support burden. |
| **SLA templates** | Draft SLA tied to measured SLOs. | Enterprise sales. |
| **Support tiers** | L1/L2 playbooks; escalation to engineering with log packs (no PHI). | Operational scalability. |

**Foundation shipped in-repo (GAP 10 slice):** Prometheus **`hub_metered_requests_total`** (tenant × `api_family`) + existing OAuth/token HTTP metrics; **`GET /internal/v1/usage/summary`** (tenant-scoped audit rollup + metering pointers); operator **`npm run tenant-admin`** (**`scripts/tenant-admin.mjs`**) for tenants / key metadata / OAuth clients (DB access); **`docs/GAP10_COMMERCIAL.md`**, **`docs/templates/SLA-draft.md`**, **`docs/support/SUPPORT-TIERS.md`**; OpenAPI entry for usage summary. Full billing product, hosted admin UI, and CRM integrations remain deployment-specific.

---

## Suggested sequencing (non-binding)

1. **Hardening path:** security (rate limits, secrets, CORS) → observability → HA DB/backups → CI integration tests.  
2. **Market pull path:** US Core validation + search → Bulk `$export` **or** Subscriptions (pick by first whale customer).  
3. **Identity path:** JWKS + refresh tokens before chasing largest IDNs.

Adjust based on **which integration lane pays first** (SMART apps vs bulk analytics vs HL7 feeds).

---

## Living document

- Link phase docs under `docs/PHASE*.md` for historical scope.  
- Update this file when major capabilities ship or when procurement/security boundaries change.  
- For **phased production rollout** (environments, HA, security assurance, go-live), see **`ROADMAP_TO_PROD.md`**.
