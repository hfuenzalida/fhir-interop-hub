import type { FhirJson } from "./resource-store.js";

/** Per-resource-type map from exported/source logical id → tenant-local id. */
export type RemapByType = Partial<Record<string, Record<string, string>>>;

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveRemappedId(
  resourceType: string,
  logicalId: string,
  map: RemapByType,
): string {
  const m = map[resourceType];
  if (!m) return logicalId;
  return m[logicalId] ?? logicalId;
}

/**
 * Rewrite a FHIR reference string when `ResourceType/logicalId` appears as a path segment.
 */
export function remapReferenceString(ref: string, map: RemapByType): string {
  let out = ref;
  for (const [rt, idmap] of Object.entries(map)) {
    if (!idmap) continue;
    for (const [from, to] of Object.entries(idmap)) {
      if (from === to) continue;
      const re = new RegExp(
        `(^|[/:])${escapeRegex(rt)}/${escapeRegex(from)}(?=/|$|\\?|#)`,
        "g",
      );
      out = out.replace(re, `$1${rt}/${to}`);
    }
  }
  return out;
}

function remapReferencesDeep(node: unknown, map: RemapByType): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) remapReferencesDeep(x, map);
    return;
  }
  const o = node as Record<string, unknown>;
  if (typeof o.reference === "string") {
    o.reference = remapReferenceString(o.reference, map);
  }
  for (const k of Object.keys(o)) {
    remapReferencesDeep(o[k], map);
  }
}

/** Apply id remap for this resource's type + deep reference rewrite. */
export function applyRemapToResource(obj: FhirJson, map: RemapByType): FhirJson {
  const rt =
    typeof obj.resourceType === "string" ? obj.resourceType.trim() : "";
  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  const nextId =
    rt && id ? resolveRemappedId(rt, id, map) : id;
  const out = { ...obj } as Record<string, unknown>;
  if (nextId && nextId !== id) {
    out.id = nextId;
  }
  remapReferencesDeep(out, map);
  return out as FhirJson;
}

/**
 * Replace `Patient/{fromId}` references with `Patient/{toId}` everywhere under `node`.
 */
export function remapPatientReferencesDeep(
  node: unknown,
  fromPatientId: string,
  toPatientId: string,
): void {
  const map: RemapByType = {
    Patient: { [fromPatientId]: toPatientId },
  };
  remapReferencesDeep(node, map);
}
