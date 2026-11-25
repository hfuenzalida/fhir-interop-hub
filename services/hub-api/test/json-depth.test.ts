import assert from "node:assert/strict";
import test from "node:test";
import {
  assertJsonDepthLimit,
  jsonValueMaxDepth,
} from "../src/security/json-depth.js";

test("jsonValueMaxDepth flat object", () => {
  assert.equal(jsonValueMaxDepth({ a: 1 }), 1);
});

test("jsonValueMaxDepth nested", () => {
  const o = { a: { b: { c: 1 } } };
  assert.equal(jsonValueMaxDepth(o), 3);
});

test("assertJsonDepthLimit rejects deep nest", () => {
  const deep: Record<string, unknown> = { x: 1 };
  let cur: Record<string, unknown> = deep;
  for (let i = 0; i < 60; i++) {
    const next: Record<string, unknown> = {};
    cur.n = next;
    cur = next;
  }
  const err = assertJsonDepthLimit(deep, 48);
  assert.ok(err);
});
