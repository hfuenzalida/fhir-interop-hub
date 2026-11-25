# Compliance scope — v1 (US-centric, hub + SMART)

## Product boundary

- **In scope:** FHIR interoperability hub (ingest, normalize, store, API) and SMART on FHIR applications that run inside or alongside certified EHRs.
- **Out of scope for v1:** Full EHR certification (inpatient CPOE, complete CDS, billing modules, etc.). The **system of record** for clinical documentation remains the customer’s certified EHR unless and until you explicitly expand scope.

## Regulatory alignment (design targets)

- **ONC §170.315(g)(10)** — Standardized API for patient and population services: design REST FHIR APIs, authorization, and **Bulk FHIR** export paths toward program-specific test procedures as they apply to your product category.
- **21st Century Cures Act / information blocking** — Patient access, EHI export expectations: plan **single-patient** and **population-level** export semantics and performance; document known gaps during early phases.
- **Audit** — ONC-style **attestable** audit trail for API and data access: who, what, when, patient context (where applicable), outcome.

## Claims discipline

- Market as **aligned with** API/export/audit **expectations** for use **with** certified EHRs; avoid implying your hub alone is “ONC certified” unless you complete the applicable certification program for that product.

## Later expansion

- Full ONC Health IT Module certification and/or **EU EHDS / EEHRxF** — separate program with additional IGs, logging, and jurisdictional requirements.
