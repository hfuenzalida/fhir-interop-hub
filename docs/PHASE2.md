# Phase 2 — Ingestion & interface visibility

## Delivered

- **`interface_message` table** — one row per ingest run with `connector`, `status`, `raw_sha256`, `raw_preview` (4k cap), `error`, `outcome` JSON, timestamps (KPI-friendly).
- **`POST /internal/v1/ingest/bundle`** — FHIR `Bundle` (`type`: `batch` | `collection` | `transaction`); each `entry.resource` is created or upserted (same allowlist as Phase 1).
- **`POST /internal/v1/ingest/hl7v2`** — minimal **ORU^R01** → `Patient` + `Observation` (lab-style `OBX` with value in OBX-5). Raw HL7 as **`text/plain`** or JSON `{"message":"MSH|...\\r..."}`.
- **`GET /internal/v1/metrics/interfaces`** — counts by `status` for the last **24 hours** (per tenant).

All `/internal/v1/*` routes use the **same API key** as `/fhir/*` (`Authorization: Bearer` or `X-Hub-Api-Key`).

## Database

Apply after Phase 1 migrations:

```text
psql ... -f db/migrations/003_phase2_interface.sql
```

(or `docker compose exec -T postgres psql ...` as you did before).

## Examples

**Bundle ingest** (`application/json`):

```http
POST /internal/v1/ingest/bundle
Content-Type: application/json
Authorization: Bearer <key>

{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "ingest-1",
        "name": [{ "family": "BundleIngest" }]
      }
    }
  ]
}
```

**HL7** (JSON wrapper — easier on Windows CMD):

```http
POST /internal/v1/ingest/hl7v2
Content-Type: application/json
Authorization: Bearer <key>

{"message":"MSH|^~\\&|L|S|R|R|202601011200||ORU^R01|MC1|P|2.5\rPID|1||PAT999^^^MRN||Smith^Ann||19800101|F\rOBX|1|ST|WBC||7.2||||||F"}
```

**Windows CMD:** piping characters `|` in an inline `-d "..."` string are parsed as shell pipes (`No se esperaba | en este momento`). Use a file instead:

```text
curl -s -X POST http://127.0.0.1:3000/internal/v1/ingest/hl7v2 -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d @examples\hl7-oru-ingest.json
```

(Run from the repo root.)

**Metrics**

```http
GET /internal/v1/metrics/interfaces
Authorization: Bearer <key>
```

## Limits (explicit)

- HL7 path is a **demo mapper**, not a full v2 engine (no full ORC/OBR chains, no coding validation).
- **Idempotency / replay** and **MLLP** are natural Phase 3+ extensions.

## Exit criteria (Phase 2)

- [x] At least one **non-FHIR-REST** path into the hub (HL7 ORU).
- [x] **FHIR Bundle** batch ingest for connector-style sync.
- [x] **Persisted interface runs** + **24h metrics** for interoperability KPIs.

Next: **Phase 3** — SMART on FHIR auth, or **connector hardening** (queues, MLLP, Bulk `$import` alignment).
