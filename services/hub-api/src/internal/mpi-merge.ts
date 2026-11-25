import { randomUUID } from "node:crypto";
import type pg from "pg";
import { PHASE1_RESOURCE_TYPES } from "@fhir-hub/shared";
import {
  createResource,
  readResource,
  softDeleteResource,
  type FhirJson,
} from "../fhir/resource-store.js";
import { remapPatientReferencesDeep } from "../fhir/reference-remap.js";
import { insertPatientLink } from "./mpi.js";

function nowIso(): string {
  return new Date().toISOString();
}

function bumpVersionMeta(
  data: FhirJson,
  logicalId: string,
  versionId: number,
): FhirJson {
  const meta =
    typeof data.meta === "object" && data.meta !== null
      ? { ...(data.meta as Record<string, unknown>) }
      : {};
  return {
    ...data,
    id: logicalId,
    meta: {
      ...meta,
      versionId: String(versionId),
      lastUpdated: nowIso(),
    },
  };
}

function buildMergeProvenance(params: {
  survivorPatientLogicalId: string;
  duplicatePatientLogicalId: string;
}): FhirJson {
  const id = randomUUID();
  return {
    resourceType: "Provenance",
    id,
    target: [
      { reference: `Patient/${params.survivorPatientLogicalId}` },
      { reference: `Patient/${params.duplicatePatientLogicalId}` },
    ],
    recorded: nowIso(),
    activity: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
            code: "UPDATE",
            display: "update",
          },
        ],
      },
    ],
    agent: [
      {
        type: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
              code: "assembler",
            },
          ],
        },
        who: {
          display: "hub mpi-merge",
        },
      },
    ],
    reason: [
      {
        text: `Automated duplicate Patient merge: canonical Patient/${params.survivorPatientLogicalId} replaced Patient/${params.duplicatePatientLogicalId}.`,
      },
    ],
  };
}

export type PatientMergeInput = {
  survivorPatientLogicalId: string;
  duplicatePatientLogicalId: string;
  rewriteReferences: boolean;
  softDeleteDuplicate: boolean;
};

export type PatientMergeResult = {
  provenanceLogicalId: string;
  referencesUpdated: number;
};

/**
 * Records MPI link, writes Provenance, optionally rewrites Patient references
 * across Phase 1 resources, optionally soft-deletes the duplicate Patient.
 */
export async function executePatientMerge(
  pool: pg.Pool,
  tenantUuid: string,
  input: PatientMergeInput,
): Promise<PatientMergeResult> {
  const sur = input.survivorPatientLogicalId.trim();
  const dup = input.duplicatePatientLogicalId.trim();
  if (!sur || !dup || sur === dup) {
    throw new Error("invalid_merge_ids");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const survivor = await readResource(client, tenantUuid, "Patient", sur);
    const duplicate = await readResource(client, tenantUuid, "Patient", dup);
    if (!survivor || !duplicate) {
      throw new Error("patient_not_found");
    }

    const pairLeft = sur < dup ? sur : dup;
    const pairRight = sur < dup ? dup : sur;

    await insertPatientLink(
      client,
      tenantUuid,
      pairLeft,
      pairRight,
      "replaced-by",
      "automated-merge",
    );

    const provBody = buildMergeProvenance({
      survivorPatientLogicalId: sur,
      duplicatePatientLogicalId: dup,
    });
    const created = await createResource(
      client,
      tenantUuid,
      "Provenance",
      provBody,
    );
    const provenanceLogicalId =
      typeof created.resource.id === "string"
        ? created.resource.id
        : randomUUID();

    let referencesUpdated = 0;

    if (input.rewriteReferences) {
      const types = PHASE1_RESOURCE_TYPES as readonly string[];
      for (const rt of types) {
        const likePat = `%Patient/${dup}%`;
        const r = await client.query<{
          logical_id: string;
          version_id: number;
          data: FhirJson;
        }>(
          `SELECT logical_id, version_id, data FROM fhir_resource
           WHERE tenant_id = $1::uuid AND resource_type = $2 AND NOT deleted
             AND data::text LIKE $3`,
          [tenantUuid, rt, likePat],
        );
        for (const row of r.rows) {
          const copy = structuredClone(row.data) as FhirJson;
          remapPatientReferencesDeep(copy, dup, sur);
          if (JSON.stringify(copy) === JSON.stringify(row.data)) continue;
          const nextVid = row.version_id + 1;
          const stamped = bumpVersionMeta(copy, row.logical_id, nextVid);
          await client.query(
            `UPDATE fhir_resource
             SET version_id = $4, data = $5::jsonb, last_updated = NOW()
             WHERE tenant_id = $1::uuid AND resource_type = $2 AND logical_id = $3 AND NOT deleted`,
            [
              tenantUuid,
              rt,
              row.logical_id,
              nextVid,
              JSON.stringify(stamped),
            ],
          );
          referencesUpdated++;
        }
      }
    }

    if (input.softDeleteDuplicate) {
      const ok = await softDeleteResource(client, tenantUuid, "Patient", dup);
      if (!ok) {
        throw new Error("soft_delete_failed");
      }
    }

    await client.query("COMMIT");
    return { provenanceLogicalId, referencesUpdated };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
