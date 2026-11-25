# Phase I — Environment & delivery pipeline (delivered artifacts)

This document matches **Phase I** in **`ROADMAP_TO_PROD.md`**: repeatable builds, migration gate, container runtime, and rollback guidance. Cloud-specific VPC/TLS/LB is **your** provider choice; this repo supplies portable building blocks.

---

## 1. What ships in-repo

| Artifact | Purpose |
|----------|---------|
| **`Dockerfile`** | Multi-stage build: compile `@fhir-hub/shared` + `@fhir-hub/hub-api`, **`npm prune --omit=dev`**, run as **non-root** user `hub` (uid 1001). Includes **`db/migrations`** and **`scripts/apply-all-migrations.mjs`** for sidecar / Job migrations. |
| **`.dockerignore`** | Excludes `node_modules`, `dist`, `.git`, env files from build context. |
| **`docker-compose.hub.yml`** | **hub-api + Postgres** — stage-like stack for smoke testing (not production TLS by itself). |
| **`.github/workflows/docker-build.yml`** | CI: **`docker build`** on main/PR so broken Dockerfiles fail the pipeline. |
| **`deploy/README.md`** | IaC posture and where secrets/config live (no cloud credentials in git). |

---

## 2. Build & run locally

```bash
# Production-style image (from repo root)
npm run docker:build

# API + Postgres (apply migrations in another shell or a job — see §4)
npm run docker:compose:hub
```

After Postgres is up, **apply migrations** before relying on FHIR routes:

```bash
# From host, against compose Postgres on localhost:5432
set DATABASE_URL=postgresql://hub:hub@localhost:5432/hub
npm run migrate:apply-all
```

Then **`curl http://127.0.0.1:3000/ready`** should report `ready` (and hub-api logs should show DB connected).

---

## 3. Configuration & secrets (no secrets in git)

| Concern | Practice |
|---------|----------|
| **Runtime env** | Inject **`DATABASE_URL`**, **`OIDC_ISSUER`**, **`HUB_JWT_*`**, **`CORS_ORIGINS`**, **`INTERNAL_METRICS_TOKEN`**, etc. from **secret manager** or orchestrator secrets — see **`.env.example`**. |
| **CI** | Use repository **Actions secrets** for registry push tokens only if you add a push step; default workflow **does not push** images. |
| **Logs** | Pipeline must not print env or build args containing secrets. Avoid `docker build --build-arg` for database passwords. |

Per-environment matrix (fill for your org):

| Variable | Dev | Stage | Prod |
|----------|-----|-------|------|
| `NODE_ENV` | development | production | production |
| `DATABASE_URL` | local / docker | managed DB URL | managed DB URL |
| `CORS_ORIGINS` | `http://localhost:4200` | `https://stage.example.com` | `https://app.example.com` |
| `DEV_API_KEY` / `DEV_TENANT_ID` | optional | **off** | **off** |
| `TRUST_PROXY` | false | **true** behind LB | **true** |

---

## 4. Database migrations as a release gate

**Rule:** apply **`db/migrations/*.sql`** (lexical order) **before** or **as part of** rolling out a new version that depends on new schema.

In-repo helper (also baked into the image):

```bash
node scripts/apply-all-migrations.mjs
```

**CI already runs** this against Postgres (**`.github/workflows/ci.yml`** — `migration-smoke` job).

**Production patterns:**

1. **Job before deploy:** run migrations from the **same git tag** as the image (CI artifact or init container using this repo + `DATABASE_URL`).  
2. **Expand/contract:** prefer additive migrations; destructive changes require backfill and dual-write windows (**never** edit applied migration files).

---

## 5. Rollback

| Layer | Action |
|-------|--------|
| **Application** | Redeploy **previous image tag** (immutable tags per release). |
| **Database** | Prefer **forward-only** migrations; rollback app without reversing DDL unless you maintain **down** migrations or restore from backup (Phase III). |
| **Traffic** | Shift load balancer to previous task set / blue-green slot. |

Document **your** image registry and tag scheme (e.g. `ghcr.io/<org>/hub-api:2026.04.18-sha-<short>`).

---

## 6. Image hardening checklist

The **`Dockerfile`** already:

- Uses **`NODE_ENV=production`** in the runtime stage.  
- Runs as **non-root** (`hub` user).  
- Exposes only the HTTP port; **no secrets** in layers.

**You should still:**

- Scan images (**Trivy**, **Grype**, or registry scanning).  
- In Kubernetes: optional **`readOnlyRootFilesystem: true`** with a **`tmpfs`** or **`emptyDir`** mount on **`/tmp`** (Node and native addons may need writable temp).  
- Terminate **TLS** at ingress / API gateway; set **`TRUST_PROXY=true`** when the hub sees proxied requests.

---

## 7. IaC (Terraform / Pulumi / Bicep)

This repository does **not** pin a single cloud. See **`deploy/README.md`** for integration expectations (VPC, RDS/Cloud SQL, ingress, secrets).

---

## 8. Phase I exit criteria (from ROADMAP_TO_PROD)

| Criterion | How this repo helps |
|-----------|---------------------|
| Pipeline-driven deploy to **stage** | Use **`docker-compose.hub.yml`** or import **`Dockerfile`** into your CD; **docker-build** workflow validates the image build. |
| **Rollback** documented | §5 above + **`ROADMAP_TO_PROD.md`** |
| **No secrets in git** | §3 + **`.dockerignore`** excludes `.env` |

---

## 9. References

- **`ROADMAP_TO_PROD.md`** — Phase I goals.  
- **`scripts/apply-all-migrations.mjs`** — migration runner.  
- **`.github/workflows/ci.yml`** — migration smoke + integration tests.
