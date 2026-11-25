import type { FhirJson } from "./resource-store.js";

export type PatientMatchBreakdown = {
  birthDateMatch: number;
  genderMatch: number;
  nameSimilarity: number;
  identifierOverlap: number;
};

export type PatientMatchScore = {
  score: number;
  breakdown: PatientMatchBreakdown;
};

const MAX_BD = 35;
const MAX_GENDER = 10;
const MAX_NAME = 40;
const MAX_ID = 25;

function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** FHIR HumanName[] → single comparable string. */
function patientDisplayName(p: FhirJson): string {
  const names = p.name;
  if (!Array.isArray(names) || names.length === 0) return "";
  const n = names[0];
  if (!n || typeof n !== "object") return "";
  const o = n as { family?: unknown; given?: unknown[]; text?: unknown };
  if (typeof o.text === "string" && o.text.trim()) return normalizeText(o.text);
  const parts: string[] = [];
  if (typeof o.family === "string") parts.push(o.family);
  if (Array.isArray(o.given)) {
    for (const g of o.given) {
      if (typeof g === "string") parts.push(g);
    }
  }
  return normalizeText(parts.join(" "));
}

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxP = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxP; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  const p = 0.1;
  return j + prefix * p * (1 - j);
}

function identifierKeys(p: FhirJson): Set<string> {
  const out = new Set<string>();
  const ids = p.identifier;
  if (!Array.isArray(ids)) return out;
  for (const id of ids) {
    if (!id || typeof id !== "object") continue;
    const o = id as { system?: unknown; value?: unknown };
    const sys =
      typeof o.system === "string" ? o.system.trim().toLowerCase() : "";
    const val = typeof o.value === "string" ? o.value.trim() : "";
    if (val) out.add(`${sys}|${val.toLowerCase()}`);
  }
  return out;
}

function genderNorm(g: unknown): string | null {
  if (typeof g !== "string") return null;
  const x = g.trim().toLowerCase();
  if (!x) return null;
  return x;
}

/**
 * Probabilistic duplicate score for two Patient resources (0–100).
 * Weighting: birthDate, gender, name (Jaro–Winkler), identifier overlap.
 */
export function scorePatientPair(a: FhirJson, b: FhirJson): PatientMatchScore {
  const bdA = typeof a.birthDate === "string" ? a.birthDate.trim() : "";
  const bdB = typeof b.birthDate === "string" ? b.birthDate.trim() : "";
  let birthDateMatch = 0;
  if (bdA && bdB && bdA === bdB) {
    birthDateMatch = MAX_BD;
  }

  const gA = genderNorm(a.gender);
  const gB = genderNorm(b.gender);
  let genderMatch = 0;
  if (gA && gB && gA === gB) {
    genderMatch = MAX_GENDER;
  }

  const na = patientDisplayName(a);
  const nb = patientDisplayName(b);
  let nameSimilarity = 0;
  if (na && nb) {
    nameSimilarity = MAX_NAME * jaroWinkler(na, nb);
  }

  const ka = identifierKeys(a);
  const kb = identifierKeys(b);
  let overlap = 0;
  for (const k of ka) {
    if (kb.has(k)) overlap++;
  }
  const identifierOverlap =
    ka.size > 0 && kb.size > 0
      ? MAX_ID * (overlap / Math.max(1, Math.min(ka.size, kb.size)))
      : overlap > 0
        ? MAX_ID
        : 0;

  const breakdown: PatientMatchBreakdown = {
    birthDateMatch,
    genderMatch,
    nameSimilarity,
    identifierOverlap,
  };
  const score = Math.min(
    100,
    Math.round(
      birthDateMatch +
        genderMatch +
        nameSimilarity +
        identifierOverlap +
        Number.EPSILON,
    ),
  );
  return { score, breakdown };
}

export type PatientMini = { logicalId: string; data: FhirJson };

/**
 * All unordered pairs from a list (for blocking groups).
 */
export function pairsFromGroup(ids: PatientMini[]): [PatientMini, PatientMini][] {
  const out: [PatientMini, PatientMini][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      out.push([ids[i]!, ids[j]!]);
    }
  }
  return out;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

export type ProbabilisticCandidate = {
  patientLogicalIdA: string;
  patientLogicalIdB: string;
  score: number;
  breakdown: PatientMatchBreakdown;
  blocking: "birthDate" | "identifier";
};

/**
 * Combines birthDate blocking and identifier blocking; dedupes pairs; filters by minScore.
 */
export function buildProbabilisticCandidates(
  birthDateGroups: Map<string, PatientMini[]>,
  identifierGroups: { system: string; value: string; patients: PatientMini[] }[],
  minScore: number,
  maxPairs: number,
): ProbabilisticCandidate[] {
  const seen = new Set<string>();
  const out: ProbabilisticCandidate[] = [];

  const pushPair = (
    x: PatientMini,
    y: PatientMini,
    blocking: "birthDate" | "identifier",
  ) => {
    const k = pairKey(x.logicalId, y.logicalId);
    if (seen.has(k)) return;
    seen.add(k);
    const { score, breakdown } = scorePatientPair(x.data, y.data);
    if (score < minScore) return;
    const [a, b] =
      x.logicalId < y.logicalId
        ? [x.logicalId, y.logicalId]
        : [y.logicalId, x.logicalId];
    out.push({
      patientLogicalIdA: a,
      patientLogicalIdB: b,
      score,
      breakdown,
      blocking,
    });
  };

  for (const [, group] of birthDateGroups) {
    if (group.length < 2) continue;
    for (const [x, y] of pairsFromGroup(group)) {
      pushPair(x, y, "birthDate");
    }
  }

  for (const g of identifierGroups) {
    if (g.patients.length < 2) continue;
    for (const [x, y] of pairsFromGroup(g.patients)) {
      pushPair(x, y, "identifier");
    }
  }

  out.sort((u, v) => v.score - u.score || u.patientLogicalIdA.localeCompare(v.patientLogicalIdA));
  return out.slice(0, maxPairs);
}
