# Support log & metric pack (no PHI)

**Audience:** L1/L2 attaching evidence for **L3 / engineering** — aligns with **`docs/support/SUPPORT-TIERS.md`** “Log / metric pack for vendors (no PHI)”.

**Never include:** Raw FHIR bodies, patient names, MRNs, tokens, full URLs with patient query params.

---

## 1. Incident header

| Field | Value |
|-------|--------|
| **Tenant / external key** | *(customer identifier — not MRN)* |
| **Environment** | prod / pilot |
| **UTC time range** | |
| **Request IDs** | **`x-request-id`** values only |

---

## 2. Metrics snapshot (paste links or redacted screenshots)

| Chart / query | Notes |
|---------------|--------|
| **5xx rate** (`hub_http_requests_total`) | By **`route`** if available |
| **p95 latency** | Critical routes |
| **Pool waiting** | `hub_pg_pool_connections{state="waiting"}` |
| **OAuth** | `rate(hub_oauth_tokens_issued_total[15m])` if token failures |

---

## 3. Logs

- **Structured** lines around **`correlationId`** / **`reqId`** — **no** Authorization headers.  
- **Max** 10–20 representative lines.

---

## 4. Optional internal usage

- **`GET /internal/v1/usage/summary`** — **tenant’s own** API key only; include **aggregate counts**, not row-level audit content in external tickets.

---

## 5. References

- **`docs/templates/LOG_SHIPPING_CHECKLIST.md`** (platform logging).  
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**.
