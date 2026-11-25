# Customer security packet (template)

Use as the **table of contents** for RFP / vendor assessments. Replace `[Company]` and `[Product]`; attach diagrams as PDF or links (not committed to this repo with customer data).

**Confidentiality:** Mark **Confidential** per your policy.

---

## 1. Executive summary

- **Product:** `[Product]` — FHIR R4 hub API ( **[describe tenant model]** ).  
- **PHI handling:** `[Yes / Limited / No]` — data classes processed.  
- **Hosting:** `[Cloud provider / region(s)]` — high-level only.

---

## 2. Architecture

- **Diagram:** *[Attach — trust boundaries: Internet → TLS termination → hub-api → Postgres; observability path.]*  
- **Alignment:** **`deploy/README.md`** internal checklist; **`docs/THREAT_MODEL_V0.md`**.

---

## 3. Technical controls (summary)

| Domain | Summary | Evidence pointers |
|--------|---------|-------------------|
| **Access control** | API keys, OAuth 2 / SMART, JWT scopes | **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** §312(a)(1), **`docs/GAP2_SMART_OAUTH.md`** |
| **Audit** | Append-only `audit_event`, optional hash chain | **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**, **`docs/runbooks/AUDIT_INTEGRITY_VERIFICATION.md`** |
| **Transmission** | TLS at edge | **`deploy/README.md`**, HIPAA §312(e) mapping |
| **Authentication** | API key hash at rest; OAuth | **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** §312(c)(1) |
| **Logging / PHI** | Redacted headers; structured logs | **`docs/GAP3_SECURITY.md`**, **`docs/templates/LOG_SHIPPING_CHECKLIST.md`** |
| **Encryption at rest** | Managed DB / volume encryption | *Provider documentation — attach.* |

Full questionnaire-style mapping: **`docs/VENDOR_ASSESSMENT_MAPPING.md`**.

---

## 4. Operational practices

| Topic | Reference |
|-------|-----------|
| **Incidents** | **`docs/templates/INCIDENT_RESPONSE.md`**, **`docs/support/SUPPORT-TIERS.md`** |
| **Backups / DR** | **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**, **`docs/PROD_PHASE3_RELIABILITY.md`** |
| **Observability** | **`docs/PROD_PHASE4_OBSERVABILITY.md`** |
| **Internal access** | **`docs/templates/INTERNAL_ACCESS_POLICY.md`** |

---

## 5. Subprocessors & residency

- **`docs/templates/DPA_SUBPROCESSORS_CHECKLIST.md`** — fill subprocessor table and **`tenant.data_region`** narrative.

---

## 6. Known limitations (honesty for procurement)

- **Consent on Bundles:** **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** — document whether v1 allows Bundle POST for multi-patient workflows or restricts them contractually.  
- **IG validation:** US Core–lite vs full IG — **`ROADMAP.md`** §1.

---

## 7. Version

| Version | Date | Owner |
|---------|------|--------|
| 0.1 | | |
