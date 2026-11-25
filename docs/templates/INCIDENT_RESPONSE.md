# Incident response (template)

Align severities with **`docs/support/SUPPORT-TIERS.md`**. Replace bracketed fields with your org’s tools (Slack, PagerDuty, Jira, status page).

## 1. Roles

| Role | Responsibility |
|------|------------------|
| **Incident commander** | Drives timeline, comms, escalate / resolve. |
| **Tech lead (hub)** | Triage app/DB/OAuth; pulls runbooks. |
| **Comms** | Customer updates (if external impact). |

## 2. Severity mapping (example)

| Sev | Customer impact | Example |
|-----|-----------------|--------|
| **SEV1** | Hub unavailable or PHI path broken for many tenants | DB down, all 5xx |
| **SEV2** | Major degradation | OAuth broken, one region down |
| **SEV3** | Minor / subset | Elevated latency, single-tenant issue |
| **SEV4** | No user impact yet | Early warning from alerts |

## 3. Workflow

1. **Detect** — Alert, customer ticket, or synthetic check.  
2. **Acknowledge** — Owner assigns commander within **[target minutes per SUPPORT-TIERS]**.  
3. **Triage** — **`docs/RUNBOOKS.md`**, **`x-request-id`** / **`correlationId`** from logs; metrics (**`hub_*`**).  
4. **Mitigate** — Roll back deploy, scale, failover DB, rate-limit abuse — **no PHI in ticket bodies**.  
5. **Resolve** — Restore SLO; confirm with **`GET /ready`** and error-rate dashboards.  
6. **Post-incident** — Blameless notes within **[72h]**; actions tracked.

## 4. Customer communication (external)

- First update within **[SLA window]**.  
- Include **impact**, **workaround** (if any), **next update time**.  
- **No** internal hostnames, stack traces with secrets, or patient identifiers.

## 5. References

- **`docs/PROD_PHASE4_OBSERVABILITY.md`**  
- **`docs/templates/ON_CALL_ALERT_ROUTING_TEST.md`**
