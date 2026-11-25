import assert from "node:assert/strict";
import test from "node:test";
import { TtlCache } from "../src/util/ttl-cache.js";

test("TtlCache misses when disabled (ttl 0)", () => {
  const c = new TtlCache<string>(0);
  c.set("a", "x");
  assert.equal(c.get("a"), undefined);
});

test("TtlCache stores until expiry window", () => {
  const c = new TtlCache<string>(60_000);
  c.set("k", "v");
  assert.equal(c.get("k"), "v");
});
