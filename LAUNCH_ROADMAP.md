# Launch roadmap — commercial suite by tier

**Purpose:** Define what must be built, packaged, documented, and operationalized for each paid tier (**Launch**, **Scale**, **Enterprise**) before running a market campaign to sell the FHIR interoperability hub.

This document bridges:

- **`PRICING_STRATEGY.md`** — pricing, packaging, overages, and buyer positioning.
- **`ROADMAP_TO_PROD.md`** — production rollout phases.
- **`ROADMAP.md`** — product capability backlog.
- **`docs/PRODUCT_BACKLOG_MATRIX.md`** — revenue lanes mapped to product themes.

The goal is not just to “have code.” The goal is to present a complete, credible **commercial suite**: product surface, onboarding, support, security packet, pricing, sales collateral, and proof that the platform works.

---

## 1. Executive launch strategy

Go to market with **three suites**, each with a clear promise:

| Suite | Promise | Buyer motion |
|-------|---------|--------------|
| **Launch Suite** | “Start selling or piloting with a production-ready FHIR/SMART foundation.” | Founder-led sales, pilot-to-production, early healthtech buyers |
| **Scale Suite** | “Run real production customers with support, compliance artifacts, and repeatable onboarding.” | Sales-led B2B, growth-stage vendors, PHI-handling buyers |
| **Enterprise Suite** | “Procurement-ready interoperability infrastructure with dedicated operations, SLA, and roadmap influence.” | Enterprise sales, health systems, payer/provider platforms, strategic accounts |

Recommended campaign sequence:

1. **Launch Suite first** — fastest to message, easiest to demo, lowest scope risk.
2. **Scale Suite second** — strongest near-term revenue fit for real production customers.
3. **Enterprise Suite third** — larger ACV, but requires more proof, support, security, and contractual maturity.

---

## 2. What “complete suite” means

Each tier needs more than feature flags. A complete suite includes:

| Category | Required assets |
|----------|-----------------|
| **Product** | APIs, auth, tenant model, usage reporting, supported workflows |
| **Operations** | Deployment, monitoring, runbooks, support escalation |
| **Trust** | Security docs, compliance mapping, audit narrative, SLA boundaries |
| **Commercial** | Pricing, overages, implementation scope, contract guardrails |
| **Sales** | Landing page copy, demo script, ICP, objection handling, case-study plan |
| **Customer success** | Onboarding checklist, support handoff, first-value milestone |

If any category is missing, sales will create custom commitments that engineering must later unwind.

---

## 3. Current baseline

The repo already supports a strong base for commercial packaging:

- FHIR R4 JSON API with tenant isolation.
- API keys and SMART/OAuth foundation.
- HL7/FHIR ingestion foundation.
- Audit event capture and optional audit integrity chain.
- Prometheus metering: **`hub_metered_requests_total`**, OAuth token counters, HTTP metrics.
- Tenant usage summary: **`GET /internal/v1/usage/summary`**.
- TypeScript client with **`getUsageSummary(hours?)`**.
- Tenant admin CLI: **`npm run tenant-admin`**.
- OpenAPI, Postman, integration tests, Dockerfile, production rollout docs.
- Commercial templates: pricing, SLA draft, support tiers, onboarding, billing/CRM wiring.

This is enough to sell a carefully scoped **Launch Suite** once campaign collateral and demo flow exist. **Scale** and **Enterprise** require additional operational maturity and, depending on buyer, selected product themes from **`ROADMAP.md`**.

---

## 4. Tier 1 — Launch Suite

### 4.1 Market positioning

**Message:** “FHIR/SMART infrastructure for teams that need to integrate fast without building the interoperability backend themselves.”

**Ideal buyer**

- Early-stage digital health company.
- Small engineering team.
- First production integration or pilot.
- Wants FHIR/SMART + audit + usage reporting.
- Does not need dedicated infrastructure or custom roadmap commitments.

**Primary campaign angle**

> Launch your healthcare integration faster with a production-ready FHIR/SMART hub, tenant isolation, API keys, audit trail, and usage reporting.

### 4.2 Product suite contents

| Area | Must include for campaign |
|------|---------------------------|
| FHIR API | Baseline FHIR resources and search already supported; clear list of supported resources |
| SMART/OAuth | Discovery, token endpoint, OAuth client support |
| API keys | Tenant API key lifecycle and operator-controlled onboarding |
| Usage | **`/internal/v1/usage/summary`**, **`hub_metered_requests_total`** |
| SDK | **`@fhir-hub/hub-client`** examples |
| Audit | Standard audit trail narrative |
| Deployment | Standard container deployment path |

### 4.3 What still needs to be built or finished

| Need | Type | Priority |
|------|------|----------|
| Public “supported API surface” page | Docs / sales | P0 |
| Demo tenant with synthetic data | Product / demo | P0 |
| 10-minute demo script | Sales | P0 |
| Self-contained quickstart for partners | Docs | P0 |
| Example **hub-client** usage guide | Docs / SDK | P1 |
| Simple hosted sandbox option | Product / ops | P1 |
| Usage dashboard screenshot or Grafana example | Sales / ops | P1 |

**Avoid for Launch:** Bulk `$export`, Subscriptions, Binary storage, dedicated deployments, custom security questionnaires, 24×7 support.

### 4.4 Launch Suite campaign assets

Create:

1. **Landing page**
   - Headline: “FHIR/SMART infrastructure for digital health teams.”
   - CTA: “Book an integration assessment.”
   - Proof: “FHIR API, SMART OAuth, audit trail, usage reporting, support runbooks.”

2. **One-page PDF**
   - What it does.
   - Who it is for.
   - What is included.
   - Pricing: “Starts at $4k/month + setup.”

3. **Demo script**
   - `GET /fhir/metadata`
   - Create/read Patient
   - OAuth discovery
   - Usage summary API
   - Metrics / audit narrative

4. **Pilot offer**
   - 60–90 days.
   - $10k–$25k.
   - One tenant, one integration lane.
   - Pilot fee credited to annual contract.

### 4.5 Launch Suite readiness checklist

- [ ] `PRICING_STRATEGY.md` Launch tier approved.
- [ ] Supported resource/API matrix published.
- [ ] Demo data available.
- [ ] Demo script completed.
- [ ] Quickstart tested from clean clone.
- [ ] Tenant onboarding runbook validated.
- [ ] Support response language defined.
- [ ] No Enterprise-only promises in Launch collateral.

---

## 5. Tier 2 — Scale Suite

### 5.1 Market positioning

**Message:** “Production interoperability platform for growing healthcare vendors that need compliance artifacts, repeatable onboarding, and support.”

**Ideal buyer**

- Growth-stage healthtech vendor.
- Handles PHI under BAA.
- Needs multiple environments.
- Has multiple customer integrations.
- Needs security docs, support tiers, usage reporting, and release discipline.

**Primary campaign angle**

> Move from integration project to production interoperability platform: FHIR/SMART, tenant operations, audit, metrics, onboarding, support, and procurement-ready docs.

### 5.2 Product suite contents

| Area | Must include for campaign |
|------|---------------------------|
| Everything in Launch | Required |
| Multi-environment model | Prod + staging + sandbox |
| MPI/data quality | Candidate, score, merge workflows where enabled |
| Compliance docs | HIPAA technical safeguards, DPA checklist, customer security packet |
| Observability | Prometheus scrape guide, alert examples, support log pack |
| Release quality | Release checklist, integration tests, migration smoke |
| Support | Named onboarding owner and priority support |

### 5.3 What still needs to be built or finished

| Need | Type | Priority |
|------|------|----------|
| Standard security packet filled with real deployment details | Trust / sales | P0 |
| Production support queue and escalation path | Ops | P0 |
| Standard onboarding implementation plan | CS / ops | P0 |
| Grafana dashboard or screenshots for RED/USE metrics | Sales / ops | P1 |
| Staging performance evidence using k6 | QA / sales | P1 |
| Customer-facing release notes process | Product | P1 |
| Optional hosted sandbox workflow | Product / CS | P1 |
| Expanded API docs for common production workflows | Docs | P1 |

### 5.4 Product backlog themes for Scale

Prioritize these if Scale buyers ask for more than baseline:

| Theme | Why it matters |
|-------|----------------|
| **Search completeness** | Most production apps need predictable search semantics. |
| **More `_include` / `_revinclude`** | Reduces client round trips and improves SMART app ergonomics. |
| **Additional HL7 v2 profiles** | Many customers still depend on ADT/ORM/SIU beyond ORU. |
| **Binary / DocumentReference** | Common need for real clinical document workflows. |
| **MPI operational polish** | Merge governance and unmerge become important as volume grows. |

Scale should generally **not** include major custom features for free. Use **`docs/templates/PRODUCT_THEME_BRIEF.md`** and acceptance criteria.

### 5.5 Scale Suite campaign assets

Create:

1. **Production readiness guide**
   - Security packet.
   - Support tiers.
   - SLA draft.
   - Observability / incident readiness.

2. **Buyer deck**
   - “Build vs buy” comparison.
   - Integration timeline reduction.
   - Compliance evidence.
   - Usage/metering visibility.

3. **Technical evaluation package**
   - OpenAPI.
   - hub-client examples.
   - Postman collection.
   - Synthetic data.
   - Integration test overview.

4. **Customer success onboarding plan**
   - Week 1: tenant + keys + sandbox.
   - Week 2: FHIR/SMART validation.
   - Week 3: staging workflow.
   - Week 4: production readiness review.

### 5.6 Scale Suite readiness checklist

- [ ] Customer security packet filled.
- [ ] DPA/subprocessor checklist prepared.
- [ ] Support queue live.
- [ ] Alert routing tested.
- [ ] Release checklist adopted.
- [ ] Standard onboarding plan tested with one pilot.
- [ ] Usage reporting can be shown in demo.
- [ ] Pricing/overage model approved.

---

## 6. Tier 3 — Enterprise Suite

### 6.1 Market positioning

**Message:** “Enterprise interoperability infrastructure with dedicated operating model, compliance evidence, SLA, and roadmap partnership.”

**Ideal buyer**

- Health system vendor.
- Payer/provider platform.
- HIE-like organization.
- Enterprise digital health company.
- Customer with strict procurement, data residency, security review, or custom roadmap needs.

**Primary campaign angle**

> A procurement-ready interoperability platform for regulated healthcare enterprises: dedicated deployment options, audit integrity, security packet, SLA, priority support, and contract-driven roadmap delivery.

### 6.2 Product suite contents

| Area | Must include for campaign |
|------|---------------------------|
| Everything in Scale | Required |
| Dedicated deployment option | Private topology / customer-specific environment |
| SLA package | Negotiated SLA with measured SLOs |
| Security review support | Custom questionnaire response workflow |
| Audit integrity operations | Audit verification runbook and evidence |
| Incident process | Incident commander template, log pack, escalation path |
| Roadmap governance | Theme briefs, acceptance criteria, release notes |
| Executive cadence | Quarterly business review / roadmap review |

### 6.3 What still needs to be built or finished

| Need | Type | Priority |
|------|------|----------|
| Dedicated deployment reference architecture | Infrastructure / sales | P0 |
| Filled security packet with architecture diagram | Trust / sales | P0 |
| SLA numbers backed by Phase III/IV evidence | Ops / legal | P0 |
| Custom questionnaire response process | Sales / security | P0 |
| Enterprise onboarding project plan | CS / PM | P0 |
| Roadmap SOW process | Product / legal | P0 |
| Conformance evidence pack | QA / sales | P1 |
| Reference customer or design partner story | GTM | P1 |

### 6.4 Product backlog themes for Enterprise

Enterprise customers are likely to ask for the most expensive roadmap items:

| Theme | Enterprise rationale |
|-------|----------------------|
| **Bulk `$export`** | Analytics, AI pipelines, migration, population health. |
| **Subscriptions** | Event-driven workflows and lower polling costs. |
| **Binary / DocumentReference** | Required for clinical documents and real-world exchange. |
| **Admin OAuth client registry** | Needed when operating many clients across tenants/environments. |
| **Consent UI / admin consent** | Procurement and compliance requirement in some enterprises. |
| **Additional HL7 v2 / CDA** | Legacy health system integration. |
| **Terminology posture** | Required for semantic interoperability and reporting quality. |
| **Unmerge / advanced MPI** | Important for patient identity governance. |

These should be sold as:

- Enterprise add-ons,
- roadmap co-development,
- statement of work,
- or contractual commitments with milestones.

### 6.5 Enterprise Suite campaign assets

Create:

1. **Enterprise security packet**
   - Architecture diagram.
   - HIPAA safeguards mapping.
   - DPA/subprocessor checklist.
   - Audit integrity narrative.
   - Incident response process.

2. **Executive deck**
   - Risk reduction.
   - Integration acceleration.
   - Buy vs build economics.
   - Roadmap partnership.

3. **Technical architecture deck**
   - Deployment topology.
   - Tenant isolation.
   - OAuth/JWKS.
   - Metrics/logs/tracing.
   - Backup/restore.

4. **Procurement package**
   - SLA draft.
   - Support tiers.
   - Pen-test scope.
   - Vendor assessment mapping.
   - Conformance evidence pack.

5. **Enterprise pilot / design partner offer**
   - Paid discovery.
   - Defined roadmap theme.
   - Reference rights or case study discount.

### 6.6 Enterprise Suite readiness checklist

- [ ] Dedicated deployment architecture ready.
- [ ] Security packet complete.
- [ ] DPA/subprocessor register complete.
- [ ] SLA targets backed by evidence.
- [ ] Restore drill documented.
- [ ] Alert routing tested.
- [ ] Release checklist in use.
- [ ] Conformance evidence pack started.
- [ ] SOW process and pricing approved.
- [ ] Executive deck ready.

---

## 7. Cross-tier build roadmap

### Phase A — Campaign foundation (1–2 weeks)

**Goal:** Prepare baseline sales assets and demo for Launch.

Build:

- Landing page copy.
- One-page tier overview.
- Demo script.
- Supported API matrix.
- Pilot offer.
- Launch pricing approved.
- Simple “build vs buy” calculator.

Exit:

- Sales can run a 30-minute discovery call and 15-minute demo without engineering.

### Phase B — Launch Suite GTM (2–4 weeks)

**Goal:** Start outbound/inbound campaign for Launch tier.

Build:

- Demo tenant with synthetic data.
- Quickstart guide.
- hub-client example snippets.
- Usage summary demo.
- Support handoff language.

Exit:

- First 10–20 qualified discovery calls booked.
- At least 3 pilot proposals sent.

### Phase C — Scale Suite readiness (4–8 weeks)

**Goal:** Prepare production buyer motion.

Build:

- Filled customer security packet.
- Support queue and escalation path.
- DPA/subprocessor checklist.
- Grafana dashboard screenshots.
- Release checklist operationalized.
- Onboarding plan and CS playbook.

Exit:

- Can sell to PHI-handling growth customers with credible support/compliance story.

### Phase D — Enterprise Suite readiness (8–16 weeks)

**Goal:** Prepare strategic / procurement-heavy motion.

Build:

- Dedicated deployment architecture.
- SLA appendix with measured SLOs.
- Conformance evidence pack.
- Enterprise procurement deck.
- SOW process.
- First roadmap add-on offer.

Exit:

- Can enter enterprise procurement without promising undefined engineering work.

---

## 8. Campaign structure

### 8.1 Campaign thesis

Healthcare vendors lose months building FHIR/SMART, audit, tenant isolation, and integration operations. This product gives them a ready interoperability foundation with production docs, support model, and usage reporting.

### 8.2 Core messaging pillars

| Pillar | Message |
|--------|---------|
| Speed | Launch FHIR/SMART integrations faster than building from scratch. |
| Trust | Audit, security docs, support tiers, and production runbooks included. |
| Operations | Metrics, usage reporting, tenant onboarding, and incident workflow. |
| Extensibility | Roadmap lanes for export, subscriptions, documents, identity, and MPI. |

### 8.3 Landing page sections

1. Hero: “FHIR/SMART interoperability infrastructure for healthcare software teams.”
2. Pain: “Stop rebuilding auth, audit, tenant isolation, and FHIR plumbing.”
3. Product: FHIR API, SMART/OAuth, ingestion, audit, usage, SDK.
4. Tiers: Launch, Scale, Enterprise.
5. Proof: OpenAPI, usage API, runbooks, security docs.
6. CTA: “Book an integration assessment.”

### 8.4 Outbound email themes

**Email 1 — Speed**

> Your team should not spend months rebuilding FHIR/SMART infrastructure. We provide a production-ready hub with tenant isolation, API keys, SMART/OAuth, audit, and usage reporting.

**Email 2 — Procurement**

> Most interoperability projects stall at security review. This hub includes audit, observability, HIPAA technical safeguards mapping, support tiers, and SLA templates.

**Email 3 — Scale**

> If your healthcare product is adding more customers, integrations, or environments, the hub gives you a repeatable platform instead of one-off integration work.

---

## 9. Required collateral inventory

| Asset | Launch | Scale | Enterprise |
|-------|--------|-------|------------|
| Landing page | Required | Required | Required |
| Pricing one-pager | Required | Required | Required |
| Demo script | Required | Required | Required |
| Quickstart | Required | Required | Required |
| Security packet | Basic | Required | Required + customized |
| SLA draft | Optional | Required | Required + negotiated |
| Support tiers | Basic | Required | Required |
| DPA/subprocessor checklist | Optional | Required | Required |
| Conformance evidence | Optional | Helpful | Required for strong enterprise motion |
| Architecture diagram | Basic | Required | Required |
| Case study | Helpful | Helpful | Strongly recommended |

---

## 10. Product build requirements by suite

### Must be reliable before any campaign

- Demo tenant creation.
- API key issuance / onboarding.
- `/ready` and `/health`.
- `/fhir/metadata`.
- Basic Patient CRUD demo.
- SMART discovery demo.
- Usage summary demo.
- OpenAPI available.
- Support docs available.

### Must be reliable before Scale campaign

- Repeatable staging/prod deployment.
- Metrics scrape and alerting story.
- Restore drill template completed or scheduled.
- Support queue live.
- Security packet draft complete.
- DPA/subprocessor checklist draft complete.
- Release checklist adopted.

### Must be reliable before Enterprise campaign

- Dedicated deployment story.
- SLA numbers backed by evidence.
- Audit integrity verification process.
- On-call alert routing test.
- Enterprise procurement packet.
- Roadmap SOW process.
- Conformance evidence pack started.

---

## 11. Sales qualification and tier routing

| Discovery answer | Route to |
|------------------|----------|
| “We need one integration quickly.” | Launch |
| “We are handling PHI and need security docs.” | Scale |
| “We need multiple environments and priority support.” | Scale |
| “We need dedicated deployment or private networking.” | Enterprise |
| “We need `$export`, Subscriptions, Binary, or custom HL7.” | Enterprise / SOW |
| “We need formal SLA credits.” | Enterprise |
| “We need a pilot before committing.” | Paid pilot, then Launch or Scale |

---

## 12. Objection handling

| Objection | Response |
|-----------|----------|
| “We can build this ourselves.” | Yes, but the hidden cost is FHIR edge cases, OAuth, tenant isolation, audit, usage reporting, support, and security review. This compresses that into a platform. |
| “Is this certified?” | Do not claim certification unless achieved. Say: “We provide conformance evidence packs and can run Inferno/Touchstone in staging as part of evaluation.” |
| “Can you support `$export`?” | It is a roadmap lane. For Enterprise, scope it as a contracted product theme with acceptance criteria. |
| “Can we get a BAA?” | For PHI deployments, use the compliance packet and legal sign-off process. Final BAA is a company/legal artifact. |
| “Do you support our custom HL7 feed?” | Baseline supports specific ingest workflows; custom feeds are scoped under implementation or SOW. |
| “Can we get 24×7 support?” | Available as Enterprise / premium support, tied to on-call and SLA commitments. |

---

## 13. KPIs for the campaign

| Funnel stage | KPI |
|--------------|-----|
| Awareness | Landing page visits, demo video views |
| Interest | Integration assessment bookings |
| Discovery | Qualified opportunities by tier |
| Pilot | Paid pilot conversion rate |
| Sales | ARR pipeline by tier |
| Activation | Days from contract to first successful API call |
| Expansion | Usage growth, additional environments, roadmap add-ons |

Initial targets:

- 30 discovery calls.
- 10 qualified opportunities.
- 3 paid pilots.
- 1 Launch customer.
- 1 Scale customer.
- 1 Enterprise design partner conversation.

---

## 14. Campaign-ready timeline

| Week | Work |
|------|------|
| 1 | Finalize tier one-pager, landing page copy, demo script, supported API matrix |
| 2 | Build demo tenant, record demo, prepare pilot offer |
| 3 | Start Launch campaign, run discovery calls |
| 4 | Publish security packet draft, support tiers, onboarding plan |
| 5–6 | Start Scale campaign to growth-stage vendors |
| 7–8 | Prepare Enterprise packet and architecture deck |
| 9–12 | Enterprise design partner outreach |

---

## 15. Do not sell yet list

Do not sell these as included until scoped and implemented:

- Full Bulk `$export`.
- Production Subscriptions with retry/DLQ.
- Binary object storage and presigned document retrieval.
- Full US Core IG validation.
- Full terminology service.
- Hosted admin UI.
- 24×7 SLA credits.
- Dedicated deployment without pricing uplift.
- Custom HL7 feed support without SOW.

These can be sold as **Enterprise roadmap add-ons** or **paid implementation themes**.

---

## 16. Final suite readiness matrix

| Requirement | Launch | Scale | Enterprise |
|-------------|--------|-------|------------|
| Demo tenant | Must | Must | Must |
| Quickstart | Must | Must | Must |
| Usage reporting | Must | Must | Must |
| Security packet | Basic | Must | Must + custom |
| Support queue | Basic | Must | Must |
| SLA | Limited | Standard | Negotiated |
| Dedicated deployment | No | Add-on | Must support |
| Roadmap add-ons | No | Scoped | Core motion |
| Conformance evidence | Optional | Helpful | Must pursue |
| Billing/CRM integration | Manual ok | Needed | Needed |
| First tenant postmortem | After first | After first | After first |

---

## 17. Immediate action plan

1. Create the **Launch landing page** and one-page PDF from this document.
2. Build a **demo tenant** with synthetic data and a scripted FHIR/SMART/usage walkthrough.
3. Fill the **supported API matrix** so sales knows exactly what is included.
4. Prepare the **Scale security packet** and support queue before selling PHI-heavy accounts.
5. Prepare the **Enterprise architecture deck** before engaging procurement-heavy buyers.
6. Keep all custom requests tied to **`PRODUCT_THEME_BRIEF.md`** and **`PRODUCT_ACCEPTANCE_CRITERIA.md`**.

---

## 18. Repo references

- **`PRICING_STRATEGY.md`** — three-tier pricing.
- **`ROADMAP_TO_PROD.md`** — production rollout.
- **`ROADMAP.md`** — full product roadmap.
- **`docs/PRODUCT_BACKLOG_MATRIX.md`** — revenue lanes and product backlog.
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** — GTM operations.
- **`docs/templates/PRICING_PACKAGING.md`** — packaging template.
- **`docs/runbooks/TENANT_ONBOARDING.md`** — onboarding.
- **`docs/templates/SUPPORT_OPERATIONS_LIVE.md`** — support go-live.
- **`docs/templates/BILLING_CRM_METERING_WIRING.md`** — billing/CRM wiring.
