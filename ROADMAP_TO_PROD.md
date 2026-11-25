# Roadmap to production — gap analysis & phased rollout

This document complements **`ROADMAP.md`** (feature/capability matrix, GAPs 1–10). **`ROADMAP.md`** describes **what the codebase can become**; this file describes **what is still needed to run it as a production service** and proposes a **phased path** with exit criteria.

**How to use it:** sequence phases for your ICP (SMART apps vs bulk analytics vs HL7 feeds). Some phases can run in parallel (e.g. Phase II security + Phase III reliability). Nothing here replaces legal review, threat modeling, or customer-specific contracts.

---

## 1. Gap analysis — baseline vs production bar

### 1.1 What the repo already provides (foundation)

A deployable **hub-api** with tenant isolation, FHIR R4 JSON, API keys, SMART-style OAuth (RS256/JWKS, PKCE, refresh rotation), ingestion, audit (Postgres + optional chain), rate limits, CORS, metrics, read replica routing, MPI tooling, integration tests, partner OpenAPI, hub-client SDK, usage metering hooks, and operator scripts. See **`ROADMAP.md`** per-GAP “foundation shipped” lines.

### 1.2 Cross-cutting production gaps (not “one more feature”)

| Gap | Why it matters |
|-----|----------------|
| **Hosted deployment model** | The repo ships an app process + SQL migrations, not a cloud account. You need environments (dev/stage/prod), networks, TLS, managed Postgres, secrets, and runbooks that match *your* SLAs. |
| **Secrets & config** | Production must not rely on repo-local `.env`. Integrate a secret store (Vault, cloud SM), rotation, and **no `DEV_API_KEY` / permissive defaults** in prod. |
| **Edge protection** | WAF, DDoS mitigation, and optional IP allowlists sit **in front of** the Node process (GAP 3 notes these as deployment layers). |
| **HA & DR** | Managed HA Postgres, **PITR backups**, tested restore, RPO/RTO targets, and failover drills (GAP 5 — partial in-repo). |
| **Operational maturity** | Dashboards, **alerting with paging**, incident process, status page if you promise SLAs (GAP 6 — Prometheus in-app; hosted alerting/IaC external). |
| **Observability depth** | **OpenTelemetry** (traces) and log shipping to a SIEM are not fully wired in-repo; structured logs exist but enterprise buyers often require trace IDs across tiers. |
| **Conformance evidence** | Integration tests ≠ Inferno/Touchstone. RFPs often want objective US Core / SMART artifacts (GAP 9). |
| **Product gaps vs enterprise asks** | **`ROADMAP.md`** §1–2 still lists items many buyers expect: **Bulk `$export`**, **Subscriptions**, **Binary + object storage**, fuller search/`_revinclude`/PATCH/history, terminology licensing posture, admin OAuth client UX at scale, etc. Prioritize by contract. |
| **Commercial stack** | Metering hooks exist; **billing systems**, **CRM**, **contracts**, and **support staffing** are organizational — enable with **`docs/GAP10_COMMERCIAL.md`** and **`docs/support/SUPPORT-TIERS.md`**. |

### 1.3 “Stop ship” checks before any production PHI

1. **Disable dev shortcuts:** `DEV_API_KEY` off; `DEV_TENANT_ID` not used for prod traffic; `CORS_ORIGINS` explicit; `TRUST_PROXY` correct behind LB.  
2. **TLS end-to-end** from clients to API (and to Postgres per policy).  
3. **Backup + restore** drill documented and executed.  
4. **Audit & logging:** confirm **`LOG_REDACT_ENABLED`**, no PHI in application logs, metrics bearer for `/internal/metrics`.  
5. **Incident path:** on-call, escalation (**`docs/support/SUPPORT-TIERS.md`**), runbooks (**`docs/RUNBOOKS.md`**).

---

## 2. Phased roadmap to production

Each phase lists **goals**, **typical work**, and **exit criteria**. Adjust ordering for your risk profile.

---

### Phase 0 — Program charter & scope freeze

**Goals:** Agree what “production” means for v1 (regions, PHI yes/no, SMART-only vs API-key bulk, SLAs).

**Work**

- Define **ICP** and **minimum lovable surface** (e.g. SMART read-heavy vs HL7 ingest vs `$export`).  
- Map **regulatory** posture (HIPAA BAA path, data residency).  
- Freeze **SLO** targets that **`docs/templates/SLA-draft.md`** can reference.

**Exit criteria**

- Written **scope document** (in/out for v1 go-live).  
- Owner named for security, ops, and customer onboarding.

**Delivered in-repo:** **`docs/PROD_PHASE0_CHARTER.md`** — fill bracketed fields, check boxes, assign owners, and complete sign-off before treating scope as frozen.

---

### Phase I — Environment & delivery pipeline

**Goals:** Repeatable builds and promotions; no manual SQL in prod.

**Work**

- **IaC** (Terraform/Pulumi/Bicep) or platform templates for VPC/network, TLS certs, load balancer, container/runtime.  
- **CI/CD:** artifact promotion dev → stage → prod; **migration job** as release gate (**`scripts/apply-all-migrations.mjs`** pattern in CI).  
- **Configuration:** secrets from vault/SM; environment-specific **`CORS_ORIGINS`**, **`OIDC_ISSUER`**, DB URLs, JWT keys.  
- **Container/image** hardening (non-root, read-only FS where possible).

**Exit criteria**

- One-command or pipeline-driven deploy to **stage** with parity to prod topology.  
- **Rollback** procedure documented (previous image + compatible schema).  
- No secrets in git or build logs.

**Delivered in-repo:** root **`Dockerfile`** (non-root, multi-stage, migrations + `apply-all-migrations` in image), **`.dockerignore`**, **`docker-compose.hub.yml`**, **`deploy/README.md`**, **`docs/PROD_PHASE1_DELIVERY.md`** (rollback, env matrix, migration gate), **`npm run docker:build`** / **`docker:compose:hub`**, CI workflow **`docker-build.yml`** (build-only validation). Cloud VPC/TLS/LB remains provider-specific per **`deploy/README.md`**.

---

### Phase II — Security hardening & assurance

**Goals:** Reduce blast radius and satisfy enterprise questionnaires.

**Work**

- **Edge:** WAF rules, DDoS protection, optional IP restrictions for `/internal` or admin paths.  
- **App:** confirm rate limits and quotas for prod loads; review **`docs/GAP3_SECURITY.md`** + **`docs/THREAT_MODEL_V0.md`**.  
- **OAuth/JWT:** production key rotation runbook (`HUB_JWT_KID`, PEM rotation).  
- **Testing:** SAST/DAST in CI; schedule **penetration test** scope covering `/fhir`, `/oauth`, `/internal`.  
- **Dependency:** keep **`npm run audit:deps`** (or OSV) in CI with upgrade policy.

**Exit criteria**

- **Threat model** updated after architecture freeze.  
- Pen test **critical/high** findings remediated or explicitly accepted.  
- Security controls mapped for customer **vendor assessment** (SIG-style).

**Delivered in-repo:** production **`loadEnv()`** checks (**no `DEV_API_KEY`**, metrics token when metrics on) — **`services/hub-api/src/env.ts`**; **`docs/PROD_PHASE2_SECURITY.md`**; **`docs/runbooks/JWT_KEY_ROTATION.md`**; **`docs/templates/PEN_TEST_SCOPE.md`**; **`docs/VENDOR_ASSESSMENT_MAPPING.md`**; **`docs/THREAT_MODEL_V0.md`** (architecture-freeze subsection); CI **`codeql.yml`**, **`dependency-audit.yml`**; tests **`test/production-env-guardrails.test.ts`**. WAF/mTLS remain edge/deployment.

---

### Phase III — Data plane: HA, backup, and scaling

**Goals:** Meet RPO/RTO; survive instance loss.

**Work**

- **Postgres:** managed HA, multi-AZ if required; **PITR**; connection limits vs **`PG_POOL_*`** × replica count.  
- Optional **PgBouncer** (or serverless proxy) in front of DB for many API replicas.  
- **Read replica:** validate **`DATABASE_READ_URL`** lag alerts if reads must be fresher than replication.  
- **Horizontal scaling:** stateless API replicas; session-free JWT validation (already aligned with stateless design).  
- **Load testing:** extend **`scripts/load/k6-metadata-smoke.js`** to critical paths (search, token, ingest) per **`docs/GAP5_RELIABILITY.md`**.

**Exit criteria**

- **Restore drill** from backup completed and documented.  
- Documented **capacity** model (instances, DB size, expected RPS).  
- **SLO** numbers ready for SLA appendix (**`docs/templates/SLA-draft.md`**).

**Delivered in-repo:** **`docs/PROD_PHASE3_RELIABILITY.md`**; **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**; **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`**; **`docs/templates/SLO_BUDGET_TABLE.md`**; **`scripts/load/k6-fhir-read-smoke.js`** + **`scripts/load/README.md`**; cross-links in **`deploy/README.md`**, **`docs/GAP5_RELIABILITY.md`**, **`docs/RUNBOOKS.md`**. You still execute backups/drills in **your** cloud account (not automated from this repo).

---

### Phase IV — Observability, alerting, and incident readiness

**Goals:** Detect failure before customers; shorten MTTR.

**Work**

- **Metrics:** scrape **`/internal/metrics`** in prod with **`INTERNAL_METRICS_TOKEN`**; dashboards for RED/USE, OAuth, pools, **`hub_metered_requests_total`**.  
- **Logs:** JSON logging + shipping to log platform; correlation ID propagation (**`CORRELATION_ID_HEADER`**).  
- **Tracing:** OpenTelemetry for HTTP + Postgres (gap vs current Prometheus-only depth).  
- **Alerting:** error rate, saturation, backup failure, replication lag, cert expiry.  
- **Runbooks:** extend **`docs/RUNBOOKS.md`** with your stack-specific commands.

**Exit criteria**

- **On-call** rotation + alert routing tested (pages fire on synthetic failure).  
- **Incident** workflow (severity, comms template) aligned with **`docs/support/SUPPORT-TIERS.md`**.

**Delivered in-repo:** **`docs/PROD_PHASE4_OBSERVABILITY.md`**; **`docs/prometheus/`** ( **`SCRAPING_INTERNAL_METRICS.md`**, **`prometheus-alert-rules.example.yml`**, **`README.md`** ); **`docs/templates/INCIDENT_RESPONSE.md`**, **`ON_CALL_ALERT_ROUTING_TEST.md`**, **`LOG_SHIPPING_CHECKLIST.md`**; **`docs/otel/OTEL_NODE_PRELOAD.md`**; updates to **`docs/GAP6_OBSERVABILITY.md`** and **`docs/RUNBOOKS.md`**. Dashboards, collectors, and paging integrations remain in **your** observability stack — execute **`ON_CALL_ALERT_ROUTING_TEST.md`** to close exit criteria.

---

### Phase V — Compliance & customer trust package

**Goals:** Close procurement for PHI-handling customers.

**Work**

- Finalize **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** mapping to *implemented* controls in **your** deployment.  
- **DPAs**, subprocessors, data residency narrative (**`tenant.data_region`** + ops reality).  
- **Audit:** append-only DB audit + integrity chain operational checks; internal access policy.  
- **Consent / bundle POST** gaps documented in **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** — resolve or explicitly exclude from v1.  
- Optional: break-glass and purpose-of-use procedures if required.

**Exit criteria**

- **Security packet** for customers (architecture diagram, controls list, incident history process).  
- Legal/compliance sign-off for **v1** scope.

**Delivered in-repo:** **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**; **`docs/templates/CUSTOMER_SECURITY_PACKET.md`**, **`DPA_SUBPROCESSORS_CHECKLIST.md`**, **`COMPLIANCE_V1_SIGNOFF.md`**, **`INTERNAL_ACCESS_POLICY.md`**, **`BREAK_GLASS_AND_PURPOSE_OF_USE.md`**; **`docs/runbooks/AUDIT_INTEGRITY_VERIFICATION.md`**; updates to **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** (deployment attestation table), **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** (v1 Bundle scope), **`docs/GAP4_COMPLIANCE_AUDIT.md`**. Executed **BAAs**, signed **DPAs**, and legal review remain **outside** the repo.

---

### Phase VI — Product completion (prioritized backlog)

**Goals:** Meet contractual API and workflow requirements not yet in baseline.

**Work (pick order by revenue)**

- **Analytics / migration lane:** **Bulk `$export`**, async jobs, object storage for NDJSON.  
- **Event-driven lane:** **Subscriptions** + delivery worker + DLQ.  
- **Documents lane:** **Binary** + durable store + **DocumentReference** lifecycle.  
- **Interop depth:** expanded search, **`_revinclude`**, PATCH, history; terminology licensing; additional HL7 messages.  
- **Identity lane:** hosted OAuth client registration UX, consent UI if enterprise demands.  
- **MPI lane:** probabilistic tuning, unmerge, operational merge policies (**`docs/GAP7_DATA_MODEL.md`**).

**Exit criteria**

- Each chosen theme has **acceptance tests** and **release notes**; **OpenAPI** / **hub-client** updated when partner surface changes.

**Delivered in-repo:** **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**; **`docs/PRODUCT_BACKLOG_MATRIX.md`**; **`docs/templates/PRODUCT_THEME_BRIEF.md`**, **`PRODUCT_ACCEPTANCE_CRITERIA.md`**, **`RELEASE_NOTES_PRODUCT.md`**, **`PARTNER_API_CHANGE_CHECKLIST.md`**. Feature code for `$export`, Subscriptions, Binary, etc. is **not** included here — use the matrix + templates when you implement a theme from **`ROADMAP.md`**.

---

### Phase VII — Quality gates & continuous proof

**Goals:** Regression safety and external conformance signals.

**Work**

- Keep **`npm run test:integration`** in CI with disposable Postgres (**`.github/workflows/ci.yml`**).  
- Add **performance budgets** (metadata/search/token) as needed.  
- Run **Inferno / Touchstone** (or equivalent) in **staging** on a schedule; track artifacts for sales.  
- Optional **chaos** (DB failover inject, clock skew for OAuth) in non-prod.

**Exit criteria**

- **Release checklist** includes integration + migration smoke + targeted perf checks.  
- Conformance **evidence pack** available for at least one tagged release.

**Delivered in-repo:** **`docs/PROD_PHASE7_QUALITY.md`**; **`docs/templates/RELEASE_CHECKLIST.md`**, **`CONFORMANCE_EVIDENCE_PACK.md`**, **`PERFORMANCE_BUDGETS.md`**; **`docs/runbooks/CHAOS_NONPROD.md`**; **`scripts/perf/README.md`**; updates to **`docs/GAP9_TESTING.md`**. Inferno/Touchstone execution remains **external**; record outputs in **`CONFORMANCE_EVIDENCE_PACK.md`**.

---

### Phase VIII — Commercial launch operations

**Goals:** Sell, meter, bill, and support safely.

**Work**

- Wire **metering** (**Prometheus** + **`GET /internal/v1/usage/summary`**) to billing or CRM workflows per **`docs/GAP10_COMMERCIAL.md`**.  
- **Tenant onboarding:** runbook from contract → tenant → keys → OAuth clients ( **`tenant-admin`** for ops).  
- **SLA** signing aligned with measured SLOs (**`docs/templates/SLA-draft.md`**).  
- **Support:** train L1/L2 per **`docs/support/SUPPORT-TIERS.md`**; define log pack template (no PHI).

**Exit criteria**

- **Pricing / packaging** documented; support queue and escalation live.  
- First production tenant **post-mortem** template ready (learn from day-2 issues).

**Delivered in-repo:** **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**; **`docs/templates/PRICING_PACKAGING.md`**, **`BILLING_CRM_METERING_WIRING.md`**, **`SUPPORT_OPERATIONS_LIVE.md`**, **`SUPPORT_LOG_PACK.md`**, **`FIRST_TENANT_POSTMORTEM.md`**; **`docs/runbooks/TENANT_ONBOARDING.md`**; updates to **`docs/GAP10_COMMERCIAL.md`**. Live **billing systems**, **CRM**, and **ticketing** remain **external** products.

---

## 3. Mapping: phases ↔ ROADMAP.md sections

| This document | ROADMAP.md anchors |
|-----------------|-------------------|
| Phase VI product work | §§1–2, 7 (FHIR, OAuth, data model) — **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**, **`docs/PRODUCT_BACKLOG_MATRIX.md`** |
| Phase II–III | §3 Security (edge), §5 Reliability |
| Phase IV | §6 Observability — **`docs/PROD_PHASE4_OBSERVABILITY.md`**, **`docs/prometheus/`**, **`docs/otel/`** |
| Phase V | §4 Compliance — **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**, **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** |
| Phase VII | §9 Testing — **`docs/PROD_PHASE7_QUALITY.md`**, **`docs/templates/RELEASE_CHECKLIST.md`** |
| Phase VIII | §10 Commercial — **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**, **`docs/GAP10_COMMERCIAL.md`** |

---

## 4. Living document

- Update this file when **production scope**, **SLOs**, or **regulatory** boundaries change.  
- Keep **`ROADMAP.md`** as the detailed capability checklist; use **`ROADMAP_TO_PROD.md`** for **rollout sequencing** and **organizational** work.
