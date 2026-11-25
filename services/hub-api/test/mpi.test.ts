import assert from "node:assert/strict";
import test from "node:test";
import {
  isPatientLinkType,
  normalizePatientPair,
} from "../src/internal/mpi.js";

test("normalizePatientPair orders and rejects identical ids", () => {
  assert.deepEqual(normalizePatientPair("b", "a"), { left: "a", right: "b" });
  assert.equal(normalizePatientPair("x", "x"), null);
});

test("isPatientLinkType", () => {
  assert.equal(isPatientLinkType("duplicate"), true);
  assert.equal(isPatientLinkType("see-also"), true);
  assert.equal(isPatientLinkType("other"), false);
});
