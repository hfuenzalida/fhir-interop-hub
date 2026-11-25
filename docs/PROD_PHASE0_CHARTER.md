# Program charter — production v1 scope freeze (Phase 0)

**Document type:** Phase 0 deliverable per **`ROADMAP_TO_PROD.md`**.  
**Status:** Template — replace bracketed fields, assign owners, and record **sign-off** before Phase I (pipeline) work is treated as “in scope for v1.”

| Field | Value |
|-------|--------|
| **Version** | 0.1 (draft) |
| **Last updated** | *YYYY-MM-DD* |
| **Review cadence** | At each major scope change or quarterly |

---

## 1. Purpose

Freeze **what “production v1” means** for this program so engineering, security, GTM, and customers share one definition: regions, PHI handling, primary integration lane, and **SLO** numbers that downstream documents (**`docs/templates/SLA-draft.md`**, support tiers) can reference.

---

## 2. Product definition for v1

**One-sentence v1:** *[FILL — e.g. “A multi-tenant FHIR R4 API with SMART OAuth and API-key access, backed by Postgres, for [buyer type] in [region], with [primary workflow].”]*

### 2.1 Ideal customer profile (ICP)

| | Primary ICP | Secondary (v1 or later) |
|---|-------------|-------------------------|
| **Segment** | *[FILL — e.g. digital health / HIE / health system ISV]* | *[FILL]* |
| **Primary integration lane** | *[Pick one north star: SMART-heavy; API-key + ingest; bulk/export-led; or hybrid — describe]* | |
| **Buyer** | *[FILL — e.g. CTO, VP Interop, CIO]* | |
| **User** | *[FILL — e.g. app developers, integration engineers]* | |

**Minimum lovable surface (MLP)** — the smallest product that wins the ICP for v1:

- *[FILL — e.g. “SMART + US Core–lite validation + Patient compartment reads/writes; ORU ingest; no $export in v1.”]*

### 2.2 In scope for v1 go-live (check all that apply)

Use this list as the **scope freeze**; uncheck = explicit deferral to post-v1 unless the charter is revised.

| Area | In v1? | Notes |
|------|--------|--------|
| **Regions / data residency** | ☐ | Single region: *[e.g. `us-east-1`]*. Multi-region: *[yes/no; if yes, list]*. |
| **PHI in hub** | ☐ | *Yes = HIPAA path required. No = still document security baseline.* |
| **FHIR API** (`/fhir`) | ☐ | Resource types per **`ROADMAP.md`** / Phase 1 allowlist. |
| **SMART / OAuth** (`/.well-known`, `/oauth`) | ☐ | RS256/JWKS assumed if SMART in scope. |
| **API-key-only workloads** (ingest, partner APIs) | ☐ | |
| **HL7 v2 ingestion** | ☐ | Message types: *[e.g. ORU only]* |
| **Internal partner APIs** (`/internal/v1/*`) | ☐ | |
| **MPI / merge** | ☐ | *[operator-led vs self-service]* |
| **Bulk `$export`** | ☐ | Usually **post-v1** unless contractually required — mark. |
| **Subscriptions** | ☐ | Usually **post-v1** unless required — mark. |
| **Binary / clinical documents** | ☐ | |
| **Hosted admin UI** for tenants | ☐ | **Out** is fine; CLI/ops per **`docs/GAP10_COMMERCIAL.md`**. |

### 2.3 Out of scope for v1 (explicit)

List here to prevent scope creep; link to **`ROADMAP.md`** for the full future backlog.

| Item | Notes |
|------|--------|
| *[e.g. Touchstone certification as release gate (optional)]* | |
| *[e.g. CDA conversion]* | |
| *[e.g. full US Core IG validation]* | *“US Core–lite in repo; full IG TBD”* |
| *[add rows]* | |

---

## 3. Regulatory & trust posture

| Topic | Decision for v1 | Pointer |
|-------|-----------------|---------|
| **HIPAA** | ☐ BAA offered to customers / ☐ N/A (no PHI) | Map controls to **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`**. |
| **Data residency** | Primary: *[region]*. **Cross-border:** *[forbidden / allowed with DPA / TBD]* | `tenant.data_region` in DB is not a full legal story by itself. |
| **Subprocessors** | *[List: cloud, DB, logging vendor, support tools]* | Update customer DPA annex when changed. |
| **Consent / secondary use** | *[Purpose-of-use / Consent policy for v1]* | **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`** |

---

## 4. Service level objectives (SLOs) — freeze for SLA drafting

These numbers feed **`docs/templates/SLA-draft.md`** and customer negotiations. They are **targets**, not guarantees until measurement exists.

### 4.1 Availability

| Metric | v1 SLO target | Measurement (in-repo / ops) | Maintenance carve-out |
|--------|---------------|----------------------------|------------------------|
| **API monthly uptime** | *[e.g. 99.5% or 99.9%]* | *e.g. LB + `5xx` / total on `/fhir` and `/oauth` (exclude client errors)* | *e.g. ≤ 4h/mo announced ≥ 7 days* |

**Out of scope for this SLO (list):** *[e.g. customer network, EHR downtime, public cloud global outage — align with SLA §1–2].*

### 4.2 Latency (under agreed load)

| Path / surface | p95 target (TBD) | Notes |
|----------------|------------------|--------|
| `GET /ready` / health | *e.g. < 500ms* | Synthetic or LB check. |
| `GET /fhir/metadata` | *e.g. < 2s* | Cached in app; see **`docs/GAP5_RELIABILITY.md`**. |
| `GET/POST` representative FHIR | *e.g. p95 < 1.5s* | Define test mix. |
| `POST /oauth/token` | *e.g. p95 < 800ms* | |

### 4.3 Recovery (for internal planning; may appear in DR addendum, not every SLA)

| | Target |
|---|--------|
| **RPO** (max data loss) | *[e.g. ≤ 5 min with PITR]* |
| **RTO** (time to restore service) | *[e.g. ≤ 4 h]* |

---

## 5. Named owners (exit criterion)

Assign people; use email or org directory link. “Deputy” optional for coverage.

| Role | Responsibility | Owner | Deputy |
|------|----------------|-------|--------|
| **Security** | Threat model, pen test, access policy, security questionnaire | *[Name]* | |
| **Operations / SRE** | Uptime, backups, incident response, on-call | *[Name]* | |
| **Customer onboarding** | Tenant provisioning, keys, first integration, comms | *[Name]* | |

**Product / program (optional but recommended):** *[Name]* — scope change control and ICP alignment.

---

## 6. Approvals (sign-off)

| Stakeholder | Role | Date | Signature / initial |
|-------------|------|------|----------------------|
| *[Name]* | Product / GM | | |
| *[Name]* | Engineering | | |
| *[Name]* | Security / GRC | | |
| *[Name]* | Legal (if PHI) | | |

---

## 7. Change control

- **Minor** (wording, owners): update this document and version table.  
- **Major** (ICP, regions, PHI posture, SLO numbers): re-approve; reassess Phase I+ work and **`ROADMAP.md`** priorities.

---

## 8. References

- **`ROADMAP.md`** — full capability matrix.  
- **`ROADMAP_TO_PROD.md`** — phased rollout.  
- **`docs/templates/SLA-draft.md`** — customer SLA template.  
- **`docs/support/SUPPORT-TIERS.md`** — support & escalation.  
- **`docs/GAP10_COMMERCIAL.md`** — metering and usage surfaces.  
- **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`** — procurement templates after Phase 0 freeze (when PHI / HIPAA path).  
- **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`** — prioritize **`ROADMAP.md`** work after scope freeze (revenue lanes).  
- **`docs/PROD_PHASE7_QUALITY.md`** — release checklist and conformance evidence before major launches.  
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** — GTM, onboarding, support when selling the hub.
