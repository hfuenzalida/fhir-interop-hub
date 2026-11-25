# Phase V — Compliance & customer trust (delivered artifacts)

Implements **Phase V** in **`ROADMAP_TO_PROD.md`**: procurement-friendly **documentation** and **runbooks** for PHI-adjacent deployments. **BAAs, signed DPAs, and legal review** stay with your organization — this repo provides **structured templates** and **control traceability**.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`** (this file) | Phase V index and exit criteria. |
| **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** | Customer-facing **security packet** outline (architecture, controls, incidents). |
| **`docs/templates/DPA_SUBPROCESSORS_CHECKLIST.md`** | DPA + subprocessor + residency checklist. |
| **`docs/templates/COMPLIANCE_V1_SIGNOFF.md`** | **Legal / compliance** sign-off for v1 scope. |
| **`docs/templates/INTERNAL_ACCESS_POLICY.md`** | **Internal** access to DB, audit, and break-glass. |
| **`docs/templates/BREAK_GLASS_AND_PURPOSE_OF_USE.md`** | Optional break-glass & purpose-of-use operating procedures. |
| **`docs/runbooks/AUDIT_INTEGRITY_VERIFICATION.md`** | Operational verification of **audit hash chain** / WORM. |
| **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** | Updated — **Phase V deployment attestation** subsection (fill per environment). |
| **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** | Updated — explicit **v1 scope** note on **Bundle POST** + consent. |

**Existing anchors:** **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`**, **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**, **`docs/VENDOR_ASSESSMENT_MAPPING.md`**, **`docs/support/SUPPORT-TIERS.md`**.

---

## 2. v1 scope decisions (document, don’t imply code guarantees)

| Topic | Default stance (customize in charter) |
|-------|----------------------------------------|
| **Bundle POST + Consent** | **`POST /fhir`** transaction/batch **does not** run per-entry Consent evaluation — see **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**. For v1, **exclude** bulk Bundle consent enforcement **or** gate Bundles at the edge until extended in code. |
| **`tenant.data_region`** | Metadata only — **does not** enforce routing; align ops + legal narrative per **`DPA_SUBPROCESSORS_CHECKLIST.md`**. |
| **Break-glass / purpose-of-use** | Headers + audit fields exist — operational approval workflow in **`BREAK_GLASS_AND_PURPOSE_OF_USE.md`**. |

---

## 3. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | Deliverable |
|-----------|-------------|
| **Security packet** for customers | Fill **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** + attach architecture diagram + **`docs/VENDOR_ASSESSMENT_MAPPING.md`**. |
| **Legal / compliance sign-off** for v1 | **`docs/templates/COMPLIANCE_V1_SIGNOFF.md`** completed. |

---

## 4. References

- **`docs/PROD_PHASE0_CHARTER.md`** — ICP and regulatory posture.  
- **`docs/PROD_PHASE2_SECURITY.md`** — production guardrails.  
- **`docs/PROD_PHASE4_OBSERVABILITY.md`** — logging without PHI.  
- **`ROADMAP.md`** §4 — full compliance backlog.
