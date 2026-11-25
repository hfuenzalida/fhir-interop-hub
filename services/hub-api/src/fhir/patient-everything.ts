import type { FastifyRequest } from "fastify";
import type {
  FhirJson,
  PatientEverythingEntry,
} from "./resource-store.js";

export function buildPatientEverythingBundle(
  request: FastifyRequest,
  patientId: string,
  patient: FhirJson | null,
  companion: PatientEverythingEntry[],
): Record<string, unknown> {
  const host = request.headers.host ?? request.hostname;
  const proto =
    request.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ??
    request.protocol;
  const base = `${proto}://${host}`;
  const selfUrl = `${base}${request.url.split("?")[0] ?? request.url}`;
  const entry: Array<{
    fullUrl: string;
    resource: FhirJson;
    search?: { mode: string };
  }> = [];
  if (patient) {
    entry.push({
      fullUrl: `${base}/fhir/Patient/${patientId}`,
      resource: patient,
      search: { mode: "match" },
    });
  }
  for (const { resourceType, resource } of companion) {
    const rid = String((resource as { id?: string }).id ?? "");
    entry.push({
      fullUrl: `${base}/fhir/${resourceType}/${rid}`,
      resource,
      search: { mode: "match" },
    });
  }
  return {
    resourceType: "Bundle",
    id: `everything-${patientId}`,
    type: "searchset",
    total: entry.length,
    link: [{ relation: "self", url: selfUrl }],
    entry,
  };
}
