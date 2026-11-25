# Partner API change checklist

Complete before merging changes that affect **HTTP** behavior visible to **partners** (`/fhir`, `/.well-known`, `/oauth`, `/internal/v1/*`).

---

## Documentation & SDK

- [ ] **`docs/openapi/hub-partner-api.yaml`** — paths, schemas, security schemes updated.  
- [ ] **`@fhir-hub/hub-client`** — new methods/types if JSON surface changed (`packages/hub-client/src/index.ts`).  
- [ ] **`npm run build -w @fhir-hub/hub-client`** succeeds.  
- [ ] **Postman** (`postman/`) — update if collection ships example requests for changed routes *(optional if unused)*.

---

## Testing

- [ ] Unit tests cover new logic.  
- [ ] **`npm run test:integration`** extended or still green when DB/FHIR paths change.  
- [ ] **`npm run typecheck`** at repo / workspace scope per CI.

---

## CI & compatibility

- [ ] **`.github/workflows/ci.yml`** — no new required secrets unless documented.  
- [ ] **CapabilityStatement** — if new resource types or search params, **`buildCapabilityStatement`** / metadata reflects behavior *(if applicable)*.

---

## Comms

- [ ] **`docs/templates/RELEASE_NOTES_PRODUCT.md`** stub or full notes for this change.  
- [ ] Customer-facing **deprecation** timeline if behavior breaks older clients.

---

**References:** **`docs/GAP8_PLATFORM.md`**, **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`**.
