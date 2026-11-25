# Phase 3 — SMART-style OAuth + scoped FHIR reads

Phase 3 adds confidential OAuth clients, EHR-style **launch context**, authorization code flow, SMART discovery (`.well-known/smart-configuration`), and **JWT bearer access tokens** for read-only FHIR calls scoped to a **patient compartment** (`Patient` + `Observation`).

## Prerequisites

1. Apply migrations through `004_phase3_smart_oauth.sql` (and `005_phase3_demo_client_secret_fix.sql` if you ran `004` before the demo secret hash was corrected).
2. Postgres running with seeded tenant `dev-tenant-001`.
3. Environment variables (see repo root `.env.example`):

   - **`HUB_JWT_SECRET`** — at least **32 characters**. HS256 signing key for access tokens. Without it, `/oauth/authorize` and `/oauth/token` return **503**.
   - **`OIDC_ISSUER`** / **`OIDC_AUDIENCE`** — optional. Defaults: issuer `http://127.0.0.1:<HUB_API_PORT>`, audience `<issuer>/fhir`. These **must match** between JWT validation and how your browser/app calls the hub (avoid mixing `localhost` vs `127.0.0.1` unless you align `OIDC_ISSUER`).

## Demo OAuth client

Migration seeds **`demo-smart-app`** for tenant `dev-tenant-001`:

| Field            | Value                                                |
|-----------------|------------------------------------------------------|
| Client ID       | `demo-smart-app`                                     |
| Client secret   | `demo-smart-secret` (stored as SHA-256 hex)          |
| Redirect URIs   | `http://127.0.0.1:4200/callback`, `http://localhost:4200/callback` |

Change the secret in production; update `oauth_client.client_secret_hash` accordingly.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/.well-known/smart-configuration` | none | SMART discovery (issuer, authorize, token URLs) |
| GET | `/oauth/authorize` | none | OAuth2 `response_type=code`; optional `launch` binds launch context |
| POST | `/oauth/token` | `application/x-www-form-urlencoded` | Exchange `authorization_code` + client credentials for JWT |
| POST | `/internal/v1/smart/launch` | API key | Create launch context; returns `{ "launch": "<uuid>" }` |

FHIR **`/fhir/*`** accepts:

- **API key** — existing behavior (full CRUD).
- **`Authorization: Bearer <jwt>`** — **read-only** (`GET`/`HEAD`). Requires token **`patient`** claim for compartment rules. Supported resource types with JWT: **`Patient`**, **`Observation`** (others return 403).

## Happy-path flow (dev)

1. **Create launch context** (integration / EHR simulator), with your usual API key:

   ```http
   POST /internal/v1/smart/launch
   X-Hub-Api-Key: <DEV_API_KEY or tenant api key>
   Content-Type: application/json

   { "patientId": "<logical Patient id>" }
   ```

   Response: `{ "launch": "..." }`.

2. **Authorize** (browser redirect):

   ```http
   GET /oauth/authorize?response_type=code
     &client_id=demo-smart-app
     &redirect_uri=http://127.0.0.1:4200/callback
     &scope=launch%2Fpatient+patient%2FPatient.rs+patient%2FObservation.rs
     &state=<random>
     &launch=<launch uuid>
   ```

3. **Token** (app backend):

   ```http
   POST /oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=<from redirect>
   &redirect_uri=http://127.0.0.1:4200/callback
   &client_id=demo-smart-app
   &client_secret=demo-smart-secret
   ```

   Response includes `access_token`, `patient`, `scope`, `expires_in`.

4. **FHIR** with JWT:

   ```http
   GET /fhir/Patient/<same patient id>
   Authorization: Bearer <access_token>
   ```

## Scope notes

Scopes are parsed from the `scope` string (space-separated). Patient compartment rules look for SMART-style **`patient/<Resource>.<perm>`** (e.g. `patient/Patient.rs`, `patient/Observation.read`). The hub does not implement the full SMART scope taxonomy; extend `auth/smart-scopes.ts` as needed.

## Security limitations (MVP)

- HS256 symmetric keys only (no JWKS publishing).
- Read-only SMART tokens; writes require an API key.
- Compartment enforcement is implemented for **Patient** and **Observation** only.
