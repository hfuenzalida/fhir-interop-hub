import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertProductionSecurityConfig,
  envSchema,
} from "../src/env.js";

describe("assertProductionSecurityConfig", () => {
  it("throws when DEV_API_KEY is set in production", () => {
    const parsed = envSchema.parse({
      NODE_ENV: "production",
      DEV_API_KEY: "dev_bypass_key_must_not_exist_in_prod________",
    });
    assert.throws(() => assertProductionSecurityConfig(parsed), /DEV_API_KEY/);
  });

  it("throws when metrics enabled without INTERNAL_METRICS_TOKEN in production", () => {
    const parsed = envSchema.parse({
      NODE_ENV: "production",
      METRICS_ENABLED: true,
      INTERNAL_METRICS_TOKEN: "",
    });
    assert.throws(
      () => assertProductionSecurityConfig(parsed),
      /INTERNAL_METRICS_TOKEN/,
    );
  });

  it("allows production with metrics disabled", () => {
    const parsed = envSchema.parse({
      NODE_ENV: "production",
      METRICS_ENABLED: false,
    });
    assert.doesNotThrow(() => assertProductionSecurityConfig(parsed));
  });

  it("allows production with metrics token set", () => {
    const parsed = envSchema.parse({
      NODE_ENV: "production",
      METRICS_ENABLED: true,
      INTERNAL_METRICS_TOKEN: "prod_metrics_token_min_length_ok________",
    });
    assert.doesNotThrow(() => assertProductionSecurityConfig(parsed));
  });

  it("does not apply to test environment", () => {
    const parsed = envSchema.parse({
      NODE_ENV: "test",
      DEV_API_KEY: "allowed_in_tests_only___________________",
      METRICS_ENABLED: true,
    });
    assert.doesNotThrow(() => assertProductionSecurityConfig(parsed));
  });
});
