# Acceptance criteria — *[theme name]*

Link to **`PRODUCT_THEME_BRIEF.md`**. Use for **Definition of Done** and **QA** handoff.

---

## 1. Functional

| # | Criterion | Verified by |
|---|------------|-------------|
| 1 | | Unit / manual |
| 2 | | |
| 3 | | |

---

## 2. API & contracts

| # | Criterion | Verified by |
|---|------------|-------------|
| 1 | OpenAPI updated (`docs/openapi/hub-partner-api.yaml` if partner-facing) | PR review |
| 2 | **`@fhir-hub/hub-client`** updated if new/changed JSON or paths | PR review |
| 3 | Error shapes consistent (OperationOutcome for FHIR where applicable) | Tests |

---

## 3. Non-functional

| # | Criterion | Target |
|---|------------|--------|
| 1 | Latency / throughput | *e.g. p95 < X ms under Y RPS in staging* |
| 2 | Audit events for new PHI paths | *emitAudit coverage* |
| 3 | Metrics (*new counters/histograms if any*) | *Prometheus names documented* |

---

## 4. Automated tests

| Suite | Command | Required |
|-------|---------|----------|
| Unit | `npm run test -w @fhir-hub/hub-api` | Yes |
| Integration | `npm run test:integration` (Postgres) | *Yes if touches DB/FHIR* |
| Load (optional) | `scripts/load/*.js` | *If perf-sensitive* |

---

## 5. Release readiness

- [ ] **`docs/templates/RELEASE_NOTES_PRODUCT.md`** drafted  
- [ ] Migration order verified (`scripts/apply-all-migrations.mjs` smoke in CI)  
- [ ] **`PARTNER_API_CHANGE_CHECKLIST.md`** complete  

---

**References:** **`docs/GAP9_TESTING.md`**, **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**.
