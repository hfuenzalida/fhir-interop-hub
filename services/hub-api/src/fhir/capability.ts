import { FHIR_VERSION, PHASE1_RESOURCE_TYPES } from "@fhir-hub/shared";

const interactions = [
  { code: "read" as const },
  { code: "search-type" as const },
  { code: "create" as const },
  { code: "update" as const },
  { code: "delete" as const },
];

const searchCommon = [
  {
    name: "_id",
    type: "token",
    documentation: "Logical id of a resource",
  },
  {
    name: "_lastUpdated",
    type: "date",
    documentation: "When the resource was last changed (server last_updated)",
  },
  {
    name: "_sort",
    type: "string",
    documentation: "Sort by last_updated asc/desc",
  },
  {
    name: "_count",
    type: "number",
    documentation: "Page size (max 200)",
  },
  {
    name: "_offset",
    type: "number",
    documentation: "Pagination offset (extension)",
  },
];

function searchParamsFor(type: string): Record<string, unknown>[] {
  const base = [...searchCommon];
  if (type === "Patient") {
    base.push(
      {
        name: "identifier",
        type: "token",
        documentation: "Token search on identifier",
      },
      {
        name: "name",
        type: "string",
        documentation: "Rough match on resource JSON",
      },
      {
        name: "birthdate",
        type: "date",
        documentation: "Exact birthDate string match",
      },
      {
        name: "gender",
        type: "token",
        documentation: "Administrative gender code",
      },
      {
        name: "_include",
        type: "string",
        documentation: 'Supported: `Observation:subject` (max 200 included Observations)',
      },
    );
    return base;
  }
  if (
    type === "Observation" ||
    type === "Condition" ||
    type === "Encounter" ||
    type === "DocumentReference" ||
    type === "Consent"
  ) {
    base.push({
      name: "patient",
      type: "reference",
      documentation: "Patient logical id or Patient/{id}",
    });
    return base;
  }
  return base;
}

export function buildCapabilityStatement(baseUrl: string): Record<string, unknown> {
  const resources = PHASE1_RESOURCE_TYPES.map((type) => {
    const row: Record<string, unknown> = {
      type,
      interaction: [...interactions],
      versioning: "versioned",
      readHistory: false,
      updateCreate: true,
      searchInclude:
        type === "Patient" ? ["Observation:subject"] : [],
      searchRevInclude: [],
      searchParam: searchParamsFor(type),
    };
    if (type === "Patient") {
      row.operation = [
        {
          name: "everything",
          definition:
            "http://hl7.org/fhir/OperationDefinition/Patient-everything",
        },
      ];
    }
    return row;
  });

  return {
    resourceType: "CapabilityStatement",
    id: "fhir-hub-instance",
    url: `${baseUrl}/fhir/metadata`,
    version: "0.1.0",
    name: "FhirInteropHub",
    title: "FHIR Interoperability Hub",
    status: "active",
    experimental: true,
    date: new Date().toISOString(),
    publisher: "fhir-interop-hub",
    kind: "instance",
    software: {
      name: "fhir-interop-hub",
      version: "0.0.0",
    },
    fhirVersion: FHIR_VERSION,
    format: ["application/fhir+json"],
    rest: [
      {
        mode: "server",
        documentation:
          "CRUD + search (GAP-1); ETag/If-Match; US Core–lite validation on REST writes; POST transaction/batch Bundles at /fhir (API key); Patient/$everything; SMART bearer: scoped read + compartment-scoped single-resource writes (GAP-2); optional Consent resource + CONSENT_POLICY_ENABLED purpose checks (see docs).",
        interaction: [
          {
            code: "transaction",
            documentation:
              "POST Bundle (type transaction) to /fhir — atomic; API key required.",
          },
          {
            code: "batch",
            documentation:
              "POST Bundle (type batch) to /fhir — independent entries + per-entry outcomes; API key.",
          },
        ],
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "OAuth",
                  display: "OAuth",
                },
              ],
              text: "API key (full access) and SMART OAuth bearer token (scoped read/write per launch).",
            },
          ],
        },
        resource: resources,
      },
    ],
  };
}
