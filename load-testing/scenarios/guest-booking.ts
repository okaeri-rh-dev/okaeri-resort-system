/**
 * Guest Booking Load Test Scenario
 *
 * Tests the POST /api/guest-booking endpoint under load.
 * This is the most critical endpoint for the resort system.
 *
 * Target: P95 < 500ms, Error Rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import { getEnvironment } from "../config/environments.js";
import { endpointThresholds } from "../config/thresholds.js";
import {
  generateGuestBookingData,
  generateIdempotencyKey,
  getRandomUnitId,
} from "../utils/data-generators.js";

// Custom metrics
const bookingSuccessRate = new Rate("booking_success_rate");
const bookingDuration = new Trend("booking_duration", true);

// Environment configuration
const env = getEnvironment();

// Test options
export const options = {
  scenarios: {
    guest_booking: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 5 }, // Ramp up to 5 VUs
        { duration: "1m", target: 10 }, // Ramp up to 10 VUs
        { duration: "2m", target: 10 }, // Stay at 10 VUs
        { duration: "30s", target: 0 }, // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...endpointThresholds.guest_booking,
    booking_success_rate: [{ threshold: "rate>0.95", abortOnFail: true }],
    booking_duration: [{ threshold: "p(95)<500", abortOnFail: false }],
  },
};

export default function () {
  const unitId = getRandomUnitId();
  const bookingData = generateGuestBookingData(unitId);

  const headers = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": generateIdempotencyKey(),
  };

  const startTime = Date.now();

  const response = http.post(`${env.baseUrl}/api/guest-booking`, JSON.stringify(bookingData), {
    headers,
    tags: { endpoint: "guest-booking" },
  });

  const duration = Date.now() - startTime;
  bookingDuration.add(duration);

  // Check response
  const success = check(response, {
    "status is 201 (created)": (r) => r.status === 201,
    "has booking_id": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return !!body.booking?.booking_id;
      } catch {
        return false;
      }
    },
    "has upload credentials": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return !!body.upload?.token;
      } catch {
        return false;
      }
    },
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  bookingSuccessRate.add(success);

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers["Retry-After"] || "60");
    console.log(`Rate limited. Waiting ${retryAfter}s before retry.`);
    sleep(Math.min(retryAfter, 60)); // Cap at 60s for test efficiency
    return;
  }

  // Log failures for debugging
  if (!success && response.status !== 429) {
    console.log(`Booking failed: Status ${response.status}, Body: ${response.body}`);
  }

  // Think time between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    "load-testing/results/guest-booking-summary.json": JSON.stringify(data, null, 2),
    stdout: generateTextSummary(data),
  };
}

function generateTextSummary(data: Record<string, unknown>): string {
  const metrics = data.metrics as Record<string, { values: Record<string, number> }>;

  return `
╔═══════════════════════════════════════════════════════════════╗
║              GUEST BOOKING LOAD TEST RESULTS                  ║
╠═══════════════════════════════════════════════════════════════╣
║ Endpoint: POST /api/guest-booking                             ║
║ Target: P95 < 500ms, Error Rate < 1%                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Response Time:                                                ║
║   - Median (P50): ${formatMs(metrics.http_req_duration?.values?.med)}                             ║
║   - P90: ${formatMs(metrics.http_req_duration?.values?.["p(90)"])}                                       ║
║   - P95: ${formatMs(metrics.http_req_duration?.values?.["p(95)"])}                                       ║
║   - P99: ${formatMs(metrics.http_req_duration?.values?.["p(99)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Success Rate: ${formatPercent(metrics.booking_success_rate?.values?.rate)}                              ║
║ Total Requests: ${metrics.http_reqs?.values?.count || 0}                                      ║
╚═══════════════════════════════════════════════════════════════╝
`;
}

function formatMs(value?: number): string {
  return value !== undefined ? `${value.toFixed(2)}ms` : "N/A";
}

function formatPercent(value?: number): string {
  return value !== undefined ? `${(value * 100).toFixed(2)}%` : "N/A";
}
