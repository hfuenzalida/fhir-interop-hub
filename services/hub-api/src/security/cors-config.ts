import type { Env } from "../env.js";

/**
 * - Empty `CORS_ORIGINS`: development → reflect any origin (`true`); production → disable browser CORS (`false`).
 * - `*` → allow any origin.
 * - Comma-separated list → allow-list only.
 */
export function buildCorsOptions(
  env: Env,
): { origin: boolean | string | string[] } {
  const raw = env.CORS_ORIGINS?.trim();
  if (!raw) {
    if (env.NODE_ENV === "development") {
      return { origin: true };
    }
    return { origin: false };
  }
  if (raw === "*") {
    return { origin: true };
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { origin: list };
}
