/**
 * Implementation guide targets for v1 (US-centric hub).
 * Refine profiles/value sets as connectors and apps land.
 */
export const FHIR_VERSION = "4.0.1" as const;

/** Primary IG for US interoperability alignment */
export const US_CORE_PACKAGE =
  "hl7.fhir.us.core" as const;

/** Version pin — bump intentionally when conformance tests require it */
export const US_CORE_VERSION = "6.1.0" as const;

export const ONC_API_ALIGNMENT_NOTE =
  "Design APIs and Bulk $export toward ONC §170.315(g)(10) standardized API expectations; validate with program-specific test procedures.";
