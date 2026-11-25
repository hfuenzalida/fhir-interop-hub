/** FHIR-ish search pagination; `_offset` is a pragmatic extension (not all servers use it). */

/** Parsed `_lastUpdated` prefix search (ANDed in SQL). */
export type LastUpdatedFilter = {
  ge?: Date;
  le?: Date;
  gt?: Date;
  lt?: Date;
};

function parseOneInstant(s: string): Date | null {
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getStringParam(
  q: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = q[key];
  if (Array.isArray(v)) return v[0] !== undefined ? String(v[0]) : undefined;
  if (v === undefined || v === null) return undefined;
  return String(v);
}

/**
 * FHIR `_lastUpdated` (repeatable). Supports `ge|le|gt|lt` + instant (ISO-8601).
 * `eq` is accepted as a point-in-time equality on `last_updated` (second precision).
 */
export function parseLastUpdatedFilter(
  q: Record<string, unknown>,
): LastUpdatedFilter {
  const raw = q["_lastUpdated"];
  const tokens: string[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) tokens.push(String(r));
  } else if (raw !== undefined && raw !== null) {
    tokens.push(String(raw));
  }
  let ge: Date | undefined;
  let le: Date | undefined;
  let gt: Date | undefined;
  let lt: Date | undefined;

  for (const t of tokens) {
    const m = t.match(/^(eq|ge|le|gt|lt)(.+)$/i);
    if (!m) continue;
    const op = m[1]!.toLowerCase();
    const inst = parseOneInstant(m[2]!);
    if (!inst) continue;
    if (op === "ge") ge = !ge || inst > ge ? inst : ge;
    else if (op === "le") le = !le || inst < le ? inst : le;
    else if (op === "gt") gt = !gt || inst > gt ? inst : gt;
    else if (op === "lt") lt = !lt || inst < lt ? inst : lt;
    else if (op === "eq") {
      ge = !ge || inst > ge ? inst : ge;
      le = !le || inst < le ? inst : le;
    }
  }
  const out: LastUpdatedFilter = {};
  if (ge) out.ge = ge;
  if (le) out.le = le;
  if (gt) out.gt = gt;
  if (lt) out.lt = lt;
  return out;
}

/** `_sort` for `lastUpdated` / `_lastUpdated` (default: newest first). */
export function parseSortLastUpdated(
  q: Record<string, unknown>,
): "asc" | "desc" {
  const s = getStringParam(q, "_sort");
  if (!s) return "desc";
  for (const part of s.split(",").map((p) => p.trim())) {
    if (part === "-_lastUpdated" || part === "-lastUpdated") return "desc";
    if (part === "_lastUpdated" || part === "lastUpdated") return "asc";
  }
  return "desc";
}

/** e.g. `Observation:subject` on Patient search – minimal GAP-1 set. */
export function parseIncludeParam(
  q: Record<string, unknown>,
): { type: string; param: string }[] {
  const raw = q["_include"];
  const tokens: string[] = [];
  if (Array.isArray(raw)) for (const r of raw) tokens.push(String(r));
  else if (raw !== undefined && raw !== null) tokens.push(String(raw));
  const out: { type: string; param: string }[] = [];
  for (const t of tokens) {
    for (const piece of t.split(",").map((p) => p.trim()).filter(Boolean)) {
      const idx = piece.indexOf(":");
      if (idx <= 0) continue;
      out.push({
        type: piece.slice(0, idx),
        param: piece.slice(idx + 1),
      });
    }
  }
  return out;
}

/** `patient=Patient/abc` or `patient=abc` */
export function parsePatientReference(
  value: string | undefined,
): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.startsWith("Patient/")) return v.slice("Patient/".length) || null;
  return v || null;
}

export function parseSearchPagination(q: Record<string, unknown>): {
  limit: number;
  offset: number;
} {
  const rawCount = q["_count"];
  const parsed = parseInt(String(rawCount ?? "20"), 10);
  const limit = Math.min(200, Math.max(1, Number.isFinite(parsed) ? parsed : 20));
  const rawOff = q["_offset"] ?? q["_getpagesoffset"];
  const offParsed = parseInt(String(rawOff ?? "0"), 10);
  const offset = Math.max(0, Number.isFinite(offParsed) ? offParsed : 0);
  return { limit, offset };
}

export function parseIdParams(q: Record<string, unknown>): string[] | undefined {
  const raw = q["_id"];
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw
      .flatMap((r) => String(r).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
