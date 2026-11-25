# Phase 6 — FHIR `transaction` Bundle (atomic)

Phase 6 adds **`POST /fhir`** (and typically **`POST /fhir/`**) for a **Bundle** with **`"type": "transaction"`**. All write steps run in a **single database transaction** (all commit or all roll back).

## Auth

- **API key** (or **`DEV_API_KEY`**) — allowed.
- **SMART JWT** — **not** allowed for transactions (**403**); use API keys for writes.

## Supported entry operations

Each **`Bundle.entry`** must include **`request.method`** and **`request.url`**:

| Method | URL shape | Body |
|--------|-----------|------|
| `POST` | `{ResourceType}` e.g. `Patient`, `Observation` | **`entry.resource`** required |
| `PUT` | `{ResourceType}/{logicalId}` | **`entry.resource`** required; id must match URL |
| `DELETE` | `{ResourceType}/{logicalId}` | no resource |

**Resource types** are the Phase 1 allowlist (`Patient`, `Observation`, `Condition`, `Encounter`, `DocumentReference`).

Optional URL forms: **`fhir/Patient/x`** or absolute URL (host stripped).

Max **100** entries per Bundle (`BUNDLE_MAX_ENTRIES`).

## Response

HTTP **200** with **`Bundle`** **`type`: `batch-response`**. Each **`entry.response`** has **`status`** (`201`, `200`, `204`) and optional **`location`** (relative id path).

Duplicate id or validation failure → entire transaction aborted; HTTP **400** or **409** (`OperationOutcome`).

## CapabilityStatement

**`rest.interaction`** includes **`transaction`** — see **`GET /fhir/metadata`**.

## CMD example

Use a JSON file for the body (CMD-friendly):

**tx.json** (minimal two-step create):

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": { "method": "POST", "url": "Patient" },
      "resource": {
        "resourceType": "Patient",
        "name": [{ "family": "Txn", "given": ["Test"] }]
      }
    },
    {
      "request": { "method": "POST", "url": "Observation" },
      "resource": {
        "resourceType": "Observation",
        "status": "final",
        "code": { "text": "temp" },
        "subject": { "reference": "Patient/REPLACE_AFTER_FIRST_CREATE" }
      }
    }
  ]
}
```

Across multiple **`POST`** entries you must use a **client-assigned Patient `id`** (FHIR allows this on create here) so later entries can reference **`Patient/your-id`** on **`Observation.subject`** before commit. Alternatively use **`PUT Patient/{knownId}`** then **`POST Observation`** in order.

```bat
curl.exe -s -X POST "http://127.0.0.1:3000/fhir/" ^
  -H "Content-Type: application/fhir+json" ^
  -H "X-Hub-Api-Key: %KEY%" ^
  --data-binary "@tx.json"
```

If **`404`** on **`POST /fhir/`**, try **`http://127.0.0.1:3000/fhir`** without trailing slash or vice versa.
