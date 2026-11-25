import assert from "node:assert/strict";
import test from "node:test";
import { extractBearer, sha256Hex } from "../src/auth/api-key.js";
import { isUuidString } from "../src/internal/api-keys.js";
import { parseTransactionRequestUrl } from "../src/fhir/transaction-bundle.js";

test("sha256Hex is stable", () => {
  assert.equal(
    sha256Hex("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

test("extractBearer parses Authorization header", () => {
  assert.equal(extractBearer("Bearer abc.def"), "abc.def");
  assert.equal(extractBearer(undefined), undefined);
  assert.equal(extractBearer("Basic x"), undefined);
});

test("isUuidString accepts RFC UUID", () => {
  assert.equal(
    isUuidString("21e13cb9-f9e2-40ca-9c45-0d5042dfbe70"),
    true,
  );
  assert.equal(isUuidString("not-a-uuid"), false);
});

test("parseTransactionRequestUrl", () => {
  assert.deepEqual(parseTransactionRequestUrl("Patient"), { type: "Patient" });
  assert.deepEqual(parseTransactionRequestUrl("Patient/p1"), {
    type: "Patient",
    id: "p1",
  });
  assert.deepEqual(parseTransactionRequestUrl("fhir/Observation/oid1"), {
    type: "Observation",
    id: "oid1",
  });
  assert.equal(parseTransactionRequestUrl("x/y/z"), null);
});
