# Vendor assessment mapping (starter)

Maps common **SIG Lite / CAIQ-style** themes to **repository artifacts** and **runtime configuration**. Replace “[where]” with your deployed stack names (cloud account, SIEM, ticket system).

**Phase V (customer packet):** assemble **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** using this table + **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** deployment attestation.

This is **not** a completed questionnaire — it is evidence pointers for your security team.

| Theme | Typical question | Evidence in this repo / ops |
|-------|------------------|----------------------------|
| **Encryption in transit** | TLS for public APIs | TLS at **[ingress / LB]**; app receives HTTP behind TLS termination — **`deploy/README.md`**. |
| **Encryption at rest** | Database / disk | **[Managed Postgres]** encryption — provider docs; not enforced in app code. |
| **Authentication** | API access control | API keys + OAuth — **`docs/GAP2_SMART_OAUTH.md`**; resolve tenant — **`services/hub-api/src/auth/`**. |
| **Authorization** | Tenant isolation | Queries scoped by tenant; JWT scopes — **`ROADMAP.md`** GAP 2. |
| **Audit logging** | Who did what | **`audit_event`** Postgres sink — **`docs/AUDIT_EVENTS.md`**, **`docs/GAP4_COMPLIANCE_AUDIT.md`**. |
| **Integrity** | Tamper detection | Optional hash chain — **`AUDIT_INTEGRITY_ENABLED`**, migration 009. |
| **Rate limiting / abuse** | DoS mitigation | **`docs/GAP3_SECURITY.md`**; **`@fastify/rate-limit`**. |
| **Dependency management** | CVE process | Lockfile, **`npm audit`** — **`dependency-audit.yml`**, Dependabot. |
| **SAST** | Static analysis | **CodeQL** — **`codeql.yml`**. |
| **DAST** | Dynamic testing | Staging pen test — **`docs/templates/PEN_TEST_SCOPE.md`**. |
| **Secrets** | No secrets in code | **`.dockerignore`**, env validation — **`docs/PROD_PHASE1_DELIVERY.md`**, production guards — **`docs/PROD_PHASE2_SECURITY.md`**. |
| **Production config** | Dev bypass off | **`DEV_API_KEY`** rejected when **`NODE_ENV=production`** — **`services/hub-api/src/env.ts`**. |
| **Metrics exposure** | Prometheus auth | **`INTERNAL_METRICS_TOKEN`** required when metrics on in prod — **`env.ts`**, **`register-internal-routes.ts`**. |
| **HIPAA** (if applicable) | Safeguards | **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`**. |
| **Incident response** | Process | **`docs/RUNBOOKS.md`**, **`docs/support/SUPPORT-TIERS.md`**. |

**Owner for updates:** *[security / GRC name]*
