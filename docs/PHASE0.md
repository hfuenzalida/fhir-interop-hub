# Phase 0 — Foundations (complete checklist)

## Architecture

- [x] Monorepo npm workspaces: `packages/shared`, `services/hub-api`
- [x] Environment template (`.env.example`) and runtime validation (`zod`)
- [x] Local Postgres via `docker-compose.yml` (optional)

## Security baseline

- [x] Secrets excluded via `.gitignore` (`.env`)
- [x] Dependency update automation (`.github/dependabot.yml`)
- [x] ESLint on TypeScript sources
- [ ] TLS termination: use platform (K8s ingress, load balancer) in deployed envs — document in runbooks (Phase 6)
- [ ] Encryption at rest: enable on managed DB / volume encryption in target cloud — recorded in `THREAT_MODEL_V0.md`

## Identity (sketch)

- [x] Placeholder roles in `@fhir-hub/shared` (`auth/roles.ts`)
- [x] OIDC env placeholders (`OIDC_ISSUER`, `OIDC_AUDIENCE`) — wire in Phase 3 (SMART)

## Audit strategy

- [x] Event taxonomy and TypeScript types (`AuditEvent`, actions, outcomes)
- [x] Append-only SQL table `audit_event` + migration
- [x] Hub: console sink always; optional Postgres dual-write when `DATABASE_URL` is set
- [x] Synthetic audit on `GET /health` for connectivity testing

## Implementation guides

- [x] FHIR R4 + US Core version pins in `packages/shared/src/constants/fhir-ig.ts`
- [x] Compliance scope statement `docs/COMPLIANCE_SCOPE_V1.md`

## Governance artifacts

- [x] Threat model v0: `docs/THREAT_MODEL_V0.md`
- [x] Audit field reference: `docs/AUDIT_EVENTS.md`
- [x] IG targets: `docs/IG_TARGETS.md`

## Exit: “hello” deployment

- [x] Runnable `hub-api` with `/health` and `/ready`
- [x] Audit events observable (stdout + optional DB)

Next: **Phase 1** — FHIR server CRUD/search, tenant isolation, SLO draft.
