import { z } from "zod";

/** Exported for tests and tooling that need defaults-aware parsing. */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HUB_API_HOST: z.string().default("0.0.0.0"),
  HUB_API_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().url().optional(),
  ),
  /**
   * Optional read replica URL — used only for FHIR **read** paths (search, read, $everything).
   * OAuth, audits, and ingestion always use `DATABASE_URL`.
   */
  DATABASE_READ_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().url().optional(),
  ),
  /** Max clients per hub instance (primary pool). */
  PG_POOL_MAX: z.coerce.number().int().positive().max(500).default(20),
  /** Max clients for `DATABASE_READ_URL` pool (defaults to PG_POOL_MAX if unset in code). */
  PG_READ_POOL_MAX: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().positive().max(500).optional(),
  ),
  /** Minimum idle clients kept open (node-pg Pool `min`). */
  PG_POOL_MIN: z.coerce.number().int().min(0).max(100).default(0),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).max(3_600_000).default(10_000),
  /** 0 = wait indefinitely for a pool slot (node-pg default). */
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(0).max(120_000).default(0),
  /** Cache GET /fhir/metadata (CapabilityStatement). 0 = disabled. */
  CAPABILITY_CACHE_TTL_MS: z.coerce.number().int().min(0).max(3_600_000).default(60_000),
  /** Cache OAuth/JWKS discovery JSON. 0 = disabled. */
  DISCOVERY_CACHE_TTL_MS: z.coerce.number().int().min(0).max(3_600_000).default(60_000),
  DEV_TENANT_ID: z.string().min(1).default("dev-tenant-001"),
  OIDC_ISSUER: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().url().optional(),
  ),
  OIDC_AUDIENCE: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /**
   * HS256 key for SMART access tokens (min 32 chars). Optional: OAuth token routes
   * stay disabled until set.
   */
  HUB_JWT_SECRET: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().min(32).optional(),
  ),
  /** RSA private key PEM (PKCS#8) — if set, access tokens use RS256 and JWKS is published. */
  HUB_JWT_PRIVATE_KEY_PEM: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Optional SPKI PEM; verification falls back to public half of HUB_JWT_PRIVATE_KEY_PEM. */
  HUB_JWT_PUBLIC_KEY_PEM: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** `kid` in JWT header and JWKS (rotation). */
  HUB_JWT_KID: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Plaintext dev key; must match a tenant row (`DEV_TENANT_ID` external_key). */
  DEV_API_KEY: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Comma-separated browser origins, or `*`. Empty: dev mirrors any origin; production disables CORS unless set. */
  CORS_ORIGINS: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Trust `X-Forwarded-For` when behind a reverse proxy (accurate client IP for rate limits). */
  TRUST_PROXY: z.coerce.boolean().default(false),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_OAUTH_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** Exempt loopback from rate limits (local dev / health from same host). */
  RATE_LIMIT_ALLOW_LOOPBACK: z.coerce.boolean().default(true),
  FHIR_JSON_MAX_DEPTH: z.coerce.number().int().positive().max(200).default(48),
  HL7_INGEST_MAX_CHARS: z.coerce.number().int().positive().default(4_000_000),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(11 * 1024 * 1024),
  /** HTTP header name (lowercase) for break-glass / emergency access reason (stored on audit actor). */
  BREAK_GLASS_HEADER: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** HTTP header for purpose-of-use label (stored on audit actor). */
  PURPOSE_OF_USE_HEADER: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** When true, Fastify request logs redact Authorization and Hub API key headers. */
  LOG_REDACT_ENABLED: z.coerce.boolean().default(true),
  /**
   * When set, Postgres audit rows include a per-tenant hash chain (HMAC if AUDIT_CHAIN_SECRET is set).
   * Set false only for rare migration / recovery scenarios.
   */
  AUDIT_INTEGRITY_ENABLED: z.coerce.boolean().default(true),
  /**
   * Optional HMAC key for `audit_event.row_hash` (defense-in-depth vs hash-only chaining).
   * If unset, the chain still uses SHA-256 of (prev|entry) without a secret.
   */
  AUDIT_CHAIN_SECRET: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /**
   * When true, active Consent resources with declared `provision.purpose` require a matching
   * `X-Purpose-Of-Use` (or PURPOSE_OF_USE_HEADER) for that patient.
   */
  CONSENT_POLICY_ENABLED: z.coerce.boolean().default(false),
  /**
   * If false, purpose matching is advisory (still auditable) — not recommended in production.
   */
  CONSENT_REQUIRE_PURPOSE_HEADER: z.coerce.boolean().default(true),

  /** Pino log level override (trace | debug | info | warn | error | fatal | silent). */
  LOG_LEVEL: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
  ),
  /** Incoming header treated as business correlation id (logged as `correlationId`). */
  CORRELATION_ID_HEADER: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Expose Prometheus metrics at GET /internal/metrics */
  METRICS_ENABLED: z.coerce.boolean().default(true),
  /** When set, /internal/metrics requires Authorization: Bearer <token>. */
  INTERNAL_METRICS_TOKEN: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().optional(),
  ),
  /** Register Node.js process & GC metrics (prom-client default metrics). */
  METRICS_NODE_COLLECT_DEFAULT: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema> & {
  oauthIssuer: string;
  oauthAudience: string;
};

/**
 * Fail fast in production when misconfiguration would widen attack surface.
 * See **`docs/PROD_PHASE2_SECURITY.md`**.
 */
export function assertProductionSecurityConfig(
  data: z.infer<typeof envSchema>,
): void {
  if (data.NODE_ENV !== "production") return;
  if (data.DEV_API_KEY) {
    throw new Error(
      "Security: DEV_API_KEY must not be set when NODE_ENV=production (remove dev API key bypass).",
    );
  }
  if (data.METRICS_ENABLED && !data.INTERNAL_METRICS_TOKEN?.trim()) {
    throw new Error(
      "Security: set INTERNAL_METRICS_TOKEN when METRICS_ENABLED=true in production, or set METRICS_ENABLED=false.",
    );
  }
}

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  const base = parsed.data;
  assertProductionSecurityConfig(base);
  const oauthIssuer =
    base.OIDC_ISSUER ?? `http://127.0.0.1:${base.HUB_API_PORT}`;
  const oauthAudience = base.OIDC_AUDIENCE ?? `${oauthIssuer}/fhir`;
  return { ...base, oauthIssuer, oauthAudience };
}
