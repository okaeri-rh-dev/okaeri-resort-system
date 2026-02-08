/**
 * Availability Check Load Test Scenario
 *
 * Tests the GET /api/availability/* endpoints under load.
 * These are read-heavy endpoints that should be very fast.
 *
 * Target: P95 < 100ms, Error Rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import { getEnvironment } from "../config/environments.js";
import { endpointThresholds } from "../config/thresholds.js";
import { generateBookingDates, getRandomUnitId } from "../utils/data-generators.js";

// Custom metrics
const availabilitySuccessRate = new Rate("availability_success_rate");
const availabilityDuration = new Trend("availability_duration", true);

// Environment configuration
const env = getEnvironment();

// Test options
export const options = {
  scenarios: {
    availability_check: {
      executor: "constant-arrival-rate",
      rate: 50, // 50 requests per second
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    ...endpointThresholds.availability,
    availability_success_rate: [{ threshold: "rate>0.99", abortOnFail: true }],
    availability_duration: [{ threshold: "p(95)<100", abortOnFail: false }],
  },
};

export default function () {
  const unitId = getRandomUnitId();
  const dates = generateBookingDates();

  // Build query parameters
  const params = new URLSearchParams({
    unit_id: unitId,
    check_in: dates.checkIn,
    check_out: dates.checkOut,
  });

  const startTime = Date.now();

  const response = http.get(`${env.baseUrl}/api/availability/check?${params.toString()}`, {
    tags: { endpoint: "availability" },
  });

  const duration = Date.now() - startTime;
  availabilityDuration.add(duration);

  // Check response
  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "has availability data": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return typeof body.available === "boolean";
      } catch {
        return false;
      }
    },
    "response time < 100ms": (r) => r.timings.duration < 100,
  });

  availabilitySuccessRate.add(success);

  // Log slow responses
  if (response.timings.duration > 100) {
    console.log(`Slow availability check: ${response.timings.duration.toFixed(2)}ms`);
  }

  // Minimal sleep for read-heavy test
  sleep(0.1);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    "load-testing/results/availability-check-summary.json": JSON.stringify(data, null, 2),
    stdout: generateTextSummary(data),
  };
}

function generateTextSummary(data: Record<string, unknown>): string {
  const metrics = data.metrics as Record<string, { values: Record<string, number> }>;

  return `
╔═══════════════════════════════════════════════════════════════╗
║            AVAILABILITY CHECK LOAD TEST RESULTS               ║
╠═══════════════════════════════════════════════════════════════╣
║ Endpoint: GET /api/availability/check                         ║
║ Target: P95 < 100ms, Error Rate < 1%                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Response Time:                                                ║
║   - Median (P50): ${formatMs(metrics.http_req_duration?.values?.med)}                             ║
║   - P90: ${formatMs(metrics.http_req_duration?.values?.["p(90)"])}                                       ║
║   - P95: ${formatMs(metrics.http_req_duration?.values?.["p(95)"])}                                       ║
║   - P99: ${formatMs(metrics.http_req_duration?.values?.["p(99)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Success Rate: ${formatPercent(metrics.availability_success_rate?.values?.rate)}                              ║
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
