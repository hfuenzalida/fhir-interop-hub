import { isPhase1ResourceType } from "@fhir-hub/shared";
import type pg from "pg";
import {
  createResource,
  upsertResource,
  type FhirJson,
} from "../fhir/resource-store.js";

export type BundleIngestResult = {
  processed: number;
  failed: number;
  errors: string[];
};

/**
 * Ingest FHIR Bundle (batch | collection | transaction-style entries).
 * Each entry.resource is upserted when `id` present, else created.
 */
export async function ingestFhirBundle(
  pool: pg.Pool,
  tenantUuid: string,
  bundle: FhirJson,
): Promise<BundleIngestResult> {
  if (bundle.resourceType !== "Bundle") {
    throw new Error("Body must be a FHIR Bundle");
  }
  const bType = String(bundle.type ?? "");
  if (!["batch", "collection", "transaction"].includes(bType)) {
    throw new Error(
      `Bundle.type must be batch, collection, or transaction (got ${bType})`,
    );
  }
  const entries = bundle.entry as
    | Array<{ resource?: FhirJson; fullUrl?: string }>
    | undefined;
  if (!Array.isArray(entries)) {
    return { processed: 0, failed: 0, errors: ["Bundle.entry missing or invalid"] };
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const ent of entries) {
    const res = ent.resource;
    if (!res || typeof res !== "object") {
      failed++;
      errors.push("entry without resource");
      continue;
    }
    const rt = String(res.resourceType ?? "");
    if (!isPhase1ResourceType(rt)) {
      failed++;
      errors.push(`unsupported resourceType: ${rt}`);
      continue;
    }
    try {
      const id = typeof res.id === "string" && res.id.length > 0 ? res.id : undefined;
      if (id) {
        await upsertResource(pool, tenantUuid, rt, id, res);
      } else {
        await createResource(pool, tenantUuid, rt, res);
      }
      processed++;
    } catch (e) {
      failed++;
      errors.push(
        `${rt}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { processed, failed, errors };
}
