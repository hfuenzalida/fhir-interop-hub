# Release checklist — *[version / tag]*

Use before promoting an image or tag to **production** (adapt severity for **staging-only** releases).

---

## 1. Automated CI (must be green on the release commit)

- [ ] **`ci.yml`** — lint, typecheck, unit tests  
- [ ] **`migration-smoke`** — `apply-all-migrations` on disposable Postgres  
- [ ] **`integration-tests`** — Postgres + **`npm run test:integration`**  
- [ ] **`docker-build.yml`** — **`Dockerfile`** builds  
- [ ] **`codeql.yml`** / **`dependency-audit.yml`** — as configured on default branch  

---

## 2. Performance / smoke (targeted)

- [ ] Integration **metadata latency** smoke passed (**`PERF_METADATA_MAX_MS`** — see **`docs/templates/PERFORMANCE_BUDGETS.md`**)  
- [ ] Optional: **`scripts/load/k6-metadata-smoke.js`** or **`k6-fhir-read-smoke.js`** against **staging**  

---

## 3. Conformance (when claiming US Core / SMART in sales materials)

- [ ] **`docs/templates/CONFORMANCE_EVIDENCE_PACK.md`** updated for this tag **or** explicitly **N/A** with reason  

---

## 4. Operational

- [ ] **Migrations** applied in **prod** order match **`db/migrations/`** for this tag (**`docs/PROD_PHASE1_DELIVERY.md`**)  
- [ ] **Rollback** path understood (previous image + schema compatibility)  
- [ ] **`docs/templates/RELEASE_NOTES_PRODUCT.md`** filled for partner-visible changes (**Phase VI**)  

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Release manager | | |
| On-call acknowledge (if risky) | | |

---

**References:** **`docs/PROD_PHASE7_QUALITY.md`**, **`docs/GAP9_TESTING.md`**.
