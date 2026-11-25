# Scraping `GET /internal/metrics`

## Endpoint

- **URL path:** `/internal/metrics`  
- **Format:** Prometheus text (UTF-8)  
- **Auth:** If **`INTERNAL_METRICS_TOKEN`** is set on the hub, scrape with:

```http
GET /internal/metrics HTTP/1.1
Host: <hub-host>
Authorization: Bearer <INTERNAL_METRICS_TOKEN>
```

The hub compares the full header to `Bearer <token>` (see **`register-internal-routes.ts`**).

## Prometheus `scrape_configs` (example)

```yaml
scrape_configs:
  - job_name: hub-api-internal-metrics
    metrics_path: /internal/metrics
    scheme: https
    authorization:
      credentials_file: /etc/prometheus/secrets/hub_metrics_token
    static_configs:
      - targets:
          - hub-api.internal:443
```

Use **`credentials`** / file-based secrets — **never** commit tokens to git.

## Network

Restrict scrape sources (security group / network policy) to **Prometheus** or **Grafana Agent** only; defense in depth alongside the bearer token.

## Phase II / III alignment

- Production requires the token when **`METRICS_ENABLED=true`** — **`services/hub-api/src/env.ts`**.  
- **`deploy/README.md`** — TLS and private networking.
