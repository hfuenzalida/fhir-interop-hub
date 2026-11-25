/**
 * HTTP-level integration tests (Fastify inject + Postgres).
 * Enable with RUN_INTEGRATION_TESTS=1 and DATABASE_URL (+ seeded API key).
 * CI sets CI=true, DATABASE_URL, CI_SEED_API_KEY, migrations + seed in workflow.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  buildHubApplication,
  type BuiltHubApplication,
} from "../../src/build-app.js";

const enabled =
  (process.env.RUN_INTEGRATION_TESTS === "1" ||
    process.env.CI === "true") &&
  Boolean(process.env.DATABASE_URL?.trim());

function apiKey(): string {
  return (
    process.env.CI_SEED_API_KEY ??
    process.env.INTEGRATION_API_KEY ??
    ""
  ).trim();
}

describe(
  "hub integration (Postgres + inject)",
  { skip: !enabled },
  () => {
    let hub: BuiltHubApplication;
    const key = apiKey();

    before(async () => {
      if (!process.env.DATABASE_URL?.trim()) {
        throw new Error("DATABASE_URL is required for integration tests");
      }
      if (!key) {
        throw new Error(
          "Set CI_SEED_API_KEY or INTEGRATION_API_KEY (match seeded tenant API key)",
        );
      }
      process.env.NODE_ENV = "test";
      hub = await buildHubApplication();
    });

    after(async () => {
      await hub?.close();
    });

    it("FHIR Patient CRUD roundtrip", async () => {
      const patientBody = {
        resourceType: "Patient",
        identifier: [
          { system: "http://integration.test/sid/mrn", value: `mrn-${Date.now()}` },
        ],
        name: [{ family: "Integration", given: ["CRUD"] }],
        gender: "unknown",
        birthDate: "1992-03-03",
      };

      const post = await hub.app.inject({
        method: "POST",
        url: "/fhir/Patient",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        payload: patientBody,
      });
      assert.equal(post.statusCode, 201, post.payload);
      const created = JSON.parse(post.payload) as { id?: string };
      const id = created.id;
      assert.ok(typeof id === "string" && id.length > 0);

      const read = await hub.app.inject({
        method: "GET",
        url: `/fhir/Patient/${encodeURIComponent(id)}`,
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/fhir+json",
        },
      });
      assert.equal(read.statusCode, 200);

      const updBody = {
        ...JSON.parse(read.payload),
        gender: "female",
      };
      const put = await hub.app.inject({
        method: "PUT",
        url: `/fhir/Patient/${encodeURIComponent(id)}`,
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        payload: updBody,
      });
      assert.equal(put.statusCode, 200);

      const del = await hub.app.inject({
        method: "DELETE",
        url: `/fhir/Patient/${encodeURIComponent(id)}`,
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/fhir+json",
        },
      });
      assert.equal(del.statusCode, 204);

      const gone = await hub.app.inject({
        method: "GET",
        url: `/fhir/Patient/${encodeURIComponent(id)}`,
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/fhir+json",
        },
      });
      assert.equal(gone.statusCode, 404);
    });

    it("transaction Bundle rolls back on mid-flight validation failure", async () => {
      const pid = `it-txn-${Date.now()}`;
      const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: [
          {
            request: { method: "PUT", url: `Patient/${pid}` },
            resource: {
              resourceType: "Patient",
              id: pid,
              identifier: [{ system: "http://x", value: "a" }],
              name: [{ family: "Txn", given: ["Rollback"] }],
            },
          },
          {
            request: { method: "POST", url: "Observation" },
            resource: {
              resourceType: "Observation",
              status: "final",
              code: {
                coding: [{ system: "http://loinc.org", code: "12345-6" }],
              },
            },
          },
        ],
      };

      const res = await hub.app.inject({
        method: "POST",
        url: "/fhir",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        payload: bundle,
      });
      assert.equal(res.statusCode, 400, res.payload);

      const check = await hub.app.inject({
        method: "GET",
        url: `/fhir/Patient/${encodeURIComponent(pid)}`,
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/fhir+json",
        },
      });
      assert.equal(check.statusCode, 404);
    });

    it("batch Bundle returns partial success with OperationOutcome on failed entries", async () => {
      const bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [
          {
            request: { method: "POST", url: "Patient" },
            resource: {
              resourceType: "Patient",
              identifier: [{ system: "http://batch.test", value: `b-${Date.now()}` }],
              name: [{ family: "Batch", given: ["Ok"] }],
            },
          },
          {
            request: { method: "POST", url: "Observation" },
            resource: {
              resourceType: "Observation",
              status: "final",
              code: {
                coding: [{ system: "http://loinc.org", code: "99999-9" }],
              },
            },
          },
        ],
      };

      const res = await hub.app.inject({
        method: "POST",
        url: "/fhir",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        payload: bundle,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload) as {
        entry?: Array<{ response?: { status?: string; outcome?: unknown } }>;
      };
      assert.ok(Array.isArray(body.entry));
      assert.equal(body.entry!.length, 2);
      assert.equal(body.entry![0]?.response?.status, "201");
      assert.equal(body.entry![1]?.response?.status, "400");
      assert.ok(body.entry![1]?.response?.outcome);
    });

    it("GET /internal/v1/usage/summary returns audit rollup", async () => {
      const res = await hub.app.inject({
        method: "GET",
        url: "/internal/v1/usage/summary?hours=168",
        headers: {
          authorization: `Bearer ${key}`,
        },
      });
      assert.equal(res.statusCode, 200, res.payload);
      const body = JSON.parse(res.payload) as {
        tenantExternalKey?: string;
        periodHours?: number;
        auditEventsInPeriod?: number;
        auditEventsByAction?: unknown[];
        metering?: { scrapePath?: string };
      };
      assert.ok(typeof body.tenantExternalKey === "string");
      assert.ok(body.periodHours === 168);
      assert.ok(typeof body.auditEventsInPeriod === "number");
      assert.ok(Array.isArray(body.auditEventsByAction));
      assert.equal(body.metering?.scrapePath, "/internal/metrics");
    });

    it("GET /fhir/metadata latency smoke (median below threshold)", async () => {
      const runs = 35;
      const times: number[] = [];
      for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        const res = await hub.app.inject({
          method: "GET",
          url: "/fhir/metadata",
          headers: { accept: "application/fhir+json" },
        });
        times.push(performance.now() - t0);
        assert.equal(res.statusCode, 200);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)]!;
      const maxMs =
        Number(process.env.PERF_METADATA_MAX_MS) > 0
          ? Number(process.env.PERF_METADATA_MAX_MS)
          : 4000;
      assert.ok(
        median < maxMs,
        `median metadata latency ${median.toFixed(1)}ms exceeds ${maxMs}ms`,
      );
    });
  },
);
