# Phase IV — Observability, alerting & incident readiness (delivered artifacts)

Maps **Phase IV** in **`ROADMAP_TO_PROD.md`**: metrics scraping, log discipline, optional tracing, alerting patterns, and incident workflow templates. **Dashboards, collectors, and paging** live in **your** observability stack — this repo ships **contracts** (paths, metric names, headers) and **starter rules**.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE4_OBSERVABILITY.md`** (this file) | Phase IV overview and exit criteria. |
| **`docs/prometheus/prometheus-alert-rules.example.yml`** | Example **Prometheus** alert rules for hub metrics (tune thresholds). |
| **`docs/prometheus/SCRAPING_INTERNAL_METRICS.md`** | Scrape **`/internal/metrics`** with **`INTERNAL_METRICS_TOKEN`**. |
| **`docs/templates/INCIDENT_RESPONSE.md`** | Severity, roles, comms — align with **`docs/support/SUPPORT-TIERS.md`**. |
| **`docs/templates/ON_CALL_ALERT_ROUTING_TEST.md`** | Procedure to **prove** paging works (synthetic failure). |
| **`docs/templates/LOG_SHIPPING_CHECKLIST.md`** | JSON logs + **`correlationId`** / **`reqId`** — avoid PHI in log bodies. |
| **`docs/otel/OTEL_NODE_PRELOAD.md`** | OpenTelemetry via **Node preload** (no hub code fork required). |
| **`docs/GAP6_OBSERVABILITY.md`**, **`docs/RUNBOOKS.md`**, **`deploy/README.md`** | Updated cross-links. |

**Application behavior** (existing): **`docs/GAP6_OBSERVABILITY.md`** — Pino JSON logs, **`x-request-id`**, **`CORRELATION_ID_HEADER`**, Prometheus metrics including **`hub_metered_requests_total`**.

---

## 2. Metrics (RED / USE on hub)

| Signal | Metric(s) | Notes |
|--------|-----------|--------|
| **Errors** | **`hub_http_requests_total{status_family="5xx"}`** | Rate vs total; slice by **`route`** if cardinality OK. |
| **Latency** | **`hub_http_request_duration_seconds`** | Histogram — use histogram_quantile in Prometheus (or native in Grafana). |
| **Traffic** | **`hub_http_requests_total`**, **`hub_metered_requests_total`** | Metering by **`tenant_external_key`**, **`api_family`**. |
| **OAuth** | **`hub_oauth_tokens_issued_total`** | Drops may indicate client or IdP issues. |
| **Saturation** | **`hub_pg_pool_connections{state="waiting"}`** | > 0 sustained ⇒ pool pressure. |
| **Utilization** | **`hub_pg_pool_connections`** | **total** / **idle** vs **`PG_POOL_MAX`**. |

---

## 3. Logs

- Default **JSON** logs from Fastify/Pino; **`LOG_LEVEL`**, **`LOG_REDACT_ENABLED`**.  
- Propagate **`CORRELATION_ID_HEADER`** (default **`x-correlation-id`**) from gateways for cross-service correlation.  
- **`docs/templates/LOG_SHIPPING_CHECKLIST.md`** — ship off-node; never log raw FHIR bodies or tokens.

---

## 4. Tracing (OpenTelemetry)

In-process OTEL is **not** required for Phase IV exit criteria. Use **`docs/otel/OTEL_NODE_PRELOAD.md`** to attach **`@opentelemetry/auto-instrumentations-node`** via **`NODE_OPTIONS`** and OTLP export to your backend.

---

## 5. Alerting

- Import **`docs/prometheus/prometheus-alert-rules.example.yml`** as a starting point; tune **`for`**, thresholds, and **`severity`** labels for your on-call policy.  
- **Replication lag**, **backup job failure**, **TLS cert expiry** usually come from **cloud provider** metrics — wire those in the same Alertmanager route as hub alerts.

---

## 6. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | How to satisfy |
|-----------|----------------|
| **On-call + alert routing tested** | Run **`docs/templates/ON_CALL_ALERT_ROUTING_TEST.md`** and record results. |
| **Incident workflow** | Adopt **`docs/templates/INCIDENT_RESPONSE.md`**; map severities to **`docs/support/SUPPORT-TIERS.md`**. |

---

## 7. References

- **`docs/GAP6_OBSERVABILITY.md`**  
- **`docs/RUNBOOKS.md`**  
- **`docs/PROD_PHASE2_SECURITY.md`** — **`INTERNAL_METRICS_TOKEN`** in production.
