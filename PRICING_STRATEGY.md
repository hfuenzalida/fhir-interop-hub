# Pricing strategy — FHIR interoperability hub

**Purpose:** A practical three-tier pricing strategy for selling the FHIR interoperability hub as a B2B healthcare infrastructure product. This pricing is designed for **healthtech vendors, digital health companies, HIE-adjacent platforms, care coordination vendors, analytics teams, and provider-adjacent software companies** that need a production-grade FHIR/SMART/HL7 integration layer without building one from scratch.

This is a **starting commercial model**, not legal or financial advice. Validate with discovery calls, pilot conversion rates, gross margin analysis, and the actual cost profile of the deployed cloud stack.

---

## 1. Executive recommendation

Package the product into **three paid tiers**:

| Tier | Target customer | Annual contract value target | Positioning |
|------|-----------------|------------------------------|-------------|
| **Launch** | Early-stage digital health / small integration team | **$36k–$60k ARR** | Get live with a compliant interoperability foundation. |
| **Scale** | Growing vendor with production customers and multiple integrations | **$120k–$180k ARR** | Production FHIR/SMART hub with stronger support, capacity, and onboarding. |
| **Enterprise** | Health system vendor, payer/provider platform, HIE-like buyer, or regulated enterprise | **$300k+ ARR** | Dedicated, procurement-ready interoperability platform with SLAs, security packet, and priority support. |

Recommended list pricing:

| Tier | Platform fee | Annual price | Setup / implementation |
|------|--------------|--------------|------------------------|
| **Launch** | **$4,000 / month** | **$48,000 / year** | **$15,000 one-time** |
| **Scale** | **$12,000 / month** | **$144,000 / year** | **$35,000 one-time** |
| **Enterprise** | **Starts at $30,000 / month** | **Starts at $360,000 / year** | **$75,000+ one-time** |

Sell annual contracts by default. Monthly billing should carry a premium or be limited to pilots.

---

## 2. Pricing philosophy

The product should not be priced like a simple API wrapper. It sits closer to **interoperability infrastructure**:

- It reduces months of engineering work across **FHIR**, **SMART/OAuth**, **HL7 ingestion**, **tenant isolation**, **audit**, **observability**, and **compliance evidence**.
- It gives customers a cleaner procurement story: security docs, SLA template, support tiers, usage reporting, and operational runbooks.
- The cost driver is not only API volume. The real value is **time-to-integration**, **risk reduction**, and **operational readiness**.

Use a **hybrid pricing model**:

1. **Base platform subscription** for access, deployment, support, and included usage.
2. **Implementation fee** for onboarding, tenant setup, security review, and integration support.
3. **Usage overages** for API volume and future heavy data features.
4. **Enterprise add-ons** for dedicated environments, premium support, custom compliance, and data residency.

---

## 3. Three-tier packaging

### Tier 1 — Launch

**Buyer:** Early-stage digital health company, small interoperability team, or pilot customer with one primary integration lane.

**Positioning:** “Get production-ready FHIR infrastructure without hiring an interoperability team.”

**List price:** **$4,000 / month**, billed annually (**$48,000 ARR**)

**Implementation:** **$15,000 one-time**

**Included**

| Category | Included |
|----------|----------|
| Environments | 1 production tenant + 1 sandbox/staging tenant |
| API volume | Up to **2 million metered requests / month** |
| OAuth / SMART | SMART discovery, token endpoint, OAuth client support |
| FHIR | Baseline supported resources and search from current roadmap foundation |
| HL7 / ingest | Basic supported ingest lane where enabled |
| Audit | Audit event capture and tenant usage summary |
| SDK / OpenAPI | Partner OpenAPI + TypeScript hub-client |
| Support | Business-hours email support |
| SLA | Best-effort production target; no custom SLA credits by default |
| Commercial docs | Standard security packet and support tiers |

**Best for**

- First live integration
- Pilot-to-production motion
- Smaller customer with limited API traffic
- Vendor that wants a FHIR/SMART backend but does not yet need dedicated infrastructure

**Limits / fences**

- Shared platform or standard deployment pattern.
- No dedicated environment unless purchased as add-on.
- No custom compliance questionnaire turnaround guarantees.
- No guaranteed engineering escalation outside business hours.

**Overages**

| Meter | Price |
|-------|-------|
| Additional metered API requests | **$400 per 1M requests** |
| Additional sandbox tenant | **$500 / month** |
| Additional OAuth client bundle | **$250 / month per 10 clients** |

---

### Tier 2 — Scale

**Buyer:** Growth-stage healthtech vendor, care coordination platform, API-first healthcare company, or analytics team with multiple customers.

**Positioning:** “Production interoperability platform with support, capacity, and procurement-ready operations.”

**List price:** **$12,000 / month**, billed annually (**$144,000 ARR**)

**Implementation:** **$35,000 one-time**

**Included**

| Category | Included |
|----------|----------|
| Environments | 1 production tenant + 1 staging tenant + 1 sandbox tenant |
| API volume | Up to **10 million metered requests / month** |
| OAuth / SMART | SMART/OAuth support, public/confidential clients, refresh token flows |
| FHIR | Baseline resources, Bundle support, Patient-centric workflows |
| HL7 / ingest | Supported ingestion workflows, synthetic fixture support |
| MPI / data quality | MPI candidate and merge tooling where enabled |
| Audit / compliance | Audit trail, usage summary, HIPAA technical safeguards documentation |
| Observability | Prometheus metrics, RED/USE dashboard guidance, support log pack |
| Support | Business-hours priority support; named onboarding owner |
| SLA | Standard SLA target once Phase III/IV exit criteria are complete |
| Commercial docs | Security packet, DPA/subprocessor checklist templates, release checklist |

**Best for**

- Customer with multiple downstream clients
- Vendor handling production PHI under BAA
- Customer needing procurement artifacts and repeatable support process
- Customer that expects staged releases and some volume growth

**Limits / fences**

- Standard deployment topology.
- Dedicated infrastructure is an add-on unless negotiated.
- Custom feature work scoped separately under a product theme brief.

**Overages**

| Meter | Price |
|-------|-------|
| Additional metered API requests | **$250 per 1M requests** |
| Additional environment / tenant | **$1,000 / month** |
| Additional OAuth client bundle | **$500 / month per 25 clients** |
| Priority implementation hours | **$250 / hour** or prepaid block |

---

### Tier 3 — Enterprise

**Buyer:** Health system vendor, payer/provider platform, enterprise digital health company, HIE-like buyer, or customer with strict security/compliance procurement.

**Positioning:** “Enterprise interoperability infrastructure with dedicated operating model, SLAs, and GTM-grade support.”

**List price:** **Starts at $30,000 / month**, billed annually (**$360,000+ ARR**)

**Implementation:** **Starts at $75,000 one-time**

**Included**

| Category | Included |
|----------|----------|
| Environments | Production + staging + sandbox; dedicated topology available |
| API volume | Up to **50 million metered requests / month** |
| OAuth / SMART | Enterprise OAuth client registry process, key rotation runbooks, security review support |
| FHIR | Contracted resource and workflow scope; roadmap themes prioritized by agreement |
| HL7 / ingest | Integration profile support, additional feed mapping scoped |
| MPI / data quality | Operational MPI workflows and merge governance where contracted |
| Audit / compliance | Audit integrity verification, customer security packet, compliance sign-off templates |
| Observability | Alerting rules, incident workflow templates, log pack process, optional OTEL guidance |
| Support | Priority support, named technical account owner, engineering escalation path |
| SLA | Negotiated SLA with service credits, support response times, incident comms |
| Commercial ops | Tenant onboarding runbook, post-go-live review, quarterly business review |

**Best for**

- Enterprise sales cycle with security questionnaire and legal review
- Dedicated deployment, private networking, or custom data residency
- High volume, high support expectation, or strategic customer
- Customer requesting custom roadmap items such as Bulk `$export`, Subscriptions, Binary storage, or deeper terminology/HL7 support

**Limits / fences**

- Custom engineering is not “included by default.” It is scoped with a product theme brief, acceptance criteria, and timeline.
- Dedicated infrastructure cloud costs can be passed through or priced as a deployment uplift.
- SLA credits require Phase III/IV maturity: restore drills, alerting, paging, and SLO evidence.

**Overages**

| Meter | Price |
|-------|-------|
| Additional metered API requests | **$150 per 1M requests** |
| Dedicated environment uplift | **$5,000–$15,000 / month** |
| Custom compliance / security review package | **$10,000–$25,000 one-time** |
| Custom roadmap implementation | Statement of work or enterprise add-on |

---

## 4. Tier comparison

| Capability | Launch | Scale | Enterprise |
|------------|--------|-------|------------|
| Base annual price | $48k | $144k | $360k+ |
| Setup fee | $15k | $35k | $75k+ |
| Included monthly requests | 2M | 10M | 50M |
| Included environments | Prod + sandbox | Prod + staging + sandbox | Prod + staging + sandbox; dedicated optional |
| Support | Business-hours email | Priority business-hours + named onboarding | Priority + named technical account owner |
| SLA | Best effort / limited | Standard SLA after operational readiness | Negotiated SLA + potential credits |
| Security packet | Standard | Standard + DPA support | Custom questionnaire support |
| Roadmap influence | Low | Medium | High / contracted |
| Best customer size | Early / pilot | Growth / production | Enterprise / strategic |

---

## 5. Usage meters and billing alignment

The repo already exposes the core usage hooks:

| Billing dimension | Technical source | Notes |
|-------------------|------------------|-------|
| API requests | `hub_metered_requests_total` | Labels: `tenant_external_key`, `api_family` |
| OAuth tokens issued | `hub_oauth_tokens_issued_total` | Label: `grant_type` |
| Usage summaries | `GET /internal/v1/usage/summary` | Tenant-scoped audit rollup |
| SDK access | `HubClient.getUsageSummary(hours?)` | Typed usage summary for billing/ops jobs |

Recommended billing policy:

- Bill on **metered API requests** as the primary overage unit.
- Keep OAuth token volume visible but do not charge separately at first unless token storms become a cost driver.
- Treat audit rollups as **reconciliation / customer proof**, not the main usage meter.
- Exclude `_anonymous` traffic from tenant billing unless contract says otherwise.
- Future **Bulk `$export`**, document storage, and object egress should use **infrastructure metrics** and be priced separately.

---

## 6. Add-ons

Use add-ons to protect margin and avoid bloating the core tiers.

| Add-on | Suggested price | Applies to |
|--------|-----------------|------------|
| Dedicated deployment / private topology | $5k–$15k / month | Scale, Enterprise |
| Extra production tenant | $1k–$3k / month | Scale, Enterprise |
| Extra sandbox / staging tenant | $500–$1k / month | All tiers |
| Premium support / 24×7 response | $5k–$15k / month | Enterprise |
| Custom security questionnaire package | $10k–$25k one-time | Enterprise |
| Custom FHIR resource / search expansion | SOW | Scale, Enterprise |
| Bulk `$export` package (future) | $5k–$20k / month + storage/egress | Enterprise |
| Subscriptions / eventing package (future) | $5k–$20k / month + delivery volume | Enterprise |
| Binary / document storage package (future) | Platform fee + storage/egress | Scale, Enterprise |

---

## 7. Implementation fees

Do not waive implementation fees casually. Onboarding healthcare integrations consumes time in:

- Tenant setup and API key/OAuth client provisioning
- Security review and environment configuration
- Testing FHIR, SMART, and ingestion flows
- Partner onboarding and support handoff
- Internal runbook and usage monitoring setup

Recommended implementation scope:

| Tier | Fee | Included implementation support |
|------|-----|---------------------------------|
| Launch | $15k | Standard onboarding, one primary integration lane, basic support handoff |
| Scale | $35k | Multi-environment onboarding, security packet support, staging validation |
| Enterprise | $75k+ | Dedicated project plan, security/procurement support, release readiness, custom topology coordination |

If customer requests custom mappings, new resource support, migrations, or workflow-specific logic, move that to a separate **Statement of Work**.

---

## 8. Discounting strategy

Discounting should trade price for commitment, not just reduce ACV.

| Discount lever | Recommended policy |
|----------------|--------------------|
| Annual prepay | 5%–10% |
| Multi-year | 10% year-1 or price lock, not both |
| Design partner | Up to 25% for explicit case study / feedback / reference rights |
| Pilot | 60–90 days paid pilot; credit pilot fee toward annual contract |
| Startup discount | Time-boxed; step-up pricing after 12 months |
| Strategic enterprise | Discount only with multi-year, expansion rights, or roadmap co-funding |

Avoid discounts that remove overages entirely. Instead, increase included volume for a defined term.

---

## 9. Pilot / proof-of-value model

Offer a paid pilot, not a free trial, because healthcare integration requires active support.

Recommended pilot:

| Item | Recommendation |
|------|----------------|
| Length | 60–90 days |
| Price | $10k–$25k |
| Scope | One tenant, one integration lane, synthetic or limited data |
| Success criteria | FHIR/SMART workflow live in staging, usage reporting visible, security packet reviewed |
| Conversion | Pilot fee credited against annual contract if signed within 30 days |

Pilot should not include custom roadmap development unless separately scoped.

---

## 10. Buyer-specific positioning

### Digital health / care delivery startup

Lead with:

- Faster path to FHIR/SMART readiness
- Lower engineering burden
- Better security/procurement story
- Launch tier with upgrade path to Scale

Avoid leading with:

- Heavy compliance jargon
- Custom enterprise deployment unless needed

### Growth-stage healthtech vendor

Lead with:

- Multi-environment support
- Repeatable tenant onboarding
- Usage visibility
- Roadmap-based expansion for integrations
- Scale tier as default

### Enterprise / health system adjacent buyer

Lead with:

- Security packet
- SLA / support tiers
- Audit integrity and compliance artifacts
- Dedicated deployment and custom roadmap
- Enterprise tier as default

---

## 11. Sales qualification

Use these questions before quoting:

1. What is the primary integration lane: SMART app, API ingestion, HL7, analytics/export, or documents?
2. How many production tenants/customers will run through the hub in year one?
3. Expected monthly API volume?
4. Does the customer require a BAA?
5. Does the customer require dedicated deployment, private networking, or data residency?
6. Are Bulk `$export`, Subscriptions, Binary storage, or additional HL7 message types required at go-live?
7. Does procurement require a formal SLA with service credits?
8. Who owns first-line support: customer team, your team, or shared?

Suggested tier routing:

| Signal | Default tier |
|--------|--------------|
| One integration, early customer, <2M requests/month | Launch |
| Multiple environments, production PHI, 2M–10M requests/month | Scale |
| Security-heavy procurement, dedicated topology, >10M requests/month, roadmap commitments | Enterprise |

---

## 12. Example deal math

### Example A — Early digital health vendor

| Component | Price |
|-----------|-------|
| Launch annual subscription | $48,000 |
| Implementation | $15,000 |
| Year-1 total contract value | **$63,000** |

### Example B — Growth vendor with production PHI

| Component | Price |
|-----------|-------|
| Scale annual subscription | $144,000 |
| Implementation | $35,000 |
| Additional tenant / environment add-ons | $12,000 |
| Year-1 total contract value | **$191,000** |

### Example C — Enterprise strategic customer

| Component | Price |
|-----------|-------|
| Enterprise annual subscription | $360,000 |
| Dedicated deployment uplift | $120,000 |
| Implementation | $75,000 |
| Custom roadmap SOW | $100,000 |
| Year-1 total contract value | **$655,000** |

---

## 13. Margin and cost considerations

Track these monthly:

| Cost driver | Why it matters |
|-------------|----------------|
| Cloud runtime | Hub API replicas, load balancers, managed Postgres |
| Database | Storage, backups, PITR, replicas, IOPS |
| Observability | Metrics cardinality from tenant labels and route histograms |
| Support | L1/L2/engineering time |
| Compliance | Security questionnaires, audits, customer reviews |
| Custom development | Roadmap items can consume margin if bundled for free |

Gross margin target:

- Launch: **70%+** after support and cloud
- Scale: **75%+**
- Enterprise: **70%+**, because support/compliance load is heavier but ACV is higher

If a deal requires dedicated infrastructure, do not absorb cloud costs silently. Use a dedicated deployment uplift or pass-through with management fee.

---

## 14. Contract guardrails

Recommended commercial terms:

- Annual contracts by default.
- Payment annually upfront or quarterly upfront for Enterprise only.
- Overage billed monthly or quarterly in arrears.
- Customer must not send unsupported data classes unless contracted.
- SLA credits capped at a percentage of monthly fees.
- Custom roadmap items require signed theme brief / SOW.
- Production PHI requires completed compliance packet and signed BAA where applicable.
- Support response times tied to purchased tier.

---

## 15. Packaging roadmap

Start with three tiers above. Revisit after first 3–5 customers.

Signals to adjust pricing:

| Signal | Action |
|--------|--------|
| Customers accept quickly without negotiation | Raise list price 10%–20% |
| Implementation work exceeds fee | Increase setup fees or narrow included scope |
| Overages rarely matter | Increase included usage and raise base price |
| Enterprise buyers all demand dedicated deployment | Make dedicated deployment a formal Enterprise package |
| Support load high in Launch | Reduce Launch support or raise Launch price |

---

## 16. Recommended public-facing tier names

Use simple names:

| Internal | Public-facing option |
|----------|----------------------|
| Launch | **Launch** |
| Scale | **Scale** |
| Enterprise | **Enterprise** |

Avoid names like “Basic” or “Starter” if selling into healthcare procurement. Buyers do not want to feel they are buying the unsafe version.

---

## 17. Immediate next steps

1. Copy the core tier table into **`docs/templates/PRICING_PACKAGING.md`** when ready to formalize.
2. Fill **`docs/templates/BILLING_CRM_METERING_WIRING.md`** with the selected billing/CRM stack.
3. Define standard pilot language.
4. Decide whether **Launch** is available publicly or only via sales qualification.
5. Set the first-quarter target: at least **one Launch**, **one Scale**, and **one Enterprise design partner** conversation.

---

## 18. References in this repo

- **`docs/GAP10_COMMERCIAL.md`** — metering, usage summary, tenant admin, SLA/support.
- **`docs/PROD_PHASE8_COMMERCIAL_LAUNCH.md`** — Phase VIII GTM operations.
- **`docs/templates/PRICING_PACKAGING.md`** — shorter pricing template.
- **`docs/templates/BILLING_CRM_METERING_WIRING.md`** — billing/CRM integration patterns.
- **`docs/support/SUPPORT-TIERS.md`** — support tiers.
- **`docs/templates/SLA-draft.md`** — SLA draft.
- **`ROADMAP.md`** §10 — Commercial & GTM enablers.
