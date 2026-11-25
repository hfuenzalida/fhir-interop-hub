# Log shipping checklist (hub-api)

Use with **Pino** JSON logs from Fastify — **`docs/GAP6_OBSERVABILITY.md`**.

## Fields you typically get

| Field | Source |
|-------|--------|
| **`reqId`** / **`request id`** | **`x-request-id`** (Fastify) |
| **`correlationId`** | **`CORRELATION_ID_HEADER`** (default `x-correlation-id`) when present |
| **`level`**, **`msg`**, **`time`** | Pino |

## Do not log

- Raw **`Authorization`**, **`X-Hub-Api-Key`**, OAuth tokens ( **`LOG_REDACT_ENABLED`** helps).  
- **FHIR resource bodies** at **info** level in production — use **debug** only in controlled environments.  
- Full URLs that embed **patient identifiers** in query strings — prefer **`route`** template from metrics for aggregates.

## Shipping

- Forward JSON to your SIEM / log platform (CloudWatch, Datadog, ELK, etc.).  
- Set **retention** per compliance policy.  
- Restrict **log query** access for PHI-bearing environments.

## Correlation

- Mirror **`x-request-id`** from edge → hub → downstream services.  
- Align **`correlationId`** with partner gateways when possible.
