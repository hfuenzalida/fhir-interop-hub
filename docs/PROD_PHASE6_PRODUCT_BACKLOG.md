# Phase VI — Product completion (prioritized backlog)

Implements **Phase VI** in **`ROADMAP_TO_PROD.md`**: a **programmatic** way to pick contract-driven features from **`ROADMAP.md`**, ship them with **acceptance tests** and **release notes**, and keep **partner surfaces** (**OpenAPI**, **`@fhir-hub/hub-client`**) aligned.

**This phase is mostly engineering work** — the repo ships **templates and the backlog matrix**, not every roadmap feature (e.g. **Bulk `$export`** remains code you implement when selected).

---

## 1. What ships in-repo (Phase VI deliverables)

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`** (this file) | How Phase VI links to **`ROADMAP.md`** and **`PROD_PHASE0_CHARTER.md`**. |
| **`docs/PRODUCT_BACKLOG_MATRIX.md`** | **Lanes ↔ roadmap rows** — pick a revenue lane, find **`ROADMAP.md`** anchors. |
| **`docs/templates/PRODUCT_THEME_BRIEF.md`** | One-page brief per theme (scope, out-of-scope, dependencies). |
| **`docs/templates/PRODUCT_ACCEPTANCE_CRITERIA.md`** | Acceptance tests + non-functional checks per theme. |
| **`docs/templates/RELEASE_NOTES_PRODUCT.md`** | User/partner-facing release notes template. |
| **`docs/templates/PARTNER_API_CHANGE_CHECKLIST.md`** | OpenAPI, hub-client, Postman, integration CI — checklist. |

---

## 2. How to use it

1. **`docs/PROD_PHASE0_CHARTER.md`** — confirm **ICP** and **minimum lovable surface** (which lane pays first).  
2. **`docs/PRODUCT_BACKLOG_MATRIX.md`** — map charter themes → **`ROADMAP.md`** §§1–2–7 rows.  
3. For each chosen initiative: **`PRODUCT_THEME_BRIEF.md`** → implement → **`PRODUCT_ACCEPTANCE_CRITERIA.md`** → ship → **`RELEASE_NOTES_PRODUCT.md`**.  
4. Any partner-visible HTTP change: **`PARTNER_API_CHANGE_CHECKLIST.md`**.

---

## 3. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | How to satisfy |
|-----------|----------------|
| Each chosen theme has **acceptance tests** | Fill **`PRODUCT_ACCEPTANCE_CRITERIA.md`**; automate in **`npm run test`** / **`test:integration`** where applicable. |
| **Release notes** | **`RELEASE_NOTES_PRODUCT.md`** per deploy or milestone. |
| **OpenAPI / hub-client** updated when partner surface changes | **`PARTNER_API_CHANGE_CHECKLIST.md`** completed before merge. |

---

## 4. References

- **`ROADMAP.md`** — full capability backlog (§§1–10).  
- **`docs/GAP1_PRODUCT_API.md`**, **`docs/GAP2_SMART_OAUTH.md`**, **`docs/GAP7_DATA_MODEL.md`** — depth per area.  
- **`docs/GAP9_TESTING.md`** — integration test conventions.
