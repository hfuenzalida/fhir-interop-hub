Here is a phased build roadmap tuned to your FHIR hub + SMART apps beachhead and US v1: (g)(10)‑style APIs + EHI export posture + ONC‑style audit—ordered so you can start coding without boiling the ocean.

Phase 0 — Foundations (2–6 weeks)
Goal: Repo, environments, compliance posture, and non‑negotiable patterns before feature work piles up.

Architecture: Hub vs app repos (or monorepo packages), environments (dev/stage/prod), secrets, config.
Security baseline: TLS, encryption at rest, vulnerability scanning, dependency policy.
Identity sketch: OAuth2/OIDC provider choice (e.g. Keycloak/Cognito/Auth0 + custom claims strategy); roles (system, org admin, clinician, patient) as placeholders.
Audit strategy: Append‑only audit log schema and event taxonomy (who/what/when/patient context, API operation)—implement logging early, not after.
IG target list: Lock FHIR version (R4 typical) + US Core (and any narrower IG for your first use case).
Exit: Deployed “hello” services, audit events on synthetic calls, threat model v0, written scope for v1 (“hub + SMART; not a full EHR”).

Phase 1 — FHIR hub MVP (“read path”)
Goal: One place that stores FHIR and serves authorized REST—the spine everything else hangs on.

FHIR server: CRUD + search on US Core–relevant resources first (Patient, Observation, Condition, MedicationStatement, DocumentReference, Encounter, etc.—trim to your first app).
Multi‑tenancy: Org/tenant isolation (DB + API + authz).
Basic admin: API keys or service accounts for backend jobs; org onboarding model.
Observability: Metrics, traces, structured logs per tenant and per interface.
Exit: Postman/automated tests against /Patient, /Observation, … with tenant isolation; SLO draft for API latency.

Phase 2 — Ingestion & normalization (“connect path”)
Goal: Get real data in from at least one class of source, normalized to your FHIR profiles.

First connector: Pick one realistic path (e.g. FHIR bulk from a test EHR, HL7 v2 ADT/ORU via MLLP, or file drop) — one vertical slice beats five stubs.
Mapping layer: Versioned mapping specs, validation on write, dead‑letter/replay for failures.
Patient / encounter linking: MPI‑lite rules (identifiers, deterministic matching) — document limits.
Terminology hooks: Code system binding + validation for coded fields you care about first.
Exit: End‑to‑end: source → normalized FHIR → queryable in hub; dashboard for interface error rate and message success rate (feeds your KPIs).

Phase 3 — SMART on FHIR platform (“app path”)
Goal: Apps can launch in context and call your hub with SMART‑style scopes.

Authorization server: SMART‑compatible scopes (patient/.read, user/.read, etc.—match your first app); launch context (patient, encounter, user).
EHR launch + standalone: At least standalone + one simulated EHR launch for dev; plan Epic/Oracle test tenants for later.
Developer experience: App registration (client id, redirect URIs), docs, example SMART app.
Exit: Demo SMART app reads hub FHIR for a launched patient; token audit shows patient‑scoped access.

Phase 4 — First SMART app (thin, measurable)
Goal: Prove workflow + metrics, not feature breadth.

Pick one high‑value workflow (e.g. visit summary, PRO capture, specialty dashboard, light CDS surface).
Instrumentation: Time on task, clicks, errors (your product KPIs).
Alert policy: If the app emits alerts, count volume and overrides from day one.
Exit: Pilot‑ready app with baseline vs post metrics story; clear safety scope in UX copy (“supports review; ordering stays in source EHR” if true).

Phase 5 — (g)(10) alignment & export posture (parallel track from Phase 3–4)
Goal: Move from “FHIR‑ish” to testable alignment with standardized API expectations—not a last‑minute audit.

API surface: Document resource types, search params, Bulk FHIR ($export) where in scope, patient‑level access patterns.
Patient authorization: Flows for patient access to their data (app or backend)—map to your product story.
Conformance: Automated runs: validator + US Core + any test kit you adopt (e.g. Inferno-style checks as applicable); track pass rate as a KPI.
EHI export: Define what “export” means in your product (scope, format, frequency, performance)—implement incrementally.
Exit: Conformance report artifact per release; known gaps documented with dates.

Phase 6 — Production hardening & integration scale
Goal: ≥99.9% API SLO story, integration OpEx under control.

SRE: HA, backups, DR drill, rate limits, quotas (feeds org + usage pricing).
Integration factory: Repeatable playbooks, estimation templates, monitoring per customer interface (your commercial model).
Support: On-call, status page, customer-facing runbooks for interface failures.
Exit: Production checklist; per‑tenant health dashboard; incident response runbook.

Phase 7 — Portfolio & platform (optional, post‑traction)
Goal: Second/third apps, app marketplace light, partner SDKs, deeper payer/HIE connectors—after one app + hub is referenceable.

How to run it in practice
Parallel tracks: “Hub + ingest” (Phases 1–2) and “SMART + first app” (3–4) can overlap once Phase 1 is stable; (g)(10) / export (5) should start as soon as your external API shape stabilizes, not at the end.
First connector choice: Optimize for fast path to a pilot hospital’s reality (often one of: existing FHIR API, major interface engine, or your first design partner’s stack).
If you tell me your first clinical workflow (one sentence) and first data source (Epic FHIR vs HL7 v2 vs CSV), I can reorder Phases 2–4 into a week‑by‑week slice for the next 90 days only.

