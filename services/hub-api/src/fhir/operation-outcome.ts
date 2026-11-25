/** Minimal FHIR R4 OperationOutcome for API errors. */

export type IssueSeverity = "fatal" | "error" | "warning" | "information";
export type IssueCode =
  | "invalid"
  | "not-supported"
  | "not-found"
  | "security"
  | "processing"
  | "exception";

export function operationOutcome(
  severity: IssueSeverity,
  code: IssueCode,
  diagnostics: string,
): { resourceType: "OperationOutcome"; issue: Array<{ severity: IssueSeverity; code: IssueCode; diagnostics: string }> } {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}
