# GAP 1 — Product & API surface (foundation)

This iteration adds **search completeness**, **minimal `_include`**, **optimistic concurrency** (`ETag` / `If-Match`), **US Core–lite validation** on REST and transaction/bundle writes, and **CapabilityStatement** metadata for supported behaviour.

## Validation (US Core–lite)

On **POST /fhir/{type}**, **PUT /fhir/{type}/{id}**, and **transaction/batch** Bundle entries (POST/PUT):

- **Patient:** at least one of `identifier` (with `value`), `name` (family or given), or `telecom` (with `value`).
- **Observation:** `status`, `code` (coding `code` and/or `text`), `subject.reference` containing `Patient/`.
- **Condition:** `subject.reference` → Patient; `code` present.

Ingestion paths (HL7/FHIR ingest plugins) **do not** run this layer — only explicit FHIR REST and Bundle execution paths.

## Search

Common query parameters (where applicable):

| Parameter       | Notes |
|----------------|-------|
| `_id`          | Comma-separated logical ids |
| `_lastUpdated` | Prefix: `eq`, `ge`, `le`, `gt`, `lt` + ISO-8601 instant; repeatable (AND) |
| `_sort`        | `_lastUpdated` or `-_lastUpdated` (default: descending) |
| `_count`       | Page size (1–200) |
| `_offset`      | Offset pagination |

**Patient:** `identifier`, `name` (broad JSON match), `birthdate`, `gender`, plus `_include` (below).

**Observation, Condition, Encounter, DocumentReference:** `patient` as logical id or `Patient/{id}`.

## `_include` (Patient search only)

- Supported: `_include=Observation:subject`
- Returns Observations where `subject` references each matched Patient (deduped across patients, **max 200** included Observations total).
- SMART JWT: included Observations require `Observation` read scope.

## Concurrency

- **GET** `/fhir/{type}/{id}` sets `ETag: W/"{versionId}"` from `meta.versionId`.
- **PUT** with header `If-Match: W/"n"` (or `"n"`) updates only if the stored `version_id` equals `n`; otherwise **412** with `OperationOutcome`.

## Database

Apply migration `006_gap1_search_index.sql` for `(tenant_id, resource_type, last_updated)` indexing.

## Not yet in scope (see `ROADMAP.md` §1)

Full US Core validation, `_revinclude`, PATCH JSON Patch, instance history / `vread`, Binary storage, Bulk `$export`, Subscriptions, additional HL7/CDA, terminology services, etc.
