# Break-glass & purpose-of-use procedures (template)

The hub **records** optional **`X-Break-Glass-Reason`** and **`X-Purpose-Of-Use`** (configurable via **`BREAK_GLASS_HEADER`**, **`PURPOSE_OF_USE_HEADER`**) on **`AuditActor`** — see **`docs/GAP4_COMPLIANCE_AUDIT.md`**. **Authorization** to send those headers is **organizational**.

---

## 1. Break-glass (emergency access)

**When:** Clinical or operational emergency requiring access outside normal policy.

| Step | Owner |
|------|--------|
| 1. **Approve** — on-call medical director / security per local policy | |
| 2. **Time-box** — start/end time in ticket | |
| 3. **Invoke** — client sends **`X-Break-Glass-Reason`** with **non-PHI summary** where possible | |
| 4. **Audit** — verify **`audit_event`** rows exist for the session | |
| 5. **Review** — post-incident review within **[72h]** | |

**Edge:** Strip or block break-glass headers from untrusted networks — **`docs/GAP4_COMPLIANCE_AUDIT.md`**.

---

## 2. Purpose of use

**When:** **`CONSENT_POLICY_ENABLED=true`** and Consent resources declare **`provision.purpose`** — requests must carry a matching purpose header or receive **403** (unless **`CONSENT_REQUIRE_PURPOSE_HEADER=false`** — not recommended for production).

| Step | Owner |
|------|--------|
| Define allowed **purpose labels** / codings | Clinical / compliance |
| Configure clients / gateways to send **`X-Purpose-Of-Use`** | Integration |
| Monitor **403** rates after rollout | SRE |

---

## 3. References

- **`docs/COMPLIANCE_CONSENT_AND_AUDIT.md`**  
- **`docs/HIPAA_TECHNICAL_SAFEGUARDS.md`** — emergency access  
- **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**
