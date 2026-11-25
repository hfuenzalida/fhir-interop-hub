/**
 * Authenticated FHIR read load — Patient search (staging / synthetic data only).
 *
 * Requires:
 *   K6_BEARER_TOKEN — tenant API key (same as Authorization Bearer for /fhir)
 *
 * Optional:
 *   K6_BASE_URL (default http://127.0.0.1:3000)
 *
 * Run:
 *   K6_BEARER_TOKEN=your_key k6 run scripts/load/k6-fhir-read-smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const base = __ENV.K6_BASE_URL || "http://127.0.0.1:3000";
const bearer = __ENV.K6_BEARER_TOKEN || "";

export const options = {
  vus: 3,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

export function setup() {
  if (!bearer) {
    throw new Error(
      "Set K6_BEARER_TOKEN to a valid hub API key (staging only).",
    );
  }
}

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/fhir+json",
    },
  };
  const res = http.get(`${base}/fhir/Patient?_count=5`, params);
  check(res, {
    "Patient search 200": (r) => r.status === 200,
  });
  sleep(0.25);
}
