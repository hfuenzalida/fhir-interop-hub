# OpenTelemetry — Node preload (optional)

The hub does **not** bundle OpenTelemetry SDKs in **`services/hub-api`** (keeps dependencies minimal). You can still enable **HTTP + Postgres** auto-instrumentation by **preloading** the official package **before** `node` loads the app.

## 1. Install (in your image or runtime)

```bash
npm install --save @opentelemetry/auto-instrumentations-node
```

Ensure **`node_modules`** for this install is on **`NODE_PATH`** or run from the directory where it was installed — same **`node`** process that runs **`services/hub-api/dist/index.js`**.

## 2. Environment variables

| Variable | Example |
|----------|---------|
| **`OTEL_SERVICE_NAME`** | `hub-api` |
| **`OTEL_EXPORTER_OTLP_ENDPOINT`** | `https://otel-collector.internal:4318` |
| **`OTEL_TRACES_EXPORTER`** | `otlp` |
| **`OTEL_PROPAGATORS`** | `tracecontext,baggage` |

Use **OTLP HTTP/gRPC** per your collector. See [OpenTelemetry environment spec](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/).

## 3. Start the hub with preload

```bash
export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
export OTEL_SERVICE_NAME=hub-api
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318/v1/traces
node services/hub-api/dist/index.js
```

In **Kubernetes**, set **`NODE_OPTIONS`** on the Deployment container spec.

## 4. Ingress propagation

Ensure your load balancer or API gateway **forwards** **`traceparent`** / **`tracestate`** (W3C) so spans connect to upstream callers.

## 5. Validation

- Trigger a request; confirm spans in **Jaeger**, **Tempo**, **Datadog**, etc.  
- Compare **`trace_id`** with **`x-request-id`** / log correlation strategy (**not always identical**).

## 6. Caveats

- Auto-instrumentation adds **CPU/memory** overhead — measure in staging.  
- Version-pin **`@opentelemetry/auto-instrumentations-node`** with your Node LTS.

---

**Phase IV:** Tracing is **optional** for exit criteria; metrics + logs + paging are mandatory per **`docs/PROD_PHASE4_OBSERVABILITY.md`**.
