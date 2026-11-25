import type pg from "pg";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as pg.DatabaseError).code === "23505"
  );
}
