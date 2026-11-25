# Operations runbooks — hub-api

Concise responses for common incidents. Replace placeholders (`<ISSUER>`, `<DB_HOST>`) with your environment values.

---

### Database connection failures (`/ready` not ready, `database_unreachable`)

**Symptoms:** `GET /ready` returns 503; logs show `ECONNREFUSED`, `timeout`, or Postgres auth errors.

**Checks:**

1. Confirm **`DATABASE_URL`** (host, port, DB name, user) matches the running Postgres instance.
2. From the pod/host: `psql "$DATABASE_URL" -c 'SELECT 1'`.
3. Verify security groups / firewall allow the API tier → Postgres port (often 5432).
4. Check **`PG_POOL_MAX`** × replica count vs Postgres **`max_connections`**.

**Mitigate:** Scale down noisy clients; temporarily raise **`max_connections`** only if sustained legitimate load.

---

### Migration failed mid-deploy

**Symptoms:** App logs migration errors; API returns 500 on DB-backed routes.

**Checks:**

1. Run migrations manually against the same **`DATABASE_URL`** the app uses: `psql ... -f db/migrations/<NN>_*.sql` in order.
2. Inspect partial DDL (constraints, duplicate indexes); roll forward with a fix migration rather than editing applied SQL.

**Mitigate:** Restore DB from snapshot if data corrupted; never **`DROP`** production without backup verification.

---

### Backup validation & restore drill (Phase III)

**Symptoms:** Need to prove **RPO/RTO** before go-live or after infra change.

**Steps:** Follow **`docs/runbooks/DATABASE_BACKUP_RESTORE_DRILL.md`**. Use **`docs/templates/CAPACITY_AND_POOL_BUDGET.md`** if connection exhaustion appears after scale-out.

**Reference:** **`docs/PROD_PHASE3_RELIABILITY.md`**.

---

### OAuth / SMART: `invalid_grant`, JWKS, or token verification errors

**Symptoms:** Apps cannot complete SMART login; logs mention JWT **`aud`**, **`iss`**, or JWKS fetch failures.

**Checks:**

1. **`OIDC_ISSUER`** must match what clients expect (often public URL including scheme/host).
2. **`OIDC_AUDIENCE`** (access token) typically **`${issuer}/fhir`** — clients must validate the same **`aud`** / **`iss`**.
3. **`/.well-known/jwks.json`** returns keys when **`HUB_JWT_PRIVATE_KEY_PEM`** (RS256) or **`HUB_JWT_PUBLIC_KEY_PEM`** is set; **`HUB_JWT_KID`** stable across rotations until JWKS updated.
4. PKCE: authorize flow must use **`S256`** and matching **`code_verifier`** at **`/oauth/token`**.

**Mitigate:** Rotate **`oauth_client`** secrets in DB if leaked; re-register JWKS after key rotation.

---

### High latency / saturation

**Symptoms:** Elevated **`hub_http_request_duration_seconds`** p95; **`hub_pg_pool_connections{state="waiting"}`** > 0.

**Checks:**

1. Postgres CPU / IOPS (RDS Performance Insights, Cloud SQL Query Insights).
2. Increase **`PG_POOL_MAX`** per instance only if Postgres can absorb more connections (often pair with **PgBouncer**).
3. Enable **`DATABASE_READ_URL`** for read-heavy FHIR traffic (eventual consistency).

---

### Disk full (Postgres data volume)

**Symptoms:** DB rejects writes; `could not extend file`.

**Mitigate:** Expand disk / volume; purge non-critical data only per retention policy; **`VACUUM`** maintenance windows.

---

### Rate limiting blocking legitimate traffic

**Symptoms:** HTTP **429** from **`@fastify/rate-limit`**.

**Checks:** **`RATE_LIMIT_*`** env, **`TRUST_PROXY`** for correct client IP, **`RATE_LIMIT_ALLOW_LOOPBACK`** in prod.

---

### Observability & paging (Phase IV)

**Symptoms:** Alerts firing from Prometheus / Grafana; customers report errors before on-call notices.

**Checks:**

1. **`docs/PROD_PHASE4_OBSERVABILITY.md`** — metric names (**`hub_*`**), scrape auth (**`INTERNAL_METRICS_TOKEN`**).  
2. **`docs/prometheus/SCRAPING_INTERNAL_METRICS.md`** — verify scrape target and Bearer header.  
3. Logs: **`correlationId`** / **`x-request-id`** — **`docs/templates/LOG_SHIPPING_CHECKLIST.md`**.  
4. **Paging test:** **`docs/templates/ON_CALL_ALERT_ROUTING_TEST.md`** — confirm routes after routing changes.

**Mitigate:** Silence noisy alerts only with **time-bound** silences and linked incidents (**`docs/templates/INCIDENT_RESPONSE.md`**).

---

### Audit integrity verification (Phase V)

**Symptoms:** Compliance asks for proof of **tamper-evident** audit or **append-only** enforcement.

**Steps:** **`docs/runbooks/AUDIT_INTEGRITY_VERIFICATION.md`**. **Customer packet:** **`docs/templates/CUSTOMER_SECURITY_PACKET.md`**.

---

### Usage metering & tenant support (commercial)

**Docs:** **`docs/GAP10_COMMERCIAL.md`** (Prometheus **`hub_metered_requests_total`**, **`GET /internal/v1/usage/summary`**). **Support playbooks:** **`docs/support/SUPPORT-TIERS.md`**. **SLA drafting:** **`docs/templates/SLA-draft.md`**.

**Tenant inventory (operators):** `npm run tenant-admin -- list-tenants` or `show --external-key <external_key>` — requires **`DATABASE_URL`**; never log connection strings or API key material.
