# Audit events — field reference

Events follow `AuditEvent` in `@fhir-hub/shared` (`packages/shared/src/audit/events.ts`).

| Field | Description |
|--------|-------------|
| `id` | Unique event id (UUID). |
| `timestamp` | ISO-8601 UTC. |
| `action` | `CREATE` \| `READ` \| `UPDATE` \| `DELETE` \| `EXECUTE`. |
| `outcome` | `success` \| `failure` \| `partial`. |
| `actor.tenantId` | Organization tenant (required for isolation). |
| `actor.subject` | End-user subject id from IdP when present. |
| `actor.clientId` | OAuth client or service account id for M2M. |
| `actor.role` | Coarse role string (align with SMART/OIDC later). |
| `entity.type` | Logical type (e.g. `Patient`, `Observation`, `System`). |
| `entity.id` | Resource id when applicable. |
| `entity.patientId` | Patient context for HIPAA accounting-style queries. |
| `api.method` / `api.path` | HTTP surface. |
| `network.requestId` | Correlation id (e.g. `x-request-id`). |
| `detail` | Non-PHI operator hint; **never** store full payloads by default. |

**Postgres:** `db/migrations/001_audit_event.sql` stores JSONB for `actor`, `entity`, `api`, `network`. Migration **`009_audit_integrity_consent_support.sql`** adds **`chain_prev_id`**, **`entry_hash`**, **`row_hash`**, table **`audit_chain_head`**, and a trigger that **rejects UPDATE/DELETE** on `audit_event`. See `docs/COMPLIANCE_CONSENT_AND_AUDIT.md`.
