import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isPhase1ResourceType, type AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import type { Env } from "../env.js";
import {
  hubAuthActorClientId,
  resolveHubAuth,
  type HubAuth,
} from "../auth/hub-auth.js";
import {
  assertJwtCreateCompartment,
  assertJwtDeleteCompartment,
  assertJwtUpdateCompartment,
  assertJwtWriteScope,
  isSmartJwtRestWritePath,
} from "../auth/smart-jwt-fhir.js";
import {
  jwtNeedsPatientCompartment,
  scopeAllowsPatientResource,
} from "../auth/smart-scopes.js";
import { isUniqueViolation } from "../db/errors.js";
import { operationOutcome } from "./operation-outcome.js";
import {
  evaluateConsentForRequest,
  extractPatientLogicalIdFromCreateBody,
  extractPatientLogicalIdFromResource,
  isConsentBootstrapWrite,
} from "./consent-policy.js";
import { registerConsentPolicyPreHandler } from "./consent-pre-hook.js";
import type { FhirJson, PgExecutor } from "./resource-store.js";
import { buildPatientEverythingBundle } from "./patient-everything.js";
import {
  createResource,
  loadPatientEverything,
  patientReferenceMatches,
  readResource,
  searchGeneric,
  searchPatients,
  searchResourcesWithPatientSubject,
  subjectReferencesPatient,
  softDeleteResource,
  IfMatchFailedError,
  upsertResource,
} from "./resource-store.js";
import {
  getStringParam,
  parseIdParams,
  parseIncludeParam,
  parseLastUpdatedFilter,
  parsePatientReference,
  parseSearchPagination,
  parseSortLastUpdated,
} from "./query-params.js";
import { validateUsCoreLite } from "./us-core-lite.js";
import {
  executeFhirBatchBundle,
  executeFhirTransactionBundle,
} from "./transaction-bundle.js";

function fhirReply(reply: FastifyReply, code: number, body: unknown) {
  return reply.code(code).type("application/fhir+json").send(body);
}

function setEtag(reply: FastifyReply, resource: FhirJson) {
  const meta = resource.meta as { versionId?: string } | undefined;
  const vid = meta?.versionId;
  if (typeof vid === "string" && vid.length > 0) {
    reply.header("ETag", `W/"${vid}"`);
  }
}

function parseIfMatchHeader(h: string | undefined): string | null {
  if (!h) return null;
  const first = h.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^W\//i, "").replace(/"/g, "").trim();
}

function searchExtras(q: Record<string, unknown>) {
  return {
    lastUpdated: parseLastUpdatedFilter(q),
    sortLastUpdated: parseSortLastUpdated(q),
  };
}

/** Resources with `subject` → Patient for `?patient=` search. */
function supportsPatientSearchParam(resourceType: string): boolean {
  return (
    resourceType === "Observation" ||
    resourceType === "Condition" ||
    resourceType === "Encounter" ||
    resourceType === "DocumentReference" ||
    resourceType === "Consent"
  );
}

const INCLUDE_CAP = 200;

async function appendObservationIncludesForPatients(
  pool: PgExecutor,
  tenant: string,
  base: string,
  patients: FhirJson[],
): Promise<
  { fullUrl: string; resource: FhirJson; search: { mode: string } }[]
> {
  const extra: {
    fullUrl: string;
    resource: FhirJson;
    search: { mode: string };
  }[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const pat of patients) {
    const pid = String((pat as { id?: string }).id ?? "");
    if (!pid) continue;
    const { rows } = await searchResourcesWithPatientSubject(
      pool,
      tenant,
      "Observation",
      pid,
      { limit: 50, offset: 0, sortLastUpdated: "desc" },
    );
    for (const obs of rows) {
      if (n >= INCLUDE_CAP) return extra;
      const oid = String((obs as { id?: string }).id ?? "");
      const key = `Observation/${oid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      extra.push({
        fullUrl: `${base}/fhir/Observation/${oid}`,
        resource: obs,
        search: { mode: "include" },
      });
      n++;
    }
  }
  return extra;
}

/** Host + port for Bundle links (`request.hostname` omits port; prefer `Host` header). */
function requestPublicBase(request: FastifyRequest): string {
  const host = request.headers.host ?? request.hostname;
  const proto =
    request.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ??
    request.protocol;
  return `${proto}://${host}`;
}

function isFhirContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const c = contentType.toLowerCase();
  return (
    c.includes("application/fhir+json") || c.includes("application/json+fhir")
  );
}

function audit(
  sink: AuditSink,
  request: FastifyRequest | undefined,
  input: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  return emitAudit(sink, request, input);
}

function actorFromHubAuth(auth: HubAuth): AuditEvent["actor"] {
  return {
    tenantId: auth.externalKey,
    clientId: hubAuthActorClientId(auth),
    role: "integration",
  };
}

function smartJwtHasPatient(auth: HubAuth): auth is HubAuth & {
  kind: "jwt";
  patient: string;
} {
  return auth.kind === "jwt" && typeof auth.patient === "string";
}

/** Observation, Condition, Encounter, DocumentReference — SMART read via patient compartment. */
const JWT_COMPARTMENT_RESOURCE_TYPES = [
  "Observation",
  "Condition",
  "Encounter",
  "DocumentReference",
  "Consent",
] as const;

function isJwtCompartmentResourceType(rt: string): boolean {
  return (
    rt === "Patient" ||
    (JWT_COMPARTMENT_RESOURCE_TYPES as readonly string[]).includes(rt)
  );
}

export async function registerFhirRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const writePool = app.pg!;
  const readPool = app.pgRead ?? writePool;
  const sink = app.auditSink;
  if (!writePool || !sink) {
    throw new Error(
      "registerFhirRoutes requires DATABASE_URL (pg pool and audit sink).",
    );
  }
  const { env } = opts;

  await app.register(
    async (secured) => {
      secured.addHook(
        "preHandler",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const resolved = await resolveHubAuth(
            writePool,
            env,
            request.headers.authorization,
            request.headers["x-hub-api-key"]?.toString(),
          );
          if (!resolved) {
            await audit(sink, request, {
              action: "EXECUTE",
              outcome: "failure",
              actor: {
                tenantId: "unknown",
                clientId: "api-key",
                role: "integration",
              },
              entity: { type: "Security" },
              api: { method: request.method, path: request.url },
              network: { requestId: request.id },
              detail: "Missing or invalid API credentials",
            });
            return fhirReply(
              reply,
              401,
              operationOutcome(
                "error",
                "security",
                "Missing or invalid API credentials.",
              ),
            );
          }
          request.hubAuth = resolved;
          request.tenantUuid = resolved.tenantUuid;
          request.tenantExternalKey = resolved.externalKey;

          if (resolved.kind === "jwt") {
            if (!["GET", "HEAD"].includes(request.method)) {
              const url = request.url ?? "";
              if (!isSmartJwtRestWritePath(url, request.method)) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome(
                    "error",
                    "security",
                    "SMART access token cannot perform this operation (use single-resource POST/PUT/DELETE or read-only Bundle rules).",
                  ),
                );
              }
            }
            if (
              jwtNeedsPatientCompartment(resolved.scopes) &&
              !resolved.patient
            ) {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  "Token is missing required patient launch context.",
                ),
              );
            }
          }
        },
      );

      registerConsentPolicyPreHandler(secured, readPool, env, sink);

      secured.get("/Patient/:id/\u0024everything", async (request, reply) => {
        const { id: patientId } = request.params as { id: string };
        const auth = request.hubAuth!;
        const tenant = request.tenantUuid!;
        const actor = actorFromHubAuth(auth);
        const q = request.query as Record<string, unknown>;
        const rawC = parseInt(String(q["_count"] ?? "100"), 10);
        const perTypeLimit = Math.min(
          200,
          Math.max(1, Number.isFinite(rawC) ? rawC : 100),
        );

        if (auth.kind === "jwt") {
          if (!smartJwtHasPatient(auth)) {
            return fhirReply(
              reply,
              403,
              operationOutcome(
                "error",
                "security",
                "Patient compartment required.",
              ),
            );
          }
          if (!scopeAllowsPatientResource(auth.scopes, "Patient", "read")) {
            return fhirReply(
              reply,
              403,
              operationOutcome(
                "error",
                "security",
                "Insufficient scope for Patient.",
              ),
            );
          }
          if (patientId !== auth.patient) {
            return fhirReply(
              reply,
              404,
              operationOutcome("error", "not-found", "Resource not found."),
            );
          }
        }

        if (env.CONSENT_POLICY_ENABLED) {
          const ce = await evaluateConsentForRequest(
            readPool,
            env,
            request,
            tenant,
            patientId,
          );
          if (!ce.ok) {
            await audit(sink, request, {
              action: "READ",
              outcome: "failure",
              actor,
              entity: { type: "Patient", id: patientId },
              api: { method: "GET", path: request.url },
              network: { requestId: request.id },
              detail: ce.reason,
            });
            return fhirReply(
              reply,
              403,
              operationOutcome("error", "security", ce.reason),
            );
          }
        }

        const full = await loadPatientEverything(readPool, tenant, patientId, {
          perTypeLimit,
        });

        if (!full.patient) {
          await audit(sink, request, {
            action: "READ",
            outcome: "failure",
            actor,
            entity: { type: "Patient", id: patientId },
            api: { method: "GET", path: request.url },
            network: { requestId: request.id },
            detail: "Patient not found ($everything)",
          });
          return fhirReply(
            reply,
            404,
            operationOutcome("error", "not-found", "Patient not found."),
          );
        }

        let companion = full.companion;
        if (auth.kind === "jwt") {
          companion = companion.filter(({ resourceType }) =>
            scopeAllowsPatientResource(auth.scopes, resourceType, "read"),
          );
        }

        await audit(sink, request, {
          action: "READ",
          outcome: "success",
          actor,
          entity: { type: "Patient", id: patientId },
          api: { method: "GET", path: request.url },
          network: { requestId: request.id },
          detail: `Patient/\u0024everything companions=${companion.length}`,
        });

        return fhirReply(
          reply,
          200,
          buildPatientEverythingBundle(
            request,
            patientId,
            full.patient,
            companion,
          ),
        );
      });

      secured.get("/:resourceType/:id", async (request, reply) => {
          const { resourceType, id } = request.params as {
            resourceType: string;
            id: string;
          };
          if (!isPhase1ResourceType(resourceType)) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                `Unsupported resource type: ${resourceType}`,
              ),
            );
          }
          const auth = request.hubAuth!;
          const tenant = request.tenantUuid!;
          const actor = actorFromHubAuth(auth);

          if (auth.kind === "jwt") {
            if (!smartJwtHasPatient(auth)) {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  "Patient compartment required.",
                ),
              );
            }
            const pid = auth.patient;
            if (resourceType === "Patient") {
              if (!scopeAllowsPatientResource(auth.scopes, "Patient", "read")) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome(
                    "error",
                    "security",
                    "Insufficient scope for Patient.",
                  ),
                );
              }
              if (id !== pid) {
                return fhirReply(
                  reply,
                  404,
                  operationOutcome("error", "not-found", "Resource not found."),
                );
              }
            } else if (
              (JWT_COMPARTMENT_RESOURCE_TYPES as readonly string[]).includes(
                resourceType,
              )
            ) {
              if (
                !scopeAllowsPatientResource(auth.scopes, resourceType, "read")
              ) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome(
                    "error",
                    "security",
                    `Insufficient scope for ${resourceType}.`,
                  ),
                );
              }
            } else {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  `SMART token cannot access ${resourceType} in this phase.`,
                ),
              );
            }
          }

          const row = await readResource(readPool, tenant, resourceType, id);
          if (!row) {
            await audit(sink, request, {
              action: "READ",
              outcome: "failure",
              actor,
              entity: {
                type: resourceType,
                id,
                patientId: resourceType === "Patient" ? id : undefined,
              },
              api: { method: "GET", path: request.url },
              network: { requestId: request.id },
              detail: "Not found",
            });
            return fhirReply(
              reply,
              404,
              operationOutcome("error", "not-found", "Resource not found."),
            );
          }

          if (
            auth.kind === "jwt" &&
            resourceType !== "Patient" &&
            (JWT_COMPARTMENT_RESOURCE_TYPES as readonly string[]).includes(
              resourceType,
            )
          ) {
            const inCompartment =
              resourceType === "Consent"
                ? patientReferenceMatches(row, auth.patient!)
                : subjectReferencesPatient(row, auth.patient!);
            if (!inCompartment) {
              await audit(sink, request, {
                action: "READ",
                outcome: "failure",
                actor,
                entity: { type: resourceType, id },
                api: { method: "GET", path: request.url },
                network: { requestId: request.id },
                detail: "Resource outside patient compartment",
              });
              return fhirReply(
                reply,
                404,
                operationOutcome("error", "not-found", "Resource not found."),
              );
            }
          }

          if (env.CONSENT_POLICY_ENABLED && auth.kind === "api-key") {
            const pid = extractPatientLogicalIdFromResource(
              resourceType,
              id,
              row,
            );
            if (pid) {
              const ce = await evaluateConsentForRequest(
                readPool,
                env,
                request,
                tenant,
                pid,
              );
              if (!ce.ok) {
                await audit(sink, request, {
                  action: "READ",
                  outcome: "failure",
                  actor,
                  entity: { type: resourceType, id },
                  api: { method: "GET", path: request.url },
                  network: { requestId: request.id },
                  detail: ce.reason,
                });
                return fhirReply(
                  reply,
                  403,
                  operationOutcome("error", "security", ce.reason),
                );
              }
            }
          }

          await audit(sink, request, {
            action: "READ",
            outcome: "success",
            actor,
            entity: {
              type: resourceType,
              id,
              patientId: resourceType === "Patient" ? id : undefined,
            },
            api: { method: "GET", path: request.url },
            network: { requestId: request.id },
          });
          setEtag(reply, row);
          return fhirReply(reply, 200, row);
        });

        secured.get("/:resourceType", async (request, reply) => {
          const { resourceType } = request.params as { resourceType: string };
          if (!isPhase1ResourceType(resourceType)) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                `Unsupported resource type: ${resourceType}`,
              ),
            );
          }
          const auth = request.hubAuth!;
          const actor = actorFromHubAuth(auth);

          if (auth.kind === "jwt") {
            if (!smartJwtHasPatient(auth)) {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  "Patient compartment required.",
                ),
              );
            }
            const pid = auth.patient;
            if (!isJwtCompartmentResourceType(resourceType)) {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  `SMART token cannot search ${resourceType} in this phase.`,
                ),
              );
            }
            if (resourceType === "Patient") {
              if (!scopeAllowsPatientResource(auth.scopes, "Patient", "read")) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome(
                    "error",
                    "security",
                    "Insufficient scope for Patient.",
                  ),
                );
              }
            } else if (
              !scopeAllowsPatientResource(auth.scopes, resourceType, "read")
            ) {
              return fhirReply(
                reply,
                403,
                operationOutcome(
                  "error",
                  "security",
                  `Insufficient scope for ${resourceType}.`,
                ),
              );
            }

            const q = request.query as Record<string, unknown>;
            const { limit, offset } = parseSearchPagination(q);
            const extras = searchExtras(q);
            const tenant = request.tenantUuid!;
            let rows: FhirJson[];
            let total: number;
            if (resourceType === "Patient") {
              const r = await searchPatients(readPool, tenant, {
                ids: [pid],
                limit,
                offset,
                ...extras,
              });
              rows = r.rows;
              total = r.total;
            } else {
              const r = await searchResourcesWithPatientSubject(
                readPool,
                tenant,
                resourceType,
                pid,
                {
                  limit,
                  offset,
                  ...extras,
                },
              );
              rows = r.rows;
              total = r.total;
            }
            const base = requestPublicBase(request);
            const selfUrl = `${base}${request.url}`;
            let entry: {
              fullUrl: string;
              resource: FhirJson;
              search: { mode: string };
            }[] = rows.map((res) => ({
              fullUrl: `${base}/fhir/${resourceType}/${String((res as { id?: string }).id)}`,
              resource: res,
              search: { mode: "match" },
            }));
            const inc = parseIncludeParam(q);
            const wantObsSubject = inc.some(
              (i) => i.type === "Observation" && i.param === "subject",
            );
            if (
              resourceType === "Patient" &&
              wantObsSubject &&
              scopeAllowsPatientResource(auth.scopes, "Observation", "read")
            ) {
              const incl = await appendObservationIncludesForPatients(
                readPool,
                tenant,
                base,
                rows,
              );
              entry = [...entry, ...incl];
            }
            await audit(sink, request, {
              action: "READ",
              outcome: "success",
              actor,
              entity: { type: resourceType },
              api: { method: "GET", path: request.url },
              network: { requestId: request.id },
              detail: `search total=${total} smart`,
            });
            return fhirReply(reply, 200, {
              resourceType: "Bundle",
              type: "searchset",
              total,
              link: [{ relation: "self", url: selfUrl }],
              entry,
            });
          }

          const q = request.query as Record<string, unknown>;
          const { limit, offset } = parseSearchPagination(q);
          const ids = parseIdParams(q);
          const extras = searchExtras(q);
          const tenant = request.tenantUuid!;

          let rows: FhirJson[];
          let total: number;
          const patientRef = parsePatientReference(getStringParam(q, "patient"));

          if (
            env.CONSENT_POLICY_ENABLED &&
            auth.kind === "api-key" &&
            patientRef !== null &&
            supportsPatientSearchParam(resourceType)
          ) {
            const ce = await evaluateConsentForRequest(
              readPool,
              env,
              request,
              tenant,
              patientRef,
            );
            if (!ce.ok) {
              await audit(sink, request, {
                action: "READ",
                outcome: "failure",
                actor,
                entity: { type: resourceType },
                api: { method: "GET", path: request.url },
                network: { requestId: request.id },
                detail: ce.reason,
              });
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", ce.reason),
              );
            }
          }

          if (
            supportsPatientSearchParam(resourceType) &&
            patientRef !== null
          ) {
            const r = await searchResourcesWithPatientSubject(
              readPool,
              tenant,
              resourceType,
              patientRef,
              {
                limit,
                offset,
                ...extras,
              },
            );
            rows = r.rows;
            total = r.total;
          } else if (resourceType === "Patient") {
            const name = getStringParam(q, "name");
            const birthdate = getStringParam(q, "birthdate")?.replace(
              /^eq/i,
              "",
            );
            const identifier = getStringParam(q, "identifier");
            const gender = getStringParam(q, "gender");
            const r = await searchPatients(readPool, tenant, {
              ids,
              name,
              birthdate,
              identifier,
              gender,
              limit,
              offset,
              ...extras,
            });
            rows = r.rows;
            total = r.total;
          } else {
            const r = await searchGeneric(readPool, tenant, resourceType, {
              ids,
              limit,
              offset,
              ...extras,
            });
            rows = r.rows;
            total = r.total;
          }

          const base = requestPublicBase(request);
          const selfUrl = `${base}${request.url}`;
          let entry: {
            fullUrl: string;
            resource: FhirJson;
            search: { mode: string };
          }[] = rows.map((res) => ({
            fullUrl: `${base}/fhir/${resourceType}/${String((res as { id?: string }).id)}`,
            resource: res,
            search: { mode: "match" },
          }));
          const inc = parseIncludeParam(q);
          const wantObsSubject = inc.some(
            (i) => i.type === "Observation" && i.param === "subject",
          );
          if (resourceType === "Patient" && wantObsSubject) {
            const incl = await appendObservationIncludesForPatients(
              readPool,
              tenant,
              base,
              rows,
            );
            entry = [...entry, ...incl];
          }

          await audit(sink, request, {
            action: "READ",
            outcome: "success",
            actor: actorFromHubAuth(auth),
            entity: { type: resourceType },
            api: { method: "GET", path: request.url },
            network: { requestId: request.id },
            detail: `search total=${total}`,
          });

          return fhirReply(reply, 200, {
            resourceType: "Bundle",
            type: "searchset",
            total,
            link: [{ relation: "self", url: selfUrl }],
            entry,
          });
        });

        secured.post("/", async (request, reply) => {
          const auth = request.hubAuth!;
          if (auth.kind === "jwt") {
            return fhirReply(
              reply,
              403,
              operationOutcome(
                "error",
                "security",
                "SMART access tokens cannot execute FHIR transaction or batch bundles.",
              ),
            );
          }
          if (!isFhirContentType(request.headers["content-type"])) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                "Content-Type must be application/fhir+json (or equivalent).",
              ),
            );
          }
          const body = request.body as FhirJson | undefined;
          if (!body || typeof body !== "object") {
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", "Expected JSON object body."),
            );
          }
          if (String(body.resourceType) !== "Bundle") {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                "POST /fhir expects a Bundle (type transaction or batch), or POST /fhir/{type} for a single resource.",
              ),
            );
          }
          const tenant = request.tenantUuid!;
          const bundleType = String(body.type ?? "");
          try {
            if (bundleType === "batch") {
              const result = await executeFhirBatchBundle(writePool, tenant, body);
              const failures = result.entry.filter((e) => e.response.outcome).length;
              await audit(sink, request, {
                action: "EXECUTE",
                outcome:
                  failures === 0
                    ? "success"
                    : failures === result.entry.length
                      ? "failure"
                      : "partial",
                actor: actorFromHubAuth(auth),
                entity: { type: "Bundle" },
                api: { method: "POST", path: request.url },
                network: { requestId: request.id },
                detail: `batch bundle entries=${result.entry.length} failures=${failures}`,
              });
              return fhirReply(reply, 200, result);
            }
            if (bundleType === "transaction") {
              const result = await executeFhirTransactionBundle(writePool, tenant, body);
              await audit(sink, request, {
                action: "EXECUTE",
                outcome: "success",
                actor: actorFromHubAuth(auth),
                entity: { type: "Bundle" },
                api: { method: "POST", path: request.url },
                network: { requestId: request.id },
                detail: `transaction bundle entries=${result.entry.length}`,
              });
              return fhirReply(reply, 200, result);
            }
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                "Bundle.type must be transaction or batch.",
              ),
            );
          } catch (err) {
            if (isUniqueViolation(err)) {
              return fhirReply(
                reply,
                409,
                operationOutcome(
                  "error",
                  "invalid",
                  "Transaction failed: duplicate resource id.",
                ),
              );
            }
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.toLowerCase().includes("duplicate")) {
              return fhirReply(
                reply,
                409,
                operationOutcome("error", "invalid", msg),
              );
            }
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", msg),
            );
          }
        });

        secured.post("/:resourceType", async (request, reply) => {
          const { resourceType } = request.params as { resourceType: string };
          if (!isPhase1ResourceType(resourceType)) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                `Unsupported resource type: ${resourceType}`,
              ),
            );
          }
          if (!isFhirContentType(request.headers["content-type"])) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                "Content-Type must be application/fhir+json (or equivalent).",
              ),
            );
          }
          const body = request.body as FhirJson | undefined;
          if (!body || typeof body !== "object") {
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", "Expected JSON object body."),
            );
          }
          if (String(body.resourceType) !== resourceType) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                `resourceType must be ${resourceType}`,
              ),
            );
          }
          const tenant = request.tenantUuid!;
          const auth = request.hubAuth!;
          const valErr = validateUsCoreLite(resourceType, body);
          if (valErr) {
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", valErr),
            );
          }
          if (auth.kind === "jwt") {
            const wErr = assertJwtWriteScope(auth, resourceType);
            if (wErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", wErr),
              );
            }
            const cErr = assertJwtCreateCompartment(auth, resourceType, body);
            if (cErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", cErr),
              );
            }
          }
          let createPayload = body;
          if (auth.kind === "jwt" && resourceType === "Patient") {
            createPayload = {
              ...body,
              id: auth.patient,
            };
          }
          if (
            env.CONSENT_POLICY_ENABLED &&
            !isConsentBootstrapWrite("POST", resourceType)
          ) {
            const pid = extractPatientLogicalIdFromCreateBody(
              resourceType,
              createPayload,
            );
            if (pid) {
              const ce = await evaluateConsentForRequest(
                readPool,
                env,
                request,
                tenant,
                pid,
              );
              if (!ce.ok) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome("error", "security", ce.reason),
                );
              }
            }
          }
          try {
            const { resource } = await createResource(
              writePool,
              tenant,
              resourceType,
              createPayload,
            );
            const rid = String(resource.id);
            await audit(sink, request, {
              action: "CREATE",
              outcome: "success",
              actor: actorFromHubAuth(auth),
              entity: {
                type: resourceType,
                id: rid,
                patientId: resourceType === "Patient" ? rid : undefined,
              },
              api: { method: "POST", path: request.url },
              network: { requestId: request.id },
            });
            const loc = `${request.protocol}://${request.hostname}/fhir/${resourceType}/${rid}`;
            reply.header("Location", loc);
            setEtag(reply, resource);
            return fhirReply(reply, 201, resource);
          } catch (err) {
            if (isUniqueViolation(err)) {
              return fhirReply(
                reply,
                409,
                operationOutcome(
                  "error",
                  "invalid",
                  "Resource with this id already exists.",
                ),
              );
            }
            throw err;
          }
        });

        secured.put("/:resourceType/:id", async (request, reply) => {
          const { resourceType, id } = request.params as {
            resourceType: string;
            id: string;
          };
          if (!isPhase1ResourceType(resourceType)) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                `Unsupported resource type: ${resourceType}`,
              ),
            );
          }
          if (!isFhirContentType(request.headers["content-type"])) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                "Content-Type must be application/fhir+json (or equivalent).",
              ),
            );
          }
          const body = request.body as FhirJson | undefined;
          if (!body || typeof body !== "object") {
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", "Expected JSON object body."),
            );
          }
          if (String(body.resourceType) !== resourceType) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                `resourceType must be ${resourceType}`,
              ),
            );
          }
          if (body.id !== undefined && String(body.id) !== id) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "invalid",
                "Resource id must match URL path id.",
              ),
            );
          }
          const tenant = request.tenantUuid!;
          const auth = request.hubAuth!;
          const valErr = validateUsCoreLite(resourceType, { ...body, id });
          if (valErr) {
            return fhirReply(
              reply,
              400,
              operationOutcome("error", "invalid", valErr),
            );
          }
          if (auth.kind === "jwt") {
            const wErr = assertJwtWriteScope(auth, resourceType);
            if (wErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", wErr),
              );
            }
            const uErr = assertJwtUpdateCompartment(auth, resourceType, id, {
              ...body,
              id,
            });
            if (uErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", uErr),
              );
            }
          }
          if (
            env.CONSENT_POLICY_ENABLED &&
            !isConsentBootstrapWrite("PUT", resourceType)
          ) {
            const pid = extractPatientLogicalIdFromCreateBody(resourceType, {
              ...body,
              id,
            });
            if (pid) {
              const ce = await evaluateConsentForRequest(
                readPool,
                env,
                request,
                tenant,
                pid,
              );
              if (!ce.ok) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome("error", "security", ce.reason),
                );
              }
            }
          }
          const rawIfMatch = request.headers["if-match"];
          const ifMatch =
            typeof rawIfMatch === "string"
              ? parseIfMatchHeader(rawIfMatch)
              : null;
          let resource: FhirJson;
          let created: boolean;
          try {
            const out = await upsertResource(
              writePool,
              tenant,
              resourceType,
              id,
              { ...body, id },
              { ifMatch },
            );
            resource = out.resource;
            created = out.created;
          } catch (e) {
            if (e instanceof IfMatchFailedError) {
              return fhirReply(
                reply,
                412,
                operationOutcome(
                  "error",
                  "processing",
                  "If-Match does not match current resource version.",
                ),
              );
            }
            throw e;
          }
          await audit(sink, request, {
            action: created ? "CREATE" : "UPDATE",
            outcome: "success",
            actor: actorFromHubAuth(auth),
            entity: {
              type: resourceType,
              id,
              patientId: resourceType === "Patient" ? id : undefined,
            },
            api: { method: "PUT", path: request.url },
            network: { requestId: request.id },
          });
          setEtag(reply, resource);
          return fhirReply(reply, created ? 201 : 200, resource);
        });

        secured.delete("/:resourceType/:id", async (request, reply) => {
          const { resourceType, id } = request.params as {
            resourceType: string;
            id: string;
          };
          if (!isPhase1ResourceType(resourceType)) {
            return fhirReply(
              reply,
              400,
              operationOutcome(
                "error",
                "not-supported",
                `Unsupported resource type: ${resourceType}`,
              ),
            );
          }
          const tenant = request.tenantUuid!;
          const auth = request.hubAuth!;
          const existing = await readResource(readPool, tenant, resourceType, id);
          if (!existing) {
            return fhirReply(
              reply,
              404,
              operationOutcome("error", "not-found", "Resource not found."),
            );
          }
          if (auth.kind === "jwt") {
            const wErr = assertJwtWriteScope(auth, resourceType);
            if (wErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", wErr),
              );
            }
            const dErr = assertJwtDeleteCompartment(
              auth,
              resourceType,
              id,
              existing,
            );
            if (dErr) {
              return fhirReply(
                reply,
                403,
                operationOutcome("error", "security", dErr),
              );
            }
          }
          if (env.CONSENT_POLICY_ENABLED && auth.kind === "api-key") {
            const pid = extractPatientLogicalIdFromResource(
              resourceType,
              id,
              existing,
            );
            if (pid) {
              const ce = await evaluateConsentForRequest(
                readPool,
                env,
                request,
                tenant,
                pid,
              );
              if (!ce.ok) {
                return fhirReply(
                  reply,
                  403,
                  operationOutcome("error", "security", ce.reason),
                );
              }
            }
          }
          const ok = await softDeleteResource(writePool, tenant, resourceType, id);
          if (!ok) {
            return fhirReply(
              reply,
              404,
              operationOutcome("error", "not-found", "Resource not found."),
            );
          }
          await audit(sink, request, {
            action: "DELETE",
            outcome: "success",
            actor: actorFromHubAuth(auth),
            entity: {
              type: resourceType,
              id,
              patientId: resourceType === "Patient" ? id : undefined,
            },
            api: { method: "DELETE", path: request.url },
            network: { requestId: request.id },
          });
          return reply.code(204).send();
        });
    },
    { prefix: "/fhir" },
  );
}
