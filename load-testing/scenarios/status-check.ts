/**
 * Status Check Load Test Scenario
 *
 * Tests the GET /api/guest-booking/status endpoint under load.
 * This endpoint is called frequently by guests checking their booking status.
 *
 * Target: P95 < 200ms, Error Rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import { getEnvironment } from "../config/environments.js";
import { endpointThresholds } from "../config/thresholds.js";

// Custom metrics
const statusSuccessRate = new Rate("status_success_rate");
const statusDuration = new Trend("status_duration", true);

// Environment configuration
const env = getEnvironment();

// Note: bookingIds is managed via setup() and passed to default function

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

// Setup function - create some test bookings to check status
export function setup() {
  // In a real scenario, you would either:
  // 1. Create bookings in setup and return their IDs
  // 2. Use pre-existing booking IDs from environment
  // 3. Create bookings as part of the test flow

  const testBookingIds = __ENV.TEST_BOOKING_IDS?.split(",") || [
    "00000000-0000-0000-0000-000000000001", // Placeholder
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
  ];

  console.log(`Using ${testBookingIds.length} booking IDs for status checks`);
  return { bookingIds: testBookingIds };
}

export default function (data: { bookingIds: string[] }) {
  // Pick a random booking ID
  const bookingId = data.bookingIds[Math.floor(Math.random() * data.bookingIds.length)];

  const startTime = Date.now();

  const response = http.get(`${env.baseUrl}/api/guest-booking/status?booking_id=${bookingId}`, {
    tags: { endpoint: "status" },
  });

  const duration = Date.now() - startTime;
  statusDuration.add(duration);

  // Check response
  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "has booking status": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return !!body.booking?.status;
      } catch {
        return false;
      }
    },
    "response time < 200ms": (r) => r.timings.duration < 200,
  });

  statusSuccessRate.add(success);

  // Handle rate limiting
  if (response.status === 429) {
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
║ Endpoint: GET /api/guest-booking/status                       ║
║ Target: P95 < 200ms, Error Rate < 1%                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Response Time:                                                ║
║   - Median (P50): ${formatMs(metrics.http_req_duration?.values?.med)}                             ║
║   - P90: ${formatMs(metrics.http_req_duration?.values?.["p(90)"])}                                       ║
║   - P95: ${formatMs(metrics.http_req_duration?.values?.["p(95)"])}                                       ║
║   - P99: ${formatMs(metrics.http_req_duration?.values?.["p(99)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Success Rate: ${formatPercent(metrics.status_success_rate?.values?.rate)}                              ║
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
