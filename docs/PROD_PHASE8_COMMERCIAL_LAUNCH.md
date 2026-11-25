# Phase VIII — Commercial launch operations (delivered artifacts)

Maps **Phase VIII** in **`ROADMAP_TO_PROD.md`**: **metering → billing handoffs**, **tenant onboarding**, **SLA alignment**, **support readiness**, and **first-customer learning**. CRM/billing **systems** and **live ticketing** stay in **your** stack — this repo provides **runbooks and templates**.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** (this file) | Phase VIII index and exit criteria. |
| **`docs/templates/PRICING_PACKAGING.md`** | SKUs / tiers / metering basis — fill before external quoting. |
| **`docs/runbooks/TENANT_ONBOARDING.md`** | Contract → tenant → API keys → OAuth clients. |
| **`docs/templates/BILLING_CRM_METERING_WIRING.md`** | Patterns to connect Prometheus + **`usage/summary`** to billing/CRM. |
| **`docs/templates/SUPPORT_OPERATIONS_LIVE.md`** | Go-live checklist: queue, routing, escalation. |
| **`docs/templates/SUPPORT_LOG_PACK.md`** | Standard **no-PHI** bundle for L1/L2 ↔ engineering (**Phase VIII**). |
| **`docs/templates/FIRST_TENANT_POSTMORTEM.md`** | First production tenant — retrospective template. |
| **`docs/GAP10_COMMERCIAL.md`** | Updated — Phase VIII pointer. |

**Existing:** **`docs/GAP10_COMMERCIAL.md`**, **`docs/templates/SLA-draft.md`**, **`docs/support/SUPPORT-TIERS.md`**, **`npm run tenant-admin`**, **`GET /internal/v1/usage/summary`**, **`@fhir-hub/hub-client`** **`getUsageSummary`**.

---

## 2. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | Deliverable |
|-----------|-------------|
| **Pricing / packaging documented** | **`docs/templates/PRICING_PACKAGING.md`** completed for your GTM. |
| **Support queue and escalation live** | **`docs/templates/SUPPORT_OPERATIONS_LIVE.md`** signed off; **`SUPPORT-TIERS.md`** trained. |
| **First production tenant post-mortem** | **`docs/templates/FIRST_TENANT_POSTMORTEM.md`** after first go-live. |

---

## 3. References

- **`docs/PROD_PHASE4_OBSERVABILITY.md`** — scrape **`/internal/metrics`**.  
- **`docs/templates/SLO_BUDGET_TABLE.md`** — numbers feeding **`SLA-draft.md`**.  
- **`docs/PROD_PHASE7_QUALITY.md`** — release discipline before revenue-critical deploys.
