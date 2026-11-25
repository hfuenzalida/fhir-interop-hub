# Draft SLA (commercial template)

**Purpose:** Enterprise-ready starting point. Replace placeholders with your measured SLOs, support windows, and legal terms. This is **not** legal advice.

## 1. Service scope

- **Covered service:** FHIR Hub API as deployed for the customer subscription (base URLs, regions, and optional add-ons listed in the order form).
- **Out of scope:** Customer networks, third-party EHRs, client applications, data content accuracy beyond documented validation rules, and issues caused by customer misconfiguration or abuse.

## 2. Availability target

State an **monthly uptime percentage** against a defined measurement window (e.g. excluding scheduled maintenance announced ≥ N days in advance).

**Suggested alignment with in-repo signals:**

- **Synthetic / readiness:** `GET /ready` success rate and latency (database connectivity).
- **Application errors:** Rate of HTTP **5xx** on covered routes vs total requests (from metrics / logs).
- **Dependencies:** Explicit carve-outs for hyperscaler or Postgres outages if not under your control.

## 3. Performance

Optional **latency percentiles** for documented APIs (e.g. FHIR read/write p95 under agreed load tests). Tie targets to **`hub_http_request_duration_seconds`** (by route label) where applicable.

## 4. Support & escalation

Reference **`docs/support/SUPPORT-TIERS.md`** for response-time objectives by severity and escalation path. Attach **redacted** metric snapshots and request IDs — **no PHI** in support bundles unless contractually required and approved.

## 5. Maintenance

- Scheduled maintenance windows (timezone, minimum notice).
- Emergency patches (security) with shortened notice.

## 6. Credits & remedies

Define service credits (if any) as a percentage of monthly fees when availability falls below the stated target, subject to caps and exclusions in the master agreement.

## 7. Measurement & disputes

- **Authority of record:** Your observability backend (e.g. Prometheus retention + alerting history) or mutually agreed status page.
- **Dispute window:** e.g. customer must raise within 30 days of the measured month.

---

**Internal checklist before publishing:** `/ready` runbook, backup/restore tested ( **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`** ), on-call rotation named, incident comms template, and customer-visible status page (if promised). See **`docs/templates/SLO_BUDGET_TABLE.md`** for numeric targets vs **`docs/PROD_PHASE3_RELIABILITY.md`**.
