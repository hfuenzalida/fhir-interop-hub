# Implementation guide targets

## Locked for v1 design

| Item | Value | Notes |
|------|--------|--------|
| FHIR | **R4** (`4.0.1`) | Canonical wire format for hub APIs. |
| US Core | **6.1.0** package pin | Bump only with conformance test updates. |
| SMART | SMART App Launch | OAuth2 + FHIR scopes; Phase 3. |

## Conformance

- Add **US Core** validation to CI when FHIR write path exists (Phase 1+).
- Track **Inferno / program-specific** test runs for (g)(10)-aligned API scope (Phase 5).

## Extensions

- Domain-specific IGs (e.g. mCODE) as separate profiles when apps require them.
