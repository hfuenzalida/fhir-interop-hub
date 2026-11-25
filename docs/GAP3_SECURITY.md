# GAP 3 — Security & zero-trust (in-app foundation)

## CORS

- Env **`CORS_ORIGINS`**: unset → **development** allows any origin (same as legacy `origin: true`); **production** uses `origin: false` (no browser CORS — server-to-server and non-browser clients OK).
- Set to **`*`** to allow any origin explicitly.
- Set to a comma-separated list, e.g. `https://app.example.com,http://localhost:4200`, for an allowlist.

## Rate limiting

Uses **`@fastify/rate-limit`** (in-memory, per process).

- **`RATE_LIMIT_ENABLED`**: default `true`. Set `false` to disable (e.g. isolated tests).
- **`RATE_LIMIT_GLOBAL_MAX`** / **`RATE_LIMIT_WINDOW_MS`**: default 600 requests per 60s per key.
- **`RATE_LIMIT_OAUTH_MAX`**: stricter cap for `/oauth/authorize` and `/oauth/token`.
- **Key** = `client IP` + first bytes of `X-Hub-Api-Key` when present (so shared NAT + different keys do not share one bucket).
- **`TRUST_PROXY`**: pass `true` in Fastify so **`req.ip`** reflects the client behind a reverse proxy (set `X-Forwarded-For` at the edge).
- **`RATE_LIMIT_ALLOW_LOOPBACK`**: when `true`, requests from `127.0.0.1` / `::1` skip the limiter (local dev). Set `false` in production if you do not want this.
- Exceeded limit → **429** with `Retry-After` and `x-ratelimit-*` headers. `/fhir` paths return a FHIR **OperationOutcome**.

## Input hardening

- **`REQUEST_BODY_LIMIT_BYTES`**: global Fastify body limit (default 11 MiB).
- **`FHIR_JSON_MAX_DEPTH`**: reject parsed FHIR JSON when nesting exceeds this depth (default 48) — applies to `application/fhir+json` and ingest bundle JSON.
- **`HL7_INGEST_MAX_CHARS`**: reject HL7 messages over this length after parsing; `text/plain` body limit is capped to this + 64 KiB.

## Not implemented in code (operational / edge)

- **WAF, DDoS, mTLS, Vault**: deploy at load balancer, service mesh, or platform; this service documents hooks only.
- **Secrets**: keep secrets in environment or your secret store; do not commit `.env`. Rotation is a runbook + env rollout.

## CI hygiene

- **`npm run audit:deps`** — **`@fhir-hub/hub-api`** — automated in **`.github/workflows/dependency-audit.yml`**.  
- **CodeQL** (SAST) — **`.github/workflows/codeql.yml`**.  
- DAST / pen test scope — **`docs/templates/PEN_TEST_SCOPE.md`**; production guardrails — **`docs/PROD_PHASE2_SECURITY.md`**.
