# GAP 7 — Data model & quality (foundation)

This slice adds **MPI-style patient links**, **deterministic duplicate detection**, **soft-delete restore**, **NDJSON tenant export/import**, and **id remap storage** for migrations.

## Schema (migration `010_gap7_patient_link_id_map.sql`)

| Object | Purpose |
|--------|---------|
| **`patient_link`** | Undirected edge between two Patient logical ids (`left` &lt; `right`), with `link_type` (`replaced-by`, `see-also`, `duplicate`) and optional `match_rule`. One row per tenant per pair. |
| **`fhir_id_import_map`** | Maps `(resource_type, source_logical_id)` → `target_logical_id` after bulk import when ids are rewritten (populate from your own tooling or future hub CLI). |

## Soft-delete restore

- **Semantics:** `fhir_resource.deleted = true` hides the row from searches and CRUD; uniqueness for live rows is enforced by partial unique index (`WHERE NOT deleted`).
- **Restore:** If a **live** row already exists for the same `(tenant, resource_type, logical_id)` (re-created after delete), restore **conflicts** (`409`) — resolve manually (delete or merge the live row first).
- **API:** `POST /internal/v1/mpi/fhir-resources/:resourceType/:logicalId/restore` (same auth as other `/internal/v1/*` routes).

## MPI / deduplication

- **Duplicate preview (deterministic):** `GET /internal/v1/mpi/patient-duplicate-candidates?limit=200` — groups Patients sharing the same `identifier` (`system` + `value`) within the tenant.
- **Probabilistic candidates:** `GET /internal/v1/mpi/patient-probabilistic-candidates?minScore=75&maxPairs=100` — scores pairs within **birthDate** or **identifier** blocking buckets using weighted birthDate, gender, **Jaro–Winkler** name similarity, and identifier overlap (0–100). Dedupes overlapping blocking keys.
- **Pair score:** `POST /internal/v1/mpi/patient-match-score` — JSON `{ patientLogicalIdA, patientLogicalIdB }` → `{ score, breakdown }`.
- **Automated merge:** `POST /internal/v1/mpi/patient-merge` — JSON:
  - `survivorPatientLogicalId`, `duplicatePatientLogicalId`
  - `rewriteReferences` (boolean, default true): rewrite `Patient/{duplicate}` references across **all Phase 1 resource types** (including **Provenance**) stored for the tenant.
  - `softDeleteDuplicate` (boolean, default true): soft-delete the duplicate Patient after writes.
  Creates **`patient_link`** (`replaced-by`, `automated-merge`), inserts a FHIR **`Provenance`** (targets both Patients, `activity` = v3 DataOperation UPDATE), and commits in one DB transaction.
- **Manual link:** `POST /internal/v1/mpi/patient-links` — `patientLogicalIdA`, `patientLogicalIdB`, `linkType`, optional `matchRule`.
- **List links:** `GET /internal/v1/mpi/patient-links`.

**Provenance** is a Phase 1 stored resource type (`GET`/`POST`/`PUT`/`DELETE` via `/fhir/Provenance` with API key; SMART JWT search/read still excludes Provenance unless extended later).

## NDJSON migration tooling

Scripts use repo-root `.env` (`DATABASE_URL`) like `npm run seed`.

| Script | Command |
|--------|---------|
| Export | `node ./scripts/export-tenant-ndjson.mjs --tenant <external_key> > bundle.ndjson` |
| Import (legacy, no remap) | `node ./scripts/import-tenant-ndjson.mjs --tenant <external_key> < bundle.ndjson` |
| Import + remap | `npm run import-tenant-ndjson -- --tenant <external_key> --remap-file map.json [--record-map] < bundle.ndjson` |

The **workspace** import (`import-tenant-ndjson`) applies **`reference-remap`**: JSON map per resource type (`{ "Patient": { "old": "new" }, ... }`) rewrites every `reference` field and the resource `id` before upsert. Optional **`--record-map`** upserts rows into **`fhir_id_import_map`** when an id changes.

Legacy **`.mjs`** import **upserts** only (no remap). Both paths bump `meta.versionId` and can revive soft-deleted rows.

## Schema evolution

Migrations remain ordered SQL under `db/migrations/`. Expand/contract pattern: add nullable columns or new tables first; backfill; then tighten constraints in a later release. Zero-downtime DDL depends on your Postgres deployment — coordinate lock timeouts and `CREATE INDEX CONCURRENTLY` outside transactions when applicable.
