# Pricing & packaging (template)

**Internal / commercial-in-confidence.** Align metered dimensions with **`hub_metered_requests_total`** (**`tenant_external_key`**, **`api_family`**) and **`hub_oauth_tokens_issued_total`** — see **`docs/GAP10_COMMERCIAL.md`**.

---

## 1. Offer structure

| SKU / tier | Buyer | Included capacity | Overages |
|------------|-------|-------------------|----------|
| *[e.g. Platform]* | | *[requests/mo, tenants, environments]* | *[per 1M API calls, etc.]* |

---

## 2. Metering basis (map to observability)

| Billable dimension | Source in hub | Notes |
|---------------------|---------------|--------|
| API traffic by surface | **`hub_metered_requests_total`** | **`api_family`**: fhir, oauth, internal, … |
| OAuth tokens | **`hub_oauth_tokens_issued_total`** | By **`grant_type`** |
| Audit rollup (contract proof) | **`GET /internal/v1/usage/summary`** | Tenant-scoped; **`@fhir-hub/hub-client`** **`getUsageSummary`** |
| Export GB / storage | *Infra metrics* | Not in hub process — bill separately |

---

## 3. Discounts & trials

| Program | Duration | Metering during trial |
|---------|----------|-------------------------|
| POC | | |

---

## 4. References

- **`docs/templates/BILLING_CRM_METERING_WIRING.md`**  
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**
