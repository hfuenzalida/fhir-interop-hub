# GAP 6 — Observability & operations (in-repo foundation)

## Structured logging

- **Pino** (via Fastify): JSON logs by default; **`LOG_LEVEL`** overrides the default (`info` in development, `warn` in production).
- **`x-request-id`**: Generated per request (`genReqId`) and stored as request id (also available as **`request.id`**).
- **`CORRELATION_ID_HEADER`** (default **`x-correlation-id`**): When present, the hub attaches **`correlationId`** to the request logger child so structured logs correlate with upstream callers.
- **`LOG_REDACT_ENABLED`**: Redacts Authorization and Hub API key headers from request logs (GAP 4).

### Downstream correlation

Audit events emitted via **`emitAudit`** already include **`network.requestId`**. Propagate the same **`x-request-id`** (and optional correlation header) from your gateway to logs and traces in other services.

## Prometheus metrics

**`GET /internal/metrics`** returns **Prometheus text format** when **`METRICS_ENABLED=true`** (default).

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| **`hub_http_requests_total`** | Counter | `method`, `route`, `status_family` | RED — request rate & error classes |
| **`hub_http_request_duration_seconds`** | Histogram | `method`, `route` | Latency buckets |
| **`hub_oauth_tokens_issued_total`** | Counter | `grant_type` | OAuth token issuance (`authorization_code`, `refresh_token`) |
| **`hub_pg_pool_connections`** | Gauge | `pool` (`primary` \| `replica`), `state` (`total` \| `idle` \| `waiting`) | Pool saturation |
| **`hub_metered_requests_total`** | Counter | `tenant_external_key`, `api_family` | Billing-oriented metering (**GAP 10**) |

Optional: **`METRICS_NODE_COLLECT_DEFAULT=true`** registers Node.js default metrics (heap, GC, event loop lag) via **prom-client** — useful on staging; watch cardinality/cost in prod.

**Phase IV (production rollout):** alerting & scrape patterns — **`docs/PROD_PHASE4_OBSERVABILITY.md`**, **`docs/prometheus/`**.

**Security:** Set **`INTERNAL_METRICS_TOKEN`** and scrape with **`Authorization: Bearer <token>`**. Without a token, **`/internal/metrics` is open** — restrict at the network layer (internal LB only) or always set the token in production.

Scrape **`/internal/metrics`** is excluded from HTTP latency/request counters to avoid skew from polling.

## Distributed tracing (OpenTelemetry)

Not bundled as a **dependency** of **`hub-api`** (smaller image). Use **Node preload** — **`docs/otel/OTEL_NODE_PRELOAD.md`** — with **`@opentelemetry/auto-instrumentations-node`** and OTLP export to Jaeger/Tempo/Datadog. Enable **`traceparent`** / **`tracestate`** at your ingress so spans join across services.

## Alerting

Wire Prometheus → **Alertmanager** (or cloud monitoring). Starter rules: **`docs/prometheus/prometheus-alert-rules.example.yml`**.

Examples:

- **`rate(hub_http_requests_total{status_family="5xx"}[5m])`** above a threshold.
- **`hub_pg_pool_connections{state="waiting"}`** > 0 sustained — pool exhaustion.
- **`up{job="hub-api"}`** = 0 — instance down (requires scrape target config).

## Deployment runbook (summary)

- Run DB migrations as a **release gate** before rolling new app versions.
- For zero-downtime, use health checks: **`/ready`** must pass before receiving traffic; drain old tasks after new ones are healthy.
- **Blue/green** or **canary** is an infrastructure choice (K8s `Deployment`, ECS, etc.).

See **`docs/RUNBOOKS.md`** for common failure modes.
