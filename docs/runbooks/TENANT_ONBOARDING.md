# Runbook — tenant onboarding (contract → production access)

**Audience:** Customer success + platform ops. **PHI:** avoid copying patient data into tickets; use **synthetic** IDs in examples.

---

## 1. Preconditions

- [ ] **Contract** / order form signed (or pilot agreement).  
- [ ] **Environment** named (prod / pilot / sandbox).  
- [ ] **`tenant.data_region`** narrative matches **`DPA_SUBPROCESSORS_CHECKLIST.md`** if applicable.

---

## 2. Provision tenant

1. **Create tenant row** in Postgres (`tenant`, **`external_key`** unique) — use your migration/seed pattern or admin SQL consistent with **`scripts/seed-phase1.mjs`** concepts.  
2. **Issue API key** via **`POST /internal/v1/api-keys`** (partner self-service) **or** insert hashed key via controlled script — never email plaintext keys without secure channel.  
3. **OAuth clients:** insert **`oauth_client`** rows for SMART apps (see **`db/migrations/004_phase3_smart_oauth.sql`** pattern) **or** expose internal tooling — **`npm run tenant-admin -- show --external-key <external_key>`** lists clients (metadata only).

---

## 3. Verify

| Check | Command / action |
|-------|------------------|
| Health | **`GET /ready`** |
| API key | **`GET /fhir/Patient?_count=1`** with Bearer |
| Usage visibility | **`GET /internal/v1/usage/summary`** or **`hub-client.getUsageSummary()`** |
| Discovery | **`GET /.well-known/smart-configuration`** |

---

## 4. Handoff to customer

- Base URLs, **`OIDC_ISSUER`**, JWKS URL.  
- Support channel (**`docs/support/SUPPORT-TIERS.md`** severity definitions).  
- **`docs/templates/SUPPORT_LOG_PACK.md`** when opening incidents.

---

## 5. Operator tooling

```bash
npm run tenant-admin -- list-tenants
npm run tenant-admin -- show --external-key <tenant_external_key>
```

Requires **`DATABASE_URL`** — trusted workstation only (**`docs/GAP10_COMMERCIAL.md`**).

---

## 6. References

- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`**  
- **`docs/templates/PRICING_PACKAGING.md`**
