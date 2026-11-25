# Billing & CRM — metering integration (patterns)

**Purpose:** Connect hub **metrics** and **usage API** to **usage-based billing**, **Salesforce / HubSpot**, or **finops** dashboards. Implementation is **your** billing vendor (Stripe Metering, cloud marketplace, custom ETL).

**Sources (in-repo):**

| Source | Access | Data |
|--------|--------|------|
| **Prometheus** | Scrape **`GET /internal/metrics`** with **`INTERNAL_METRICS_TOKEN`** | **`hub_metered_requests_total`**, **`hub_oauth_tokens_issued_total`**, histograms |
| **Usage summary API** | **`GET /internal/v1/usage/summary`** — tenant API key | Audit rollup by **`action`**, Prometheus pointers |
| **Hub client** | **`@fhir-hub/hub-client`** **`getUsageSummary(hours?)`** | Typed JSON for scheduled jobs |

See **`docs/prometheus/SCRAPING_INTERNAL_METRICS.md`** and **`docs/GAP10_COMMERCIAL.md`**.

---

## 1. Recommended pipeline (generic)

1. **Scrape** Prometheus from **internal** network on an interval (e.g. 1m).  
2. **Record** `increase(hub_metered_requests_total[1h])` by **`tenant_external_key`** (drop **`_anonymous`** or bucket separately).  
3. **Export** daily aggregates to **billing system** (CSV, webhook, BigQuery, etc.).  
4. **Optional:** nightly job calling **`usage/summary`** per tenant API key for **audit-aligned** counts — reconcile with Prometheus.

---

## 2. CRM (sales / success)

- Sync **tenant external_key** ↔ **CRM account ID** in your CRM (manual or integration).  
- Attach **usage dashboards** links (Grafana) **without** PHI — RED metrics only.

---

## 3. Caveats

- **Cardinality:** **`tenant_external_key`** label cardinality must stay within Prometheus/Grafana limits — alert if tenant count explodes.  
- **Export/storage GB:** Not in hub metrics — bill from **object storage** metrics if applicable.  
- **Multi-instance Prometheus:** Use **federated** queries or **single** scrape target per cluster.

---

## 4. References

- **`docs/PROD_PHASE4_OBSERVABILITY.md`**  
- **`docs/templates/PRICING_PACKAGING.md`**
