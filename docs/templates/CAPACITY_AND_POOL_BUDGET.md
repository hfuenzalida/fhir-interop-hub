# Capacity & PostgreSQL connection budget (template)

Fill this when sizing **hub-api** replicas and **Postgres** (`max_connections`). Align with **`PG_POOL_*`** in **`.env.example`**.

## 1. Hub API tier

| Parameter | Value |
|-----------|--------|
| Hub API **replica count** (pods / tasks) | *N = * |
| **`PG_POOL_MAX`** per process | *P = * |
| **Connections from app to primary** (direct) | **N × P** = |

If using **PgBouncer** (transaction mode) **in front of** Postgres, connections **from PgBouncer to Postgres** are often **≪ N × P**; connections **from app to PgBouncer** still equal **N × P** unless you session-pool differently.

## 2. Other consumers of `max_connections`

| Consumer | Estimated connections |
|----------|----------------------|
| Hub replicas (sum) | *N × P* |
| Read replica pools (if separate processes point to replica) | *calculate same way for read tier if applicable* |
| **Migration job** (CI / one-off) | *1–5* |
| **DBA / psql / reporting** | *2–10* |
| **PgBouncer admin** (if any) | *per vendor* |
| **Reserved headroom** | *≥ 10–20% of max_connections* |

## 3. Formula

```
sum(app_workers × PG_POOL_MAX) + admin + headroom ≤ Postgres max_connections
```

Set **`max_connections`** (or PgBouncer pool) so spikes during deploy (**old + new** pods briefly overlap) do not exhaust connections.

## 4. Read replicas

- **`DATABASE_READ_URL`** opens a **second** pool per process with **`PG_READ_POOL_MAX`** (defaults to **`PG_POOL_MAX`**).  
- **Replica’s** `max_connections` must budget **read traffic** separately if read replicas are dedicated.

## 5. Review triggers

- Increase in **N** (autoscaling).  
- Change in **`PG_POOL_MAX`**.  
- New **batch** or **analytics** clients hitting the same DB.

---

**Pointer:** **`services/hub-api/src/db/pool-factory.ts`**, **`docs/GAP5_RELIABILITY.md`**.
