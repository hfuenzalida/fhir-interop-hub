# SLO & error budget (template for SLA appendix)

Copy rows into **`docs/templates/SLA-draft.md`** and customer order forms. Replace placeholders with **measured** baselines after load tests (**`scripts/load/`**, **`docs/PROD_PHASE3_RELIABILITY.md`**).

**Measurement:** Tie availability to **`GET /ready`**, synthetic checks, or **`5xx_rate`** on `/fhir` + `/oauth` from your metrics stack — see **`SLA-draft.md`** §2.

## Availability targets (examples)

| Surface | Monthly availability | Approx. max downtime / month |
|---------|----------------------|------------------------------|
| **FHIR read** (`GET` / search) | *99.9%* | ~43 min |
| **FHIR write** | *99.5%* | ~3.6 h |
| **OAuth token** | *99.5%* | ~3.6 h |
| **Ingestion** (if contracted) | *99.0%* | ~7.3 h |

**Exclusions:** Scheduled maintenance (define notice period), customer networks, provider outages (if contractually excluded).

## Latency targets (p95)

| Operation | p95 target | Notes |
|-----------|------------|--------|
| **`GET /fhir/metadata`** | *e.g. < 2 s* | Cached — **`CAPABILITY_CACHE_TTL_MS`**. |
| **FHIR read** | *e.g. < 1 s* | From **`hub_http_request_duration_seconds`**. |
| **FHIR write** | *e.g. < 1.5 s* | |
| **`POST /oauth/token`** | *e.g. < 800 ms* | |

## Recovery (internal DR goals — optional in customer SLA)

| Metric | Target |
|--------|--------|
| **RPO** | |
| **RTO** | |

**Evidence:** Link to completed **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`** sign-off.
