# Runbook — database backup & restore drill (Phase III)

**Purpose:** Prove **RPO/RTO** assumptions before production PHI. Run in **staging** or a **disposable clone** of prod topology — not on live prod during business hours without approval.

**Owner:** *[DBA / platform]*  
**Cadence:** At least **quarterly** after initial pass; after major infra changes.

---

## 1. Preconditions

- [ ] **Latest migration** applied to the drill target matches production schema expectations.  
- [ ] **Backup** mechanism enabled (PITR / automated snapshot — provider-specific).  
- [ ] **Connection strings** and secrets available only to operators (no screenshots with passwords).

---

## 2. Drill variants

| Variant | Goal |
|---------|------|
| **A — Restore to new instance** | Validate snapshot/PITR restore creates a **working** Postgres with correct data **as of T**. |
| **B — Point-in-time restore** | Restore to **T − N minutes** (document **N** achieved vs target RPO). |
| **C — Failover simulation** | Where provider supports it — trigger **failover**, confirm app **`DATABASE_URL`** reconnects (may require pool bounce / pod restart). |

Pick **A + B** minimum for Phase III exit criteria.

---

## 3. Procedure (generic)

1. **Record baseline:** Note current DB size, major version, parameter group name.  
2. **Take manual snapshot** (optional extra) before destructive steps — label **`drill-YYYY-MM-DD`**.  
3. **Restore** using cloud console or CLI to a **new** endpoint (recommended) or temporary cluster.  
4. **Verify integrity:**  
   - `psql "$DATABASE_URL" -c 'SELECT 1'`  
   - Row counts on **`tenant`**, **`audit_event`** (sample), **`fhir_resource`** or equivalent — match expectations for synthetic staging.  
   - Run **`npm run migrate:apply-all`** only if restoring **empty** DB from scratch (normally migrations already in snapshot).  
5. **Connect hub-api** (staging config) to restored endpoint; **`GET /ready`** → `ready`; smoke **`GET /fhir/metadata`**.  
6. **Document** actual **RPO** achieved (delta between intended **T** and restored data) and **RTO** (wall-clock time to verified readiness).

---

## 4. Sign-off (Phase III)

| Field | Value |
|-------|--------|
| **Date** | |
| **Environment** | staging / sandbox |
| **Variant** | A / B / C |
| **RPO target** | |
| **RPO achieved** | |
| **RTO target** | |
| **RTO achieved** | |
| **Issues** | |
| **Signed** | |

---

## 5. References

- **`docs/PROD_PHASE3_RELIABILITY.md`**  
- Provider docs: AWS RDS / GCP Cloud SQL / Azure Database for PostgreSQL — backup & PITR.
