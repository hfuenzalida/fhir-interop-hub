/**
 * Smoke load: public metadata + readiness (no auth).
 * Run: k6 run scripts/load/k6-metadata-smoke.js
 * Optional: K6_BASE_URL=http://127.0.0.1:3000 k6 run ...
 * See scripts/load/README.md and docs/PROD_PHASE3_RELIABILITY.md
 */
import http from "k6/http";
import { check, sleep } from "k6";

const base = __ENV.K6_BASE_URL || "http://127.0.0.1:3000";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const r1 = http.get(`${base}/fhir/metadata`);
  check(r1, { "metadata 200": (r) => r.status === 200 });

  const r2 = http.get(`${base}/ready`);
  check(r2, { "ready 200": (r) => r.status === 200 });

  sleep(0.3);
}
