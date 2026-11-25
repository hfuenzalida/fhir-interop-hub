import { isPhase1ResourceType } from "@fhir-hub/shared";
import type pg from "pg";
import { isUniqueViolation } from "../db/errors.js";
import { operationOutcome } from "./operation-outcome.js";
import {
  createResource,
  softDeleteResource,
  upsertResource,
  type FhirJson,
  type PgExecutor,
} from "./resource-store.js";
import { validateUsCoreLite } from "./us-core-lite.js";

export const BUNDLE_MAX_ENTRIES = 100;

/** Parses `Bundle.entry.request.url` (Patient, Observation/x, … or absolute URL). */
export function parseTransactionRequestUrl(url: string): {
  type: string;
  id?: string;
} | null {
  if (!url || typeof url !== "string") return null;
  const path = url.trim().split("?")[0] ?? "";
  const segs = path
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  if (segs[0] === "fhir" && segs.length >= 2) {
    if (segs.length === 2) return { type: segs[1]! };
    if (segs.length >= 3) return { type: segs[1]!, id: segs[2]! };
  }
  if (segs.length === 1) return { type: segs[0]! };
  if (segs.length === 2) return { type: segs[0]!, id: segs[1]! };
  return null;
}

export type BatchResponseEntry = {
  response: {
    status: string;
    location?: string;
    outcome?: ReturnType<typeof operationOutcome>;
  };
};

export type FhirBatchOrTransactionResponse = {
  resourceType: "Bundle";
  type: "batch-response";
  entry: BatchResponseEntry[];
};

/** @deprecated Renamed unified type — use {@link FhirBatchOrTransactionResponse}. */
export type TransactionBundleResponse = FhirBatchOrTransactionResponse;

type BundleEntryWire = {
  request?: { method?: string; url?: string };
  resource?: FhirJson;
};

/**
 * Single REST write (POST / PUT / DELETE). Used by transaction + batch bundles.
 */
export async function executeBundleEntryWrite(
  db: PgExecutor,
  tenantUuid: string,
  ent: BundleEntryWire,
): Promise<{ status: string; location?: string }> {
  const req = ent.request;
  const method = String(req?.method ?? "").toUpperCase();
  const urlStr = req?.url;
  if (!req || !method || !urlStr) {
    throw new Error("Each Bundle.entry requires request.method and request.url");
  }

  const parsed = parseTransactionRequestUrl(urlStr);
  if (!parsed || !isPhase1ResourceType(parsed.type)) {
    throw new Error(`Unsupported or invalid request url: ${urlStr}`);
  }
  const resourceType = parsed.type;
  const logicalId = parsed.id;

  if (method === "POST") {
    const res = ent.resource;
    if (!res || typeof res !== "object") {
      throw new Error(`POST ${resourceType}: entry.resource required`);
    }
    if (String(res.resourceType ?? "") !== resourceType) {
      throw new Error(`POST ${resourceType}: resource.resourceType mismatch`);
    }
    const err = validateUsCoreLite(resourceType, res);
    if (err) throw new Error(`POST ${resourceType}: ${err}`);
    try {
      const { resource } = await createResource(db, tenantUuid, resourceType, res);
      const rid = String(resource.id);
      return { status: "201", location: `${resourceType}/${rid}` };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(`Create ${resourceType}: duplicate id`);
      }
      throw err;
    }
  }

  if (method === "PUT") {
    if (!logicalId) {
      throw new Error(`PUT ${resourceType}: url must include logical id`);
    }
    const res = ent.resource;
    if (!res || typeof res !== "object") {
      throw new Error(`PUT ${resourceType}/${logicalId}: entry.resource required`);
    }
    if (String(res.resourceType ?? "") !== resourceType) {
      throw new Error(
        `PUT ${resourceType}/${logicalId}: resource.resourceType mismatch`,
      );
    }
    if (res.id !== undefined && String(res.id) !== logicalId) {
      throw new Error("Resource id must match request URL id");
    }
    const errPut = validateUsCoreLite(resourceType, { ...res, id: logicalId });
    if (errPut) throw new Error(`PUT ${resourceType}/${logicalId}: ${errPut}`);
    const { resource, created } = await upsertResource(
      db,
      tenantUuid,
      resourceType,
      logicalId,
      { ...res, id: logicalId },
    );
    const rid = String(resource.id);
    return {
      status: created ? "201" : "200",
      location: `${resourceType}/${rid}`,
    };
  }

  if (method === "DELETE") {
    if (!logicalId) {
      throw new Error(`DELETE ${resourceType}: url must include logical id`);
    }
    const ok = await softDeleteResource(db, tenantUuid, resourceType, logicalId);
    if (!ok) {
      throw new Error(`DELETE ${resourceType}/${logicalId}: not found`);
    }
    return { status: "204" };
  }

  throw new Error(`Unsupported HTTP method in Bundle: ${method}`);
}

function parseEntries(bundle: FhirJson): BundleEntryWire[] {
  const entries = bundle.entry as BundleEntryWire[] | undefined;
  if (!Array.isArray(entries)) {
    throw new Error("Bundle.entry missing or invalid");
  }
  if (entries.length > BUNDLE_MAX_ENTRIES) {
    throw new Error(`Bundle exceeds ${BUNDLE_MAX_ENTRIES} entries`);
  }
  return entries;
}

/**
 * Atomically executes a FHIR transaction Bundle (single DB transaction).
 */
export async function executeFhirTransactionBundle(
  pool: pg.Pool,
  tenantUuid: string,
  bundle: FhirJson,
): Promise<FhirBatchOrTransactionResponse> {
  if (String(bundle.resourceType) !== "Bundle") {
    throw new Error("Body must be a FHIR Bundle");
  }
  if (String(bundle.type) !== "transaction") {
    throw new Error("Bundle.type must be transaction");
  }

  const entries = parseEntries(bundle);
  if (entries.length === 0) {
    return {
      resourceType: "Bundle",
      type: "batch-response",
      entry: [],
    };
  }

  const out: BatchResponseEntry[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const db = client as PgExecutor;

    for (const ent of entries) {
      const r = await executeBundleEntryWrite(db, tenantUuid, ent);
      out.push({ response: r });
    }

    await client.query("COMMIT");
    return {
      resourceType: "Bundle",
      type: "batch-response",
      entry: out,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Executes a FHIR batch Bundle — each entry commits independently;
 * failures return OperationOutcome on that entry only (HTTP 200 overall).
 */
export async function executeFhirBatchBundle(
  pool: PgExecutor,
  tenantUuid: string,
  bundle: FhirJson,
): Promise<FhirBatchOrTransactionResponse> {
  if (String(bundle.resourceType) !== "Bundle") {
    throw new Error("Body must be a FHIR Bundle");
  }
  if (String(bundle.type) !== "batch") {
    throw new Error("Bundle.type must be batch");
  }

  const entries = parseEntries(bundle);
  const out: BatchResponseEntry[] = [];

  for (const ent of entries) {
    try {
      const r = await executeBundleEntryWrite(pool, tenantUuid, ent);
      out.push({ response: r });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let code: "invalid" | "not-found" | "exception" = "invalid";
      if (msg.includes("not found")) code = "not-found";
      out.push({
        response: {
          status: "400",
          outcome: operationOutcome("error", code, msg),
        },
      });
    }
  }

  return {
    resourceType: "Bundle",
    type: "batch-response",
    entry: out,
  };
}
