# Phase 7 — FHIR `batch` Bundle (non-atomic)

Phase 7 adds **`Bundle.type === "batch"`** on the same **`POST /fhir`** endpoint used by Phase 6 **`transaction`**.

| Kind | Atomicity | On error |
|------|-----------|----------|
| **`transaction`** | Single DB transaction | Whole request fails (HTTP **400** / **409**) |
| **`batch`** | Each entry commits separately | Failed entries get **`response.outcome`** (**OperationOutcome**); HTTP **200** with **`batch-response`** |

## Auth

Same as **`transaction`**: **API key** only for writes (**SMART JWT → 403**).

## Limits

Same as Phase 6: **`BUNDLE_MAX_ENTRIES`** (**100**) entries.

## CapabilityStatement

**`rest.interaction`** lists **`batch`** alongside **`transaction`** (`GET /fhir/metadata`).

## Audit

- **All successes** → **`outcome: success`**
- **Mixed** → **`partial`**
- **All entries failed** → **`failure`**

## CMD example (`batch`)

One valid **POST Patient** and one deliberate bad entry (unsupported URL):

```bat
curl.exe -s -X POST "http://127.0.0.1:3000/fhir/" ^
  -H "Content-Type: application/fhir+json" ^
  -H "X-Hub-Api-Key: %KEY%" ^
  -d "{\"resourceType\":\"Bundle\",\"type\":\"batch\",\"entry\":[{\"request\":{\"method\":\"POST\",\"url\":\"Patient\"},\"resource\":{\"resourceType\":\"Patient\",\"id\":\"batch-demo-1\",\"name\":[{\"family\":\"Batch\"}]}},{\"request\":{\"method\":\"POST\",\"url\":\"UnsupportedType\"},\"resource\":{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"X\"}]}}]}"
```

Expect **`batch-response`**: first entry **`201`**, second entry **`response.status`** **`400`** + **`outcome`** (**first patient may still persist** — non-atomic).
