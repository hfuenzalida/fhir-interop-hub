/**
 * Longest path through nested objects/arrays to a scalar leaf.
 * Example: `{ a: 1 }` → 1; `{ a: { b: { c: 1 } } }` → 3.
 */
export function jsonValueMaxDepth(value: unknown): number {
  function walk(v: unknown, d: number): number {
    if (v === null || typeof v !== "object") return d;
    if (Array.isArray(v)) {
      let max = d;
      for (const x of v) max = Math.max(max, walk(x, d + 1));
      return max;
    }
    let max = d;
    for (const k of Object.keys(v as object)) {
      max = Math.max(
        max,
        walk((v as Record<string, unknown>)[k], d + 1),
      );
    }
    return max;
  }
  return walk(value, 0);
}

/** Returns error message or null if within limit. */
export function assertJsonDepthLimit(
  value: unknown,
  maxDepth: number,
): string | null {
  const depth = jsonValueMaxDepth(value);
  if (depth > maxDepth) {
    return `JSON nesting depth ${depth} exceeds maximum (${maxDepth}).`;
  }
  return null;
}
