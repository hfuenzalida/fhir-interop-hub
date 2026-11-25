# Phase II — Security hardening & assurance (delivered artifacts)

Maps **Phase II** in **`ROADMAP_TO_PROD.md`**: reduce blast radius, support enterprise questionnaires, and wire **automated checks** into CI.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **Production env guardrails** | **`loadEnv()`** fails in **`NODE_ENV=production`** if **`DEV_API_KEY`** is set or if **`METRICS_ENABLED=true`** without **`INTERNAL_METRICS_TOKEN`**. |
| **`docs/runbooks/JWT_KEY_ROTATION.md`** | RS256 / JWKS key rotation using **`HUB_JWT_*`** and **`HUB_JWT_KID`**. |
| **`docs/templates/PEN_TEST_SCOPE.md`** | Scope template for `/fhir`, `/oauth`, `/internal` penetration tests. |
| **`docs/VENDOR_ASSESSMENT_MAPPING.md`** | Starter mapping from common questionnaire themes → repo controls & docs. |
| **`.github/workflows/codeql.yml`** | **CodeQL** (JavaScript/TypeScript) on push/PR to **`main`/`master`**. |
| **`.github/workflows/dependency-audit.yml`** | **`npm run audit:deps`** on **`@fhir-hub/hub-api`** after **`npm ci`**. |
| **`docs/PROD_PHASE2_SECURITY.md`** (this file) | Phase II narrative + exit criteria. |

**Still operational / external:** WAF, DDoS, mTLS, IP allowlists — configure at the edge (see **`deploy/README.md`**).

---

## 2. Application controls (confirm for prod)

| Control | Where | Notes |
|---------|--------|--------|
| **CORS allowlist** | **`CORS_ORIGINS`** | Production: unset ⇒ **no browser CORS** (see **`docs/GAP3_SECURITY.md`**). |
| **Rate limits** | **`RATE_LIMIT_*`**, **`TRUST_PROXY`** | Behind LB, set **`TRUST_PROXY=true`** for correct client IP. Consider **`RATE_LIMIT_ALLOW_LOOPBACK=false`** if loopback must not bypass limits. |
| **Request / JSON / HL7 limits** | **`REQUEST_BODY_LIMIT_BYTES`**, **`FHIR_JSON_MAX_DEPTH`**, **`HL7_INGEST_MAX_CHARS`** | Tune per workload. |
| **Metrics auth** | **`INTERNAL_METRICS_TOKEN`** | Required when **`METRICS_ENABLED=true`** in production (enforced in code). |
| **Dev bypass** | **`DEV_API_KEY`** | **Forbidden** in production (enforced in code). |
| **Audit & integrity** | **`AUDIT_INTEGRITY_ENABLED`**, **`AUDIT_CHAIN_SECRET`** | Keep enabled in prod where possible. |
| **OAuth signing** | **`HUB_JWT_PRIVATE_KEY_PEM`**, **`HUB_JWT_KID`** | Prefer RS256 + JWKS; rotate per runbook. |

Review **`docs/GAP3_SECURITY.md`** and **`docs/THREAT_MODEL_V0.md`** at each architecture change.

---

## 3. CI security gates

| Workflow | Trigger | Intent |
|----------|---------|--------|
| **`ci.yml`** | Push/PR | Lint, typecheck, tests, migrations, integration tests. |
| **`docker-build.yml`** | Push/PR | Image build sanity. |
| **`codeql.yml`** | Push/PR **main/master** | SAST (GitHub CodeQL). |
| **`dependency-audit.yml`** | Push/PR | **`npm audit`** on hub-api workspace (**moderate+**). |

**DAST** (dynamic scanning against a running API) is environment-specific: run in **staging** with synthetic data, not usually on every PR. Use **`docs/templates/PEN_TEST_SCOPE.md`** for vendor-led or internal DAST.

---

## 4. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | How to satisfy |
|-----------|----------------|
| **Threat model** updated after architecture freeze | Edit **`docs/THREAT_MODEL_V0.md`** “Open items” / add dated subsection when topology freezes. |
| **Pen test** critical/high remediated or accepted | Track in your issue system; link findings to **`docs/templates/PEN_TEST_SCOPE.md`** runs. |
| **Vendor assessment (SIG-style)** | Fill **`docs/VENDOR_ASSESSMENT_MAPPING.md`** and attach evidence (CI names, config screenshots redacted). |

---

## 5. References

- **`deploy/README.md`** — edge/TLS/secrets.  
- **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** — control narrative.  
- **`docs/PROD_PHASE1_DELIVERY.md`** — rollback & migrations.
