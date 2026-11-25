import pg from "pg";
import type { Env } from "../env.js";

/** Primary writer pool (migrations, OAuth, audit append, FHIR writes). */
export function createPrimaryPool(env: Env): pg.Pool {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create a pool");
  }
  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.PG_POOL_MAX,
    min: env.PG_POOL_MIN,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.PG_CONNECTION_TIMEOUT_MS,
  });
}

/**
 * Optional read replica for FHIR reads only. Same tuning defaults unless PG_READ_POOL_MAX overrides max.
 */
export function createReadReplicaPool(env: Env): pg.Pool | undefined {
  if (!env.DATABASE_READ_URL) return undefined;
  return new pg.Pool({
    connectionString: env.DATABASE_READ_URL,
    max: env.PG_READ_POOL_MAX ?? env.PG_POOL_MAX,
    min: env.PG_POOL_MIN,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.PG_CONNECTION_TIMEOUT_MS,
  });
}
