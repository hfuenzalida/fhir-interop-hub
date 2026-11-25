# Chaos & failure drills (non-production only)

**Phase VII optional work** — run in **staging** or **disposable** environments. **Never** inject faults against production PHI without explicit governance.

---

## 1. Preconditions

- [ ] **Change window** or internal drill ticket.  
- [ ] **On-call** notified (even for staging) if alerts may fire.  
- [ ] **Rollback** / restore path known (**`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**).

---

## 2. Drill catalog

| Drill | Procedure | Success signal |
|-------|-----------|----------------|
| **DB unavailable** | Stop Postgres container / block SG to DB | **`GET /ready`** → **503**; recover when DB returns |
| **DB failover** | Trigger managed failover (provider) | App reconnects; **`/ready`** healthy after pool reconnect |
| **Slow Postgres** | Latency injection (toxiproxy / tc) | Elevated **`hub_http_request_duration_seconds`**; no silent hangs |
| **OAuth clock skew** | Advance **NTP** skew on client **or** token **`iat`** boundary tests | **`invalid_grant`** / **401** as expected; docs updated |
| **Single hub pod kill** | Delete pod / task | LB routes; no sticky-session dependency |

---

## 3. Record results

| Date | Drill | Environment | Outcome | Follow-up ticket |
|------|-------|-------------|---------|------------------|
| | | | | |

---

## 4. References

- **`docs/PROD_PHASE7_QUALITY.md`**  
- **`docs/RUNBOOKS.md`**  
- **`docs/PROD_PHASE4_OBSERVABILITY.md`**
