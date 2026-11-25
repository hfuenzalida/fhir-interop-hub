import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProbabilisticCandidates,
  scorePatientPair,
  type PatientMini,
} from "../src/fhir/patient-match-score.js";

test("scorePatientPair rewards exact birthDate + identifiers", () => {
  const a = {
    resourceType: "Patient",
    birthDate: "1990-01-01",
    gender: "male",
    name: [{ family: "Smith", given: ["John"] }],
    identifier: [{ system: "urn:mrn", value: "1" }],
  };
  const b = {
    resourceType: "Patient",
    birthDate: "1990-01-01",
    gender: "male",
    name: [{ family: "Smith", given: ["John"] }],
    identifier: [{ system: "urn:mrn", value: "1" }],
  };
  const r = scorePatientPair(a, b);
  assert.ok(r.score >= 90);
});

test("buildProbabilisticCandidates dedupes pairs", () => {
  const p1: PatientMini = {
    logicalId: "a",
    data: {
      birthDate: "2000-05-05",
      identifier: [{ system: "s", value: "v" }],
    },
  };
  const p2: PatientMini = {
    logicalId: "b",
    data: {
      birthDate: "2000-05-05",
      identifier: [{ system: "s", value: "v" }],
    },
  };
  const bd = new Map<string, PatientMini[]>([["2000-05-05", [p1, p2]]]);
  const idGroups = [
    {
      system: "s",
      value: "v",
      patients: [p1, p2],
    },
  ];
  const out = buildProbabilisticCandidates(bd, idGroups, 0, 10);
  assert.equal(out.length, 1);
});
