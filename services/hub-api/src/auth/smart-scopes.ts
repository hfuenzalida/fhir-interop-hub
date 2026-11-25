/** SMART-style `patient/Type.permission` scopes (minimal subset). */

export function jwtNeedsPatientCompartment(scopes: string[]): boolean {
  return scopes.some((s) => s.trim().startsWith("patient/"));
}

export function scopeAllowsPatientResource(
  scopes: string[],
  resourceType: string,
  need: "read" | "write",
): boolean {
  for (const raw of scopes) {
    const s = raw.trim();
    if (!s.startsWith("patient/")) continue;
    const dot = s.lastIndexOf(".");
    if (dot < 0) continue;
    const rt = s.slice("patient/".length, dot);
    const perm = s.slice(dot + 1).toLowerCase();
    if (rt !== "*" && rt !== resourceType) continue;
    if (need === "read") {
      if (
        perm === "read" ||
        perm === "rs" ||
        perm === "r" ||
        perm.includes("r")
      ) {
        return true;
      }
    } else if (
      perm === "write" ||
      perm === "create" ||
      perm === "cruds" ||
      perm.includes("c") ||
      perm.includes("u") ||
      perm.includes("d")
    ) {
      return true;
    }
  }
  return false;
}
