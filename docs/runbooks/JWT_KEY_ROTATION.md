# Runbook — JWT / JWKS key rotation (RS256)

Applies when **`HUB_JWT_PRIVATE_KEY_PEM`** is set (RS256 access tokens + **`/.well-known/jwks.json`**). HS256-only deployments should rotate **`HUB_JWT_SECRET`** via env rollout instead.

## Preconditions

- **Backup** current PEMs and **`HUB_JWT_KID`** (secret store history).  
- Confirm **`OIDC_ISSUER`** matches the URL clients use for discovery and token **`iss`**.

## Rotation strategy (overlap window)

1. **Generate** a new RSA key pair (PKCS#8 private PEM). Assign a **new** **`HUB_JWT_KID`** (e.g. `hub-2026-04-b`).  
2. **Publish multi-key JWKS** — *the hub currently serves keys derived from the configured private PEM.* To rotate without downtime you need either:
   - **Dual-key deploy:** extend the application to load **two** private keys and emit **both** `keys[]` entries in JWKS until validators cache expiry passes (follow-up engineering if not yet implemented), **or**  
   - **Short overlap:** deploy new PEM + `kid`, accept that existing access tokens signed with the old key may fail until clients refresh (acceptable if token TTL is minutes).  
3. **Deploy** new env: **`HUB_JWT_PRIVATE_KEY_PEM`**, **`HUB_JWT_KID`**, optional **`HUB_JWT_PUBLIC_KEY_PEM`** if you publish public-only elsewhere.  
4. **Verify:** `GET /.well-known/jwks.json` shows the new `kid`; obtain a token from **`POST /oauth/token`** and validate **`kid`** in the JWT header.  
5. **Deprecate** old key after all tokens issued under it have expired + JWKS cache TTL for relying parties.

## HS256 fallback

If **`HUB_JWT_SECRET`** is used (no PEM), rotation is **replace secret + rolling restart**; invalidate all outstanding access tokens.

## References

- **`docs/GAP2_SMART_OAUTH.md`**  
- **`.env.example`** — `HUB_JWT_*` variables
