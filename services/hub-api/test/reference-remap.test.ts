import assert from "node:assert/strict";
import test from "node:test";
import {
  remapPatientReferencesDeep,
  remapReferenceString,
} from "../src/fhir/reference-remap.js";

test("remapReferenceString replaces typed ids in refs", () => {
  const map = {
    Patient: { a: "survivor" },
    Observation: { x: "y" },
  };
  assert.equal(
    remapReferenceString("Patient/a", map),
    "Patient/survivor",
  );
  assert.equal(
    remapReferenceString("http://h.org/fhir/Observation/x", map),
    "http://h.org/fhir/Observation/y",
  );
});

test("remapPatientReferencesDeep updates nested reference", () => {
  const bundle = {
    entry: [
      {
        resource: {
          subject: { reference: "Patient/dup" },
        },
      },
    ],
  };
  remapPatientReferencesDeep(bundle, "dup", "win");
  assert.equal(
    (bundle.entry[0] as { resource: { subject: { reference: string } } })
      .resource.subject.reference,
    "Patient/win",
  );
});
