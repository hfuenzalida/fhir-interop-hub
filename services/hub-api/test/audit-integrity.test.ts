import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEvent } from "@fhir-hub/shared";
import {
  auditEntryCanonicalJson,
  computeAuditRowHash,
  sha256Hex,
  AUDIT_CHAIN_GENESIS_PREV,
} from "../src/audit/integrity.js";

test("audit canonical JSON is stable", () => {
  const e: AuditEvent = {
    id: "a",
    timestamp: "2026-01-01T00:00:00.000Z",
    action: "READ",
    outcome: "success",
    actor: { tenantId: "t1", clientId: "c", role: "integration" },
    entity: { type: "Patient", id: "p1" },
    api: { method: "GET", path: "/fhir/Patient/p1" },
    network: { requestId: "r1" },
    detail: "x",
  };
  assert.equal(auditEntryCanonicalJson(e), auditEntryCanonicalJson(e));
});

test("audit row hash chains with genesis and optional secret", () => {
  const entryHash = sha256Hex(auditEntryCanonicalJson(sampleEvent()));
  const h1 = computeAuditRowHash(null, entryHash, undefined);
  const h2 = computeAuditRowHash(AUDIT_CHAIN_GENESIS_PREV, entryHash, undefined);
  assert.equal(h1, h2);
  const withSecret = computeAuditRowHash(null, entryHash, "test-secret");
  assert.notEqual(withSecret, h1);
});

function sampleEvent(): AuditEvent {
  return {
    id: "id1",
    timestamp: "2026-04-01T12:00:00.000Z",
    action: "CREATE",
    outcome: "success",
    actor: { tenantId: "tenant-a", clientId: "app", role: "integration" },
    entity: { type: "Observation", id: "o1" },
    api: { method: "POST", path: "/fhir/Observation" },
    network: { requestId: "req-1" },
  };
}
