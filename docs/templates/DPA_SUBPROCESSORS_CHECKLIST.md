# DPA, subprocessors & data residency (checklist)

Fill with **legal** review. This is **not** legal advice.

---

## 1. Data processing agreement (DPA)

- [ ] **Roles:** Controller / Processor / Sub-processor definitions match actual deployment.  
- [ ] **Purpose:** Processing limited to **interop / FHIR hub** functions in contract.  
- [ ] **Subprocessors:** Right to **notify** / **object** per regulation (GDPR Art. 28 style where applicable).  
- [ ] **Deletion / return** of data at end of term — operational owner named.  
- [ ] **Security:** Reference **`CUSTOMER_SECURITY_PACKET.md`** + **`HIPAA_TECHNICAL_SAFEGUARDS.md`** as technical annex where appropriate.

---

## 2. Subprocessor register (example table)

| Subprocessor | Service | Data touched | Region | BAA / DPA status |
|--------------|---------|--------------|--------|------------------|
| *[e.g. AWS]* | Hosting / RDS | ePHI at rest | *us-east-1* | *[link]* |
| *[e.g. Datadog]* | Logs/metrics | Metadata, redacted logs | *US* | *[link]* |
| *[add rows]* | | | | |

Hub repo **does not** maintain this table — **your** vendor register is authoritative.

---

## 3. Data residency narrative

- **DB column:** **`tenant.data_region`** (migration **008**) — **informational**; does not enforce routing in application code.  
- **Operational truth:** Where **Postgres** primary and backups **physically** reside (provider console).  
- **Cross-border:** If tenants may span regions, document **lawful basis** and **transfer mechanisms** (SCCs, etc.) with counsel.

---

## 4. HIPAA BAA (if applicable)

- [ ] BAA executed with **each** subprocessor that creates/receives/maintains PHI on your behalf.  
- [ ] **Inventory** matches **`CUSTOMER_SECURITY_PACKET`** subprocessors section.

---

## 5. References

- **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**  
- **`docs/GAP4_COMPLIANCE_AUDIT.md`** — residency hint
