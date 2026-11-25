# Phase 5 — Tenant API key lifecycle (internal API)

Operators can **list**, **issue**, and **revoke** integration API keys for their tenant without SQL. Authentication uses the **same mechanism** as `/fhir/*` and `/internal/v1/ingest/*`: **`X-Hub-Api-Key`** or **`Authorization: Bearer`** with an existing valid key — or **`DEV_API_KEY`** for local dev (`DEV_TENANT_ID`).

**Plaintext secrets are shown only once** — on **create**. The hub stores **SHA-256 hex** (`api_key.key_hash`), same as Phase 1 seed keys.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/internal/v1/api-keys` | List keys for the authenticated tenant (**id**, **label**, **created_at** only — no hashes). |
| `POST` | `/internal/v1/api-keys` | Optional JSON `{ "label": "..." }` — creates a key; response includes **`apiKey`** once. |
| `DELETE` | `/internal/v1/api-keys/:keyId` | Revokes a key by UUID (**204**). |

Revoking the key currently used for the request is allowed; the client should switch to another key before deleting the active one.

## CMD examples

Replace `%KEY%` with a valid tenant API key.

**List:**

```bat
curl.exe -s "http://127.0.0.1:3000/internal/v1/api-keys" -H "X-Hub-Api-Key: %KEY%"
```

**Create:**

```bat
curl.exe -s -X POST "http://127.0.0.1:3000/internal/v1/api-keys" ^
  -H "Content-Type: application/json" ^
  -H "X-Hub-Api-Key: %KEY%" ^
  -d "{\"label\":\"clinical-ingest-east\"}"
```

**Revoke:**

```bat
curl.exe -s -w "\nHTTP_CODE:%{http_code}\n" -X DELETE ^
  "http://127.0.0.1:3000/internal/v1/api-keys/PASTE_KEY_UUID_HERE" ^
  -H "X-Hub-Api-Key: %KEY%"
```

## Audit

Creates and deletes append to the audit sink (`Security` entity) consistent with other internal routes.
