# Phase VII — Quality gates & continuous proof (delivered artifacts)

Maps **Phase VII** in **`ROADMAP_TO_PROD.md`**: **automated regression** (already in CI), **performance budgets**, **external conformance evidence**, and optional **non-prod chaos**. Touchstone/Inferno runs stay **outside** the repo but must be **tracked** for sales/RFPs.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE7_QUALITY.md`** (this file) | Phase VII overview and exit criteria. |
| **`docs/templates/RELEASE_CHECKLIST.md`** | Pre-release gates: integration, migrations, perf. |
| **`docs/templates/CONFORMANCE_EVIDENCE_PACK.md`** | Inferno / Touchstone (or equivalent) — evidence index per release tag. |
| **`docs/templates/PERFORMANCE_BUDGETS.md`** | Budget table + links to **`PERF_METADATA_MAX_MS`**, k6. |
| **`docs/runbooks/CHAOS_NONPROD.md`** | Optional chaos / failure drills in **staging** only. |
| **`scripts/perf/README.md`** | Where to add heavier benchmarks; links **`scripts/load/`**. |
| **`docs/GAP9_TESTING.md`** | Updated — Phase VII pointer. |

**Existing gates:** **`.github/workflows/ci.yml`** — `migration-smoke`, **`integration-tests`** job (Postgres 16, seed, **`test:integration`**).

---

## 2. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | Deliverable |
|-----------|-------------|
| **Release checklist** includes integration + migration smoke + targeted perf | **`docs/templates/RELEASE_CHECKLIST.md`** — use before tagging. |
| **Conformance evidence pack** for ≥ one tagged release | Fill **`docs/templates/CONFORMANCE_EVIDENCE_PACK.md`** after running Inferno/Touchstone against **staging** (or vendor sandbox). |

---

## 3. References

- **`docs/GAP9_TESTING.md`** — integration suite details.  
- **`docs/PROD_PHASE3_RELIABILITY.md`** — load testing / k6.  
- **`packages/shared`** — **`US_CORE_PACKAGE`** / **`US_CORE_VERSION`** pins for procurement language.
