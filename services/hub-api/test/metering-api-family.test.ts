import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meteringApiFamily } from "../src/observability/prometheus-metrics.js";

describe("meteringApiFamily", () => {
  it("classifies major surfaces", () => {
    assert.equal(meteringApiFamily("/fhir/Patient"), "fhir");
    assert.equal(meteringApiFamily("/oauth/token"), "oauth");
    assert.equal(meteringApiFamily("/internal/v1/api-keys"), "internal");
    assert.equal(meteringApiFamily("/health"), "system");
    assert.equal(meteringApiFamily("/ready"), "system");
    assert.equal(meteringApiFamily("/.well-known/smart-configuration"), "oauth");
    assert.equal(meteringApiFamily("/unknown"), "other");
  });

  it("strips query strings", () => {
    assert.equal(meteringApiFamily("/fhir/Patient?_count=1"), "fhir");
  });
});
