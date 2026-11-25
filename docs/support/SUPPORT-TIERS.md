# Support tiers & escalation (operator playbook)

Use this for **internal** alignment and customer-facing support descriptions. Severity labels should map to your ticketing system.

## Severity levels (example)

| Severity | Definition | First response (example) |
|----------|------------|---------------------------|
| **S1 — Critical** | Production hub unavailable for all or majority of users; data plane down; security incident | ≤ 1h (business) / 24×7 if contracted |
| **S2 — Major** | Material degradation: elevated 5xx, OAuth/token issuance broken, sustained latency above SLA | ≤ 4h |
| **S3 — Minor** | Single-tenant or non-production issue; workaround exists | ≤ 1 business day |
| **S4 — General** | How-to, roadmap, documentation | Best effort |

Adjust times to what your team can actually meet.

## L1 (front-line)

- Verify customer identity and subscription context (tenant / environment).
- Gather: timestamps, request IDs (`x-request-id`), HTTP status, endpoint, **no PHI** in tickets unless policy allows.
- Run quick checks: `GET /health`, `GET /ready`, recent deploys, known incidents.
- Escalate to L2 when logs/metrics access is needed or scope touches OAuth, DB, or FHIR validation.

## L2 (platform / engineering-oriented)

- Correlate with Prometheus: error rates, latency by route, `hub_oauth_tokens_issued_total`, pool saturation.
- Review audit trail patterns (non-PHI summaries) for the tenant if investigating access issues.
- Database: connection limits, slow queries, migration state (coordination with DBA).

## Engineering escalation

Escalate when:

- Suspected **data loss**, **integrity chain** alerts, or **security** boundary violations.
- Repeated **S1/S2** without root cause.
- Customer threatens contractual SLA breach — involve leadership + customer success.

## Log / metric pack for vendors (no PHI)

**Template:** **`docs/templates/SUPPORT_LOG_PACK.md`**.

Include:

- Time range (UTC), region, cluster/id.
- Graphs or exported series: 5xx rate, p95 latency for affected routes, OAuth token errors if relevant.
- Sample **request IDs** only (no URLs with patient identifiers; strip query strings if policy requires).

Exclude:

- Raw FHIR payloads, patient names, MRNs, access tokens, refresh tokens, API key plaintext.

## References

- **`docs/RUNBOOKS.md`** — incident responses.
- **`docs/templates/INCIDENT_RESPONSE.md`** — commander workflow (Phase IV); align severities with this page.
- **`docs/PROD_PHASE4_OBSERVABILITY.md`** — metrics, paging tests.  
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** — GTM / support go-live.
- **`docs/GAP10_COMMERCIAL.md`** — metering and usage summary API.
