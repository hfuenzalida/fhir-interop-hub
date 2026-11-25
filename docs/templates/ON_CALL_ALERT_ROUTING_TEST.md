# On-call alert routing test (Phase IV exit criterion)

**Goal:** Prove that **alerts reach the on-call rotation** (SMS/push/call) before relying on them for production.

**Frequency:** After initial routing setup; again when routes, schedules, or integrations change.

## Preconditions

- [ ] Alertmanager (or cloud equivalent) routes **`severity: critical`** to PagerDuty/Opsgenie/Slack phone bridge as designed.  
- [ ] **Non-prod** or **approved maintenance window** if the test could cause noise.

## Procedure A — Synthetic metric (preferred)

1. In **staging**, temporarily lower an alert threshold in **`docs/prometheus/prometheus-alert-rules.example.yml`** (e.g. **`HubApiHigh5xxRate`** to fire on minimal traffic) **or** inject a recording rule that evaluates true.  
2. Confirm **alert fires** in Prometheus UI / Grafana.  
3. Confirm **notification** arrives at the on-call destination within **[target minutes]**.  
4. **Silence** or revert threshold; document ticket ID.

## Procedure B — Controlled failure (staging)

1. Scale hub deployment to **0** replicas **or** block **`DATABASE_URL`** with a network policy (staging only).  
2. Expect **`GET /ready`** failures and/or **`up`/scrape** alerts depending on your rules.  
3. Verify **page** delivered.  
4. Restore service; verify recovery alerts clear.

## Sign-off

| Field | Value |
|-------|--------|
| Date | |
| Method | A / B |
| Alert name | |
| Time to page | |
| Issues | |
| Owner | |

---

**Reference:** **`docs/PROD_PHASE4_OBSERVABILITY.md`**.
