# Threat model — v0 (Phase 0)

## Assets

- **PHI/PII** in FHIR resources and documents (future phases).
- **Audit logs** — integrity and non-repudiation expectations for compliance.
- **API credentials** — OAuth clients, service accounts, integration endpoints.
- **Availability** — hub APIs used at point of care or in batch export.

## Trust boundaries

1. **Internet / partner networks** → API gateway / hub-api (TLS required in production).
2. **Hub** → **Postgres** (private network; credentials via secrets manager).
3. **SMART apps** → **Hub** (tokens with patient/user context; least privilege).

## Primary threats (initial)

| Threat | Mitigation (phase) |
|--------|---------------------|
| Token theft / replay | Short-lived tokens, HTTPS, SMART scopes (Phase 3) |
| Tenant crossover | Strict `tenant_id` on every query and audit row (Phase 1+) |
| Audit tampering | Append-only table; restricted DB roles in production; optional WORM/object-lock review |
| Dependency CVEs | Dependabot, lockfile, regular `npm audit` in CI |
| Insider export | Audit all bulk/export operations; break-glass procedures |

## Open items

- Formal STRIDE review after first pilot data flows.
- Penetration test before production PHI.

---

## Architecture freeze (Phase II — update when topology is fixed)

When deployment topology (regions, ingress, DB, PHI boundary) is **frozen** for a release train:

1. Re-read trust boundaries above and update rows if **Internet → hub** path changed (e.g. new WAF, mesh).  
2. Link evidence: **`docs/PROD_PHASE2_SECURITY.md`**, **`docs/VENDOR_ASSESSMENT_MAPPING.md`**, latest pen test **`docs/templates/PEN_TEST_SCOPE.md`** output.  
3. Record date and owner in your ticket system; optional one-line note here: **Frozen:** *[YYYY-MM-DD — owner]*.
