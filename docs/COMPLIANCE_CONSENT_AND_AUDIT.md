# Consent-backed policy + tamper-evident audit

## FHIR Consent policy (`CONSENT_POLICY_ENABLED`)

When **`CONSENT_POLICY_ENABLED=true`**:

1. The hub loads **active** (`Consent.status = active`) Consent resources for the patient in scope.
2. If **no** active Consents exist → access is allowed (no recorded restriction).
3. If any active Consent declares **`provision.purpose`** codings/text, the request must include a **matching purpose** via compliance metadata — typically header **`X-Purpose-Of-Use`** (or **`PURPOSE_OF_USE_HEADER`**), stored as `request.complianceMeta.purposeOfUse` and on audit events.
4. If any purpose is declared on any active Consent and **none** match the header, the request is denied (**403**) unless **`CONSENT_REQUIRE_PURPOSE_HEADER=false`** (not recommended for production).

**Bootstrap writes:** **POST/PUT** to **`Consent`** do **not** require a prior Consent match (chicken-and-egg). **DELETE** and **clinical** reads/writes still evaluate policy when a patient id applies.

**SMART JWT:** Patient launch context is used as the patient hint for the consent hook. **API key** paths evaluate after resource load when the patient must be derived from the resource (`subject` / `Consent.patient`).

**Bundles:** **POST /** (`transaction` / `batch`) does **not** run per-entry consent evaluation in this slice — enforce at the edge or extend bundle execution if required.

### Phase V / v1 production scope

Treat **Bundle POST without per-entry Consent evaluation** as a **documented product limitation** unless/until you extend bundle execution in code or contractually prohibit multi-patient Bundle writes on **`CONSENT_POLICY_ENABLED`** deployments. Disclose in **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** §Known limitations and in customer **DPA**/technical schedules as needed.

## Audit integrity (`AUDIT_INTEGRITY_ENABLED`)

When **`AUDIT_INTEGRITY_ENABLED=true`** (default) and Postgres is configured:

- Each insert computes **`entry_hash`** = SHA-256 of a canonical JSON payload of the audit event (excluding chain fields).
- **`row_hash`** chains from the tenant’s previous row (see **`audit_chain_head`**), using **HMAC-SHA256** when **`AUDIT_CHAIN_SECRET`** is set, otherwise SHA-256 of `prev|entry`.
- **`chain_prev_id`** references the prior event for that tenant.

### WORM / immutability

Migration **`009_audit_integrity_consent_support.sql`** installs a **BEFORE UPDATE OR DELETE** trigger on **`audit_event`** that rejects mutations. Append remains **INSERT**-only.

### Verification (operators)

To verify a chain offline, replay rows per `tenant_id` in insertion order (e.g. by `timestamp` + `id`), recompute `entry_hash` and `row_hash`, and compare to stored columns. Use the same **`AUDIT_CHAIN_SECRET`** as production if HMAC was enabled.

See also **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** and **`docs/GAP4_COMPLIANCE_AUDIT.md`**.
