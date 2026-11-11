/**
 * Status Check Load Test Scenario
 *
 * Tests the POST /api/guest-booking/status endpoint under load.
 * This endpoint is called frequently by guests checking their booking status.
 *
 * Target: P95 < 200ms, Error Rate < 1%
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

import { getEnvironment } from "../config/environments.ts";
import { endpointThresholds } from "../config/thresholds.ts";
import { getStatusLookups, type StatusLookup } from "../utils/data-generators.ts";

// Custom metrics
const statusSuccessRate = new Rate("status_success_rate");
const statusDuration = new Trend("status_duration", true);
const statusRateLimited = new Counter("status_rate_limited");

// Environment configuration
const env = getEnvironment();

// Test options
export const options = {
  scenarios: {
    status_check: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: "30s", target: 10 }, // Ramp up to 10 RPS
        { duration: "1m", target: 20 }, // Ramp up to 20 RPS
        { duration: "1m", target: 20 }, // Stay at 20 RPS
        { duration: "30s", target: 0 }, // Ramp down
      ],
    },
  },
  thresholds: {
    ...endpointThresholds.status_check,
    status_success_rate: [{ threshold: "rate>0.99", abortOnFail: true }],
    status_duration: [{ threshold: "p(95)<200", abortOnFail: false }],
  },
};

export function setup() {
  const lookups = getStatusLookups();
  console.log(`Using ${lookups.length} reference/email pairs for status checks`);
  return { lookups };
}

export default function (data: { lookups: StatusLookup[] }) {
  const lookup = data.lookups[Math.floor(Math.random() * data.lookups.length)];

  const startTime = Date.now();

  // 429 is the endpoint's own rate limiter (20/hour per client), so it is an expected result.
  const response = http.post(`${env.baseUrl}/api/guest-booking/status`, JSON.stringify(lookup), {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "status" },
    responseCallback: http.expectedStatuses(200, 429),
  });

  const duration = Date.now() - startTime;
  statusDuration.add(duration);

  const rateLimited = response.status === 429;
  statusRateLimited.add(rateLimited ? 1 : 0);

  const success = check(response, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "has booking status": (r) => {
      if (r.status === 429) return true;
      try {
        const body = JSON.parse(r.body as string);
        return !!body.status;
      } catch {
        return false;
      }
    },
    "response time < 200ms": (r) => r.timings.duration < 200,
  });

  statusSuccessRate.add(success);

  if (rateLimited) {
    const retryAfter = parseInt(response.headers["Retry-After"] || "60");
    console.log(`Rate limited on status check. Waiting ${retryAfter}s.`);
    sleep(Math.min(retryAfter, 30));
    return;
  }

  // Minimal sleep between checks
  sleep(0.2);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    "load-testing/results/status-check-summary.json": JSON.stringify(data, null, 2),
    stdout: generateTextSummary(data),
  };
}

function generateTextSummary(data: Record<string, unknown>): string {
  const metrics = data.metrics as Record<string, { values: Record<string, number> }>;

  return `
╔═══════════════════════════════════════════════════════════════╗
║              STATUS CHECK LOAD TEST RESULTS                   ║
╠═══════════════════════════════════════════════════════════════╣
║ Endpoint: POST /api/guest-booking/status                      ║
║ Target: P95 < 200ms, Error Rate < 1%                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Response Time:                                                ║
║   - Median (P50): ${formatMs(metrics.http_req_duration?.values?.med)}                             ║
║   - P90: ${formatMs(metrics.http_req_duration?.values?.["p(90)"])}                                       ║
║   - P95: ${formatMs(metrics.http_req_duration?.values?.["p(95)"])}                                       ║
║   - P99: ${formatMs(metrics.http_req_duration?.values?.["p(99)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Success Rate: ${formatPercent(metrics.status_success_rate?.values?.rate)}                              ║
║ Rate Limited (429): ${metrics.status_rate_limited?.values?.count || 0}                                     ║
║ Total Requests: ${metrics.http_reqs?.values?.count || 0}                                      ║
║ RPS: ${formatRps(metrics.http_reqs?.values?.rate)}                                              ║
╚═══════════════════════════════════════════════════════════════╝
`;
}

function formatMs(value?: number): string {
  return value !== undefined ? `${value.toFixed(2)}ms` : "N/A";
}

function formatPercent(value?: number): string {
  return value !== undefined ? `${(value * 100).toFixed(2)}%` : "N/A";
}

function formatRps(value?: number): string {
  return value !== undefined ? `${value.toFixed(2)} req/s` : "N/A";
}
