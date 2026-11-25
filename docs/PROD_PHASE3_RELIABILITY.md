# Phase III — Data plane: reliability, backup & scale (delivered artifacts)

Implements **Phase III** in **`ROADMAP_TO_PROD.md`**: RPO/RTO thinking, connection/pool discipline, read-replica awareness, load-test paths, and SLO templates aligned with **`docs/templates/SLA-draft.md`**.

**Cloud execution** (RDS, Cloud SQL, Aurora, etc.) remains in your account — this repo provides **checklists, math, and scripts**, not a live database.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`docs/PROD_PHASE3_RELIABILITY.md`** (this file) | Phase III overview, links, exit-criteria mapping. |
| **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`** | Restore / DR drill you **run in staging** and record. |
| **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`** | **Capacity + `max_connections`** budget template. |
| **`docs/templates/SLO_BUDGET_TABLE.md`** | SLO / error-budget table for **`SLA-draft.md`**. |
| **`scripts/load/k6-fhir-read-smoke.js`** | k6: authenticated **Patient** search (staging). |
| **`scripts/load/README.md`** | How to run k6 smoke scripts. |
| **`docs/GAP5_RELIABILITY.md`**, **`deploy/README.md`**, **`docs/RUNBOOKS.md`** | Cross-links to Phase III. |

**Hub behavior (already in code):** read pool via **`DATABASE_READ_URL`**, **`/ready`** `readReplica` field, **`PG_*`** envs — see **`docs/GAP5_RELIABILITY.md`**.

---

## 2. Managed Postgres & HA (operator checklist)

| Item | Action |
|------|--------|
| **HA / failover** | Use provider **Multi-AZ** (or equivalent); document **failover** behavior (DNS, connection string, pool reset). |
| **PITR / backups** | Enable **continuous backup** + **retention**; test **restore** (see runbook). |
| **`max_connections`** | Set above **(hub replicas × `PG_POOL_MAX`)** + headroom for **migrations**, **admin**, **PgBouncer** (if any). |
| **PgBouncer / proxy** | Use **transaction mode** with this app; size pool for many Node processes — **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`**. |
| **Read replica** | Set **`DATABASE_READ_URL`** only after replica is **healthy**; alert on **replication lag** if reads must be fresher than lag. |

---

## 3. Read replica & consistency

- **Writes, OAuth, auth, audit, ingestion** use **primary** only.  
- **FHIR reads** (read, search, `$everything`, Consent policy reads) use **replica** when configured.  
- For **read-your-writes** UIs, account for **replication lag**; design or route sensitive flows to primary if needed (product decision).

---

## 4. Horizontal scaling

- API tier is **stateless** — scale replicas behind an LB **without sticky sessions** for hub JWT/API-key flows.  
- Bottleneck moves to **Postgres** and **pool limits** — revisit **`CAPACITY_AND_POOL_BUDGET.md`** when replica count changes.

---

## 5. Load testing

| Script | Auth | Use |
|--------|------|-----|
| **`k6-metadata-smoke.js`** | None | Public **`/fhir/metadata`** + **`/ready`**. |
| **`k6-fhir-read-smoke.js`** | **`K6_BEARER_TOKEN`** | **`GET /fhir/Patient?_count=…`** — staging only with synthetic data. |

Extend further for **`POST /oauth/token`**, ingest routes, or Bundles when you have stable fixtures.

---

## 6. Exit criteria (from ROADMAP_TO_PROD)

| Criterion | Deliverable |
|-----------|-------------|
| **Restore drill** completed and documented | **`DATABASE_BACKUP_RESTORE_DRILL.md`** sign-off table filled after you run it in **staging** (or sandbox clone). |
| **Capacity model** | **`CAPACITY_AND_POOL_BUDGET.md`** filled for your replica counts and **`PG_POOL_*`**. |
| **SLO numbers for SLA** | **`SLO_BUDGET_TABLE.md`** + paste into **`docs/templates/SLA-draft.md`**. |

---

## 7. References

- **`docs/GAP5_RELIABILITY.md`** — in-repo behavior.  
- **`services/hub-api/src/db/pool-factory.ts`** — pool wiring.  
- **`docs/PROD_PHASE1_DELIVERY.md`** — migrations & rollback.  
- **`docs/templates/SLA-draft.md`** — customer SLA narrative.
