# GAP 2 — SMART / OAuth / identity (foundation)

## Signing algorithms

- **`HUB_JWT_SECRET`** (≥32 chars): access tokens and `id_token` use **HS256**. No JWKS endpoint (asymmetric keys required for `jwks_uri` in discovery).
- **`HUB_JWT_PRIVATE_KEY_PEM`** (PKCS#8 PEM): **RS256** for access and ID tokens. Optional **`HUB_JWT_PUBLIC_KEY_PEM`** (SPKI) for verification/JWKS; if omitted, the public key is derived from the private key.
- **`HUB_JWT_KID`**: `kid` in JWT headers and JWKS (change when rotating keys).

Endpoints:

- `GET /.well-known/smart-configuration` — includes **`jwks_uri`** when RS256 is configured.
- `GET /.well-known/openid-configuration` — OIDC metadata.
- `GET /.well-known/jwks.json` — JWK set (**404** if only HS256 is configured).

## PKCE (required)

`/oauth/authorize` **must** include:

- `code_challenge`
- `code_challenge_method=S256`

`/oauth/token` (authorization_code grant) **must** include **`code_verifier`** matching the challenge (RFC 7636).

## Token endpoint

### `grant_type=authorization_code`

- Confidential clients: `client_id` + `client_secret`.
- **Public** clients: `client_id` only (`oauth_client.is_public = true`); PKCE replaces the secret.

Response includes **`refresh_token`** (opaque, ~30-day TTL) and optional **`id_token`** when the authorize `scope` included **`openid`**. With **`fhirUser`**, the ID token includes a `fhirUser` claim (patient URL) when a launch patient is present.

### `grant_type=refresh_token`

- Body: `refresh_token`, `client_id`, and `client_secret` (unless public client).
- **Rotation:** the presented refresh token is revoked and a **new** `refresh_token` is returned (reuse detection via hash).

## SMART scopes (discovery)

Discovery lists read/write variants for Phase 1 resource types, plus `openid`, `profile`, `fhirUser`, `launch/patient`.

## FHIR API — JWT bearer writes

SMART access tokens can **create/update/delete** only via **single-resource** REST paths (`POST /fhir/{type}`, `PUT`/`DELETE /fhir/{type}/{id}`), not via **`POST /fhir`** transaction/batch Bundles (those remain **API-key only**).

Requirements:

- Appropriate **`patient/Resource.write`** (or `*.cruds`-style) scope.
- **Patient compartment:** launch **`patient`** claim must match; resources must reference that patient in `subject` (and Patient id for Patient interactions).

## Database

Apply **`007_gap2_oauth_pkce_refresh.sql`**.

## Not in this slice

Hosted consent UI, multi-tenant OAuth admin UI, ES256, rotating JWKS with multiple active keys, refresh-token reuse anomaly alerting, full SMART-on-FHIR scope certification matrix.
