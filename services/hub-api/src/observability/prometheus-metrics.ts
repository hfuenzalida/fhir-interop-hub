import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import type { Env } from "../env.js";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

let registry: Registry | undefined;
let httpRequestsTotal: Counter<string>;
let httpRequestDurationSeconds: Histogram<string>;
let oauthTokensIssuedTotal: Counter<string>;
let pgPoolConnections: Gauge<string>;
/** Billing-oriented request counts (tenant × surface area); scrape `/internal/metrics`. */
let meteredRequestsTotal: Counter<string>;

function statusFamily(code: number): "2xx" | "3xx" | "4xx" | "5xx" | "other" {
  if (code >= 500) return "5xx";
  if (code >= 400) return "4xx";
  if (code >= 300) return "3xx";
  if (code >= 200) return "2xx";
  return "other";
}

/** Route template for Prometheus labels (low cardinality). */
export function metricsRouteLabel(request: FastifyRequest): string {
  const ro = request.routeOptions as { url?: string } | undefined;
  if (typeof ro?.url === "string" && ro.url.length > 0) return ro.url;
  const rp = (request as FastifyRequest & { routerPath?: string }).routerPath;
  if (typeof rp === "string" && rp.length > 0) return rp;
  return "_unmatched";
}

const reqStartNs = new WeakMap<FastifyRequest, bigint>();

export function initPrometheusMetrics(env: Env): Registry | undefined {
  if (!env.METRICS_ENABLED) return undefined;
  registry = new Registry();
  if (env.METRICS_NODE_COLLECT_DEFAULT) {
    collectDefaultMetrics({ register: registry });
  }

  httpRequestsTotal = new Counter({
    name: "hub_http_requests_total",
    help: "Total HTTP requests processed",
    labelNames: ["method", "route", "status_family"],
    registers: [registry],
  });

  httpRequestDurationSeconds = new Histogram({
    name: "hub_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  oauthTokensIssuedTotal = new Counter({
    name: "hub_oauth_tokens_issued_total",
    help: "OAuth access tokens successfully issued at POST /oauth/token",
    labelNames: ["grant_type"],
    registers: [registry],
  });

  pgPoolConnections = new Gauge({
    name: "hub_pg_pool_connections",
    help: "node-postgres pool connection counts",
    labelNames: ["pool", "state"],
    registers: [registry],
  });

  meteredRequestsTotal = new Counter({
    name: "hub_metered_requests_total",
    help:
      "HTTP requests for usage metering (tenant external_key + api_family); billing adapters scrape Prometheus",
    labelNames: ["tenant_external_key", "api_family"],
    registers: [registry],
  });

  return registry;
}

export function getMetricsRegistry(): Registry | undefined {
  return registry;
}

export function recordHttpRequestSample(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
): void {
  if (!registry) return;
  const fam = statusFamily(statusCode);
  httpRequestsTotal.inc({ method, route, status_family: fam });
  httpRequestDurationSeconds.observe({ method, route }, durationSeconds);
}

export function recordOAuthTokenIssued(grantType: string): void {
  if (!registry) return;
  oauthTokensIssuedTotal.inc({ grant_type: grantType });
}

/** api_family: `fhir` | `oauth` | `internal` | `system` | `other` */
export function recordMeteredRequest(
  tenantExternalKey: string,
  apiFamily: string,
): void {
  if (!registry) return;
  meteredRequestsTotal.inc({
    tenant_external_key: tenantExternalKey,
    api_family: apiFamily,
  });
}

export function meteringApiFamily(url: string): string {
  const path = url.split("?")[0] ?? "";
  if (path.startsWith("/fhir")) return "fhir";
  if (path.startsWith("/oauth")) return "oauth";
  if (path.startsWith("/internal")) return "internal";
  if (path === "/health" || path === "/ready") return "system";
  if (path.startsWith("/.well-known")) return "oauth";
  return "other";
}

export function refreshPgPoolGauges(
  primary: pg.Pool,
  readReplica?: pg.Pool,
): void {
  if (!registry) return;
  pgPoolConnections.set(
    { pool: "primary", state: "total" },
    primary.totalCount,
  );
  pgPoolConnections.set(
    { pool: "primary", state: "idle" },
    primary.idleCount,
  );
  pgPoolConnections.set(
    { pool: "primary", state: "waiting" },
    primary.waitingCount,
  );
  if (readReplica) {
    pgPoolConnections.set(
      { pool: "replica", state: "total" },
      readReplica.totalCount,
    );
    pgPoolConnections.set(
      { pool: "replica", state: "idle" },
      readReplica.idleCount,
    );
    pgPoolConnections.set(
      { pool: "replica", state: "waiting" },
      readReplica.waitingCount,
    );
  }
}

export function registerHttpMetricsHooks(app: FastifyInstance): void {
  if (!getMetricsRegistry()) return;

  app.addHook("onRequest", async (request) => {
    if (shouldSkipHttpMetrics(request)) return;
    reqStartNs.set(request, process.hrtime.bigint());
  });

  app.addHook("onResponse", async (request, reply) => {
    if (shouldSkipHttpMetrics(request)) return;
    const start = reqStartNs.get(request);
    if (start === undefined) return;
    const deltaNs = process.hrtime.bigint() - start;
    const seconds = Number(deltaNs) / 1e9;
    const route = metricsRouteLabel(request);
    recordHttpRequestSample(
      request.method,
      route,
      reply.statusCode,
      seconds,
    );
    const tenant =
      typeof request.tenantExternalKey === "string"
        ? request.tenantExternalKey
        : "_anonymous";
    recordMeteredRequest(tenant, meteringApiFamily(request.url));
  });
}

function shouldSkipHttpMetrics(request: FastifyRequest): boolean {
  const u = request.url.split("?")[0] ?? "";
  if (u === "/internal/metrics" || u.startsWith("/internal/metrics/")) {
    return true;
  }
  return false;
}

export async function renderMetricsText(): Promise<string> {
  if (!registry) return "";
  return registry.metrics();
}
