import { randomUUID } from "node:crypto";
import type { FhirJson } from "../../fhir/resource-store.js";

export type OruMapOk = {
  patient: FhirJson;
  observations: FhirJson[];
  messageControlId?: string;
};

export type OruMapErr = { error: string };

/**
 * Minimal ORU^R01 → Patient + Observation[] for lab-style OBX (value as string).
 * Not a full HL7 engine — deterministic mapping for connector demos / tests.
 */
export function mapOruR01ToFhir(raw: string): OruMapOk | OruMapErr {
  const normalized = raw.replace(/\r\n/g, "\r").replace(/\n/g, "\r");
  const segments = normalized.split("\r").map((s) => s.trim()).filter(Boolean);

  let messageControlId: string | undefined;
  let pidFields: string[] | undefined;
  const obxFieldsList: string[][] = [];

  for (const seg of segments) {
    const fields = seg.split("|");
    const st = fields[0];
    if (st === "MSH" && fields.length > 9) {
      messageControlId = fields[9] || undefined;
    }
    if (st === "PID") pidFields = fields;
    if (st === "OBX") obxFieldsList.push(fields);
  }

  if (!pidFields) {
    return { error: "PID segment not found (required for ORU mapping)" };
  }

  const pid3 = pidFields[3] ?? "";
  const pid5 = pidFields[5] ?? "";
  const idPart = pid3.split("^")[0]?.trim() || "";
  const patientId = idPart.length > 0 ? idPart : randomUUID();

  const nameParts = pid5.split("^");
  const family = (nameParts[0] ?? "").trim() || "Unknown";
  const given = (nameParts[1] ?? "").trim();

  const patient: FhirJson = {
    resourceType: "Patient",
    id: patientId,
    identifier: [
      {
        system: "urn:ietf:rfc:3986",
        value: patientId,
      },
    ],
    name: [{ family, ...(given ? { given: [given] } : {}) }],
  };

  const observations: FhirJson[] = [];
  for (const obx of obxFieldsList) {
    const codeText = (obx[3] ?? "").split("^")[0] || "lab";
    const value = (obx[5] ?? "").trim();
    if (!value) continue;
    observations.push({
      resourceType: "Observation",
      status: "final",
      category: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "laboratory",
            },
          ],
        },
      ],
      code: { text: codeText },
      valueString: value,
      subject: { reference: `Patient/${patientId}` },
    });
  }

  return { patient, observations, messageControlId };
}
