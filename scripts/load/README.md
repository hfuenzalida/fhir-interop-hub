# Load scripts (k6)

Requires **[k6](https://k6.io/)** installed locally or in CI.

## Scripts

| File | Auth | Endpoints |
|------|------|-----------|
| **`k6-metadata-smoke.js`** | No | `GET /fhir/metadata`, `GET /ready` |
| **`k6-fhir-read-smoke.js`** | **`K6_BEARER_TOKEN`** | `GET /fhir/Patient?_count=5` |

## Examples

```bash
# Public smoke (local hub)
k6 run scripts/load/k6-metadata-smoke.js

# With custom base URL
K6_BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-metadata-smoke.js

# Authenticated read smoke (staging — use synthetic tenant key only)
K6_BASE_URL=https://stage.example.com K6_BEARER_TOKEN=hub_... k6 run scripts/load/k6-fhir-read-smoke.js
```

## Phase III

Use results with **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`** and **`docs/templates/SLO_BUDGET_TABLE.md`**. Do not point load **production** without approval and guardrails.
