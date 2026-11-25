# Deployment (cloud-agnostic)

Phase I (**`ROADMAP_TO_PROD.md`**) expects **repeatable artifacts** (container image + migrations) and **environment-specific config** without embedding secrets in the repo.

## Container image

Build from the repository root:

```bash
docker build -t hub-api:local .
```

The **`Dockerfile`** produces a runnable **`hub-api`** process. Pair it with **managed Postgres** and inject env vars from your platform.

## Infrastructure checklist (fill per cloud)

Use Terraform, Pulumi, Bicep, CloudFormation, or your platform’s GUI — the contract is the same:

1. **Network** — Private subnets for app + database; security groups **database ← app only**; optional **private egress** for observability.  
2. **TLS** — Certificate on **ingress / load balancer / API gateway**; plain HTTP only inside mesh if policy allows.  
3. **Database** — Managed Postgres with **HA**, **automated backups + PITR**, **`max_connections`** budget vs hub replicas × **`PG_POOL_MAX`** (see **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`**). Optional **read replica** → hub **`DATABASE_READ_URL`**. **Restore drill** — **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**. Full narrative — **`docs/PROD_PHASE3_RELIABILITY.md`**.  
4. **Secrets** — **Vault**, **AWS Secrets Manager**, **GCP Secret Manager**, **Azure Key Vault**, or equivalent — inject as env at runtime (same keys as **`.env.example`**).  
5. **Observability** — Scrape **`/internal/metrics`** with bearer **`INTERNAL_METRICS_TOKEN`** (**`docs/prometheus/SCRAPING_INTERNAL_METRICS.md`**); alerting examples (**`docs/prometheus/prometheus-alert-rules.example.yml`**); logs/tracing/incidents — **`docs/PROD_PHASE4_OBSERVABILITY.md`**; ship logs off-node with **no PHI** in payloads.

## Kubernetes-oriented layout (example)

| Component | Role |
|-----------|------|
| **Deployment** | Runs **`hub-api`** image; `resources.requests/limits`; liveness/readiness on **`/ready`**. |
| **Job (pre-install/upgrade)** | Runs **`node scripts/apply-all-migrations.mjs`** with **`DATABASE_URL`** from a secret, **same chart/git ref as the image**. |
| **Service / Ingress** | TLS termination, **`TRUST_PROXY`** when appropriate. |
| **Secret** | `DATABASE_URL`, JWT keys, `INTERNAL_METRICS_TOKEN`, etc. |

## What not to commit

- Connection strings, PEM keys, API tokens, or **`.env`** for production.  
- Terraform **`.tfstate`** with secrets (use remote backend + encryption).

See **`docs/PROD_PHASE1_DELIVERY.md`** for migrations, rollback, and CI alignment. **Phase III (data plane):** **`docs/PROD_PHASE3_RELIABILITY.md`**. **Phase V (compliance / residency narrative):** **`docs/templates/DPA_SUBPROCESSORS_CHECKLIST.md`** — subprocessors + **`tenant.data_region`** alignment.
