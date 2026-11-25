# Runbook — audit integrity verification (operational)

**Purpose:** Demonstrate **tamper-evidence** and **append-only** guarantees for **`audit_event`** — Phase V operational checks.

**Related:** **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**, migration **`009_audit_integrity_consent_support.sql`**.

---

## 1. Preconditions

- **`AUDIT_INTEGRITY_ENABLED=true`** (default).  
- **`AUDIT_CHAIN_SECRET`** documented in secret manager if HMAC chain used.  
- DB role for hub app: **INSERT** on **`audit_event`** only; **no UPDATE/DELETE** for app role (trigger enforces).

---

## 2. Append-only trigger check

Run as **superuser** or migration owner in **non-prod** first:

```sql
-- Expect: ERROR ... audit_event rows are append-only
UPDATE audit_event SET detail = detail WHERE id = (SELECT id FROM audit_event LIMIT 1);
```

In production, prefer **staging** clone — avoid touching prod rows even if rollback planned.

---

## 3. Chain verification (sample)

1. Export recent **`audit_event`** rows for one **`tenant_id`** ordered by **`timestamp`**, **`id`**.  
2. Recompute **`entry_hash`** / **`row_hash`** per application algorithm (**`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**).  
3. Compare to stored columns — mismatch indicates investigation.

For automation, implement an offline script in your security tooling — not shipped in this repo.

---

## 4. Cadence

| Frequency | Action |
|-----------|--------|
| **Quarterly** | Spot-check one tenant chain + trigger test on **staging** clone |
| **After incident** | Verify audit rows for affected interval |

---

## 5. References

- **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**  
- **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** §controls
