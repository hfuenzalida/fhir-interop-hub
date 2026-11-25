# Performance budgets (template)

Align with **`docs/templates/SLO_BUDGET_TABLE.md`** (customer-facing) and **internal** CI gates. Tune per environment.

---

## 1. In CI today (integration suite)

| Surface | Gate | Env var | Default |
|---------|------|---------|---------|
| **`GET /fhir/metadata`** | Median latency &lt; threshold over **35** runs | **`PERF_METADATA_MAX_MS`** | **4000** ms |

Source: **`services/hub-api/test/integration/hub.integration.test.ts`** (“GET /fhir/metadata latency smoke”).

**Raise threshold only** if CI runners are consistently noisy — prefer **staging k6** for realistic SLO evidence.

---

## 2. Recommended staging budgets (fill)

| Surface | Metric | Budget | Script / tool |
|---------|--------|--------|----------------|
| **`GET /fhir/metadata`** | p95 latency | *e.g. &lt; 2 s* | **`scripts/load/k6-metadata-smoke.js`** |
| **`GET /fhir/Patient?_count=5`** | p95 | | **`scripts/load/k6-fhir-read-smoke.js`** |
| **`POST /oauth/token`** | p95 | | *add k6 script when stable client creds in staging* |

---

## 3. Adding new budgets in code

1. Add assertion in **`hub.integration.test.ts`** or dedicated perf test file — keep **fast** for PR CI.  
2. Document env var in **`.env.example`** and this table.  
3. For heavy tests, use **`scripts/perf/`** or **`scripts/load/`** + optional **`workflow_dispatch`** workflow (**not** every PR).

---

**References:** **`docs/PROD_PHASE3_RELIABILITY.md`**, **`scripts/load/README.md`**.
