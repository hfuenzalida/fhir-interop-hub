# Internal access policy (template)

Defines **who** may access **production** databases, audit exports, and administrative interfaces for **`[Company]`** operating the hub.

---

## 1. Principles

- **Least privilege** — grant minimum role duration needed.  
- **No PHI in tickets** — use **request IDs**, tenant **external keys** only when necessary.  
- **Break-glass** — extraordinary access requires **approval + audit trail** (ticket + time-bound).

---

## 2. Roles

| Role | May access | Approval |
|------|------------|----------|
| **DBA** | Postgres (read/write per runbook) | *[Manager]* |
| **SRE / On-call** | Logs, metrics, **read-only** DB for diagnosis | *[Pager duty policy]* |
| **Security** | Audit samples for investigations | *[CISO delegate]* |
| **Support L2** | Tenant metadata via **`tenant-admin`** (no secrets) | *[Defined]* |

---

## 3. Technical paths

- **Database:** `[VPN / bastion / SSO to RDS]` — no direct internet exposure of Postgres.  
- **Secrets:** `[Vault / cloud SM]` — no sharing PEMs in chat.  
- **Audit:** Read **`audit_event`** only through approved tools; exports **encrypted at rest**, **need-to-know**.

---

## 4. Review

- **Quarterly:** Access reviews for prod DB roles.  
- **After incident:** Confirm temporary grants revoked.

---

## 5. References

- **`docs/runbooks/AUDIT_INTEGRITY_VERIFICATION.md`**  
- **`docs/templates/BREAK_GLASS_AND_PURPOSE_OF_USE.md`**
