/**
 * Mixed Workload Load Test Scenario
 *
 * Simulates realistic production traffic with a mix of:
 * - 10% Guest Bookings (write-heavy)
 * - 60% Availability Checks (read-heavy)
 * - 30% Status Checks (read-heavy)
 *
 * This distribution mirrors expected production traffic patterns.
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

import { getEnvironment } from "../config/environments.js";
import { getMixedWorkloadThresholds } from "../config/thresholds.js";
import {
  generateBookingDates,
  generateGuestBookingData,
  generateIdempotencyKey,
  getRandomUnitId,
} from "../utils/data-generators.js";

// Custom metrics
const bookingRequests = new Counter("booking_requests");
const availabilityRequests = new Counter("availability_requests");
const statusRequests = new Counter("status_requests");
const overallSuccessRate = new Rate("overall_success_rate");
const bookingDuration = new Trend("booking_duration", true);
const availabilityDuration = new Trend("availability_duration", true);
const statusDuration = new Trend("status_duration", true);

// Environment configuration
const env = getEnvironment();

// Traffic distribution weights
const TRAFFIC_WEIGHTS = {
  booking: 0.1, // 10%
  availability: 0.6, // 60%
  status: 0.3, // 30%
};

// Test options
export const options = {
  scenarios: {
    // Smoke test (quick validation)
    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      startTime: "0s",
      tags: { test_type: "smoke" },
    },

    // Load test (normal production load)
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 }, // Ramp up
        { duration: "3m", target: 25 }, // Normal load
        { duration: "1m", target: 50 }, // Peak load
        { duration: "2m", target: 50 }, // Sustain peak
        { duration: "1m", target: 0 }, // Ramp down
      ],
      startTime: "30s", // Start after smoke test
      tags: { test_type: "load" },
    },
  },
  thresholds: {
    ...getMixedWorkloadThresholds(),
    overall_success_rate: [{ threshold: "rate>0.95", abortOnFail: true }],
    booking_duration: [{ threshold: "p(95)<500", abortOnFail: false }],
    availability_duration: [{ threshold: "p(95)<100", abortOnFail: false }],
    status_duration: [{ threshold: "p(95)<200", abortOnFail: false }],
  },
};

// Track created bookings for status checks
const createdBookingIds: string[] = [];

export function setup() {
  // Prepare test data
  const testBookingIds = __ENV.TEST_BOOKING_IDS?.split(",") || [];
  console.log(`Starting mixed workload test against ${env.name} (${env.baseUrl})`);
  return { existingBookingIds: testBookingIds };
}

export default function (data: { existingBookingIds: string[] }) {
  // Randomly select operation based on traffic weights
  const rand = Math.random();

  if (rand < TRAFFIC_WEIGHTS.booking) {
    doGuestBooking();
  } else if (rand < TRAFFIC_WEIGHTS.booking + TRAFFIC_WEIGHTS.availability) {
    doAvailabilityCheck();
  } else {
    doStatusCheck(data.existingBookingIds);
  }
}

/**
 * Guest Booking operation (10% of traffic)
 */
function doGuestBooking() {
  group("Guest Booking", () => {
    bookingRequests.add(1);
    const unitId = getRandomUnitId();
    const bookingData = generateGuestBookingData(unitId);

    const response = http.post(`${env.baseUrl}/api/guest-booking`, JSON.stringify(bookingData), {
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": generateIdempotencyKey(),
      },
      tags: { endpoint: "guest-booking", operation: "booking" },
    });

    bookingDuration.add(response.timings.duration);

    const success = check(response, {
      "booking: status 201": (r) => r.status === 201,
      "booking: has booking_id": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          if (body.booking?.booking_id) {
            createdBookingIds.push(body.booking.booking_id);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    overallSuccessRate.add(success);

    // Rate limited? Back off
    if (response.status === 429) {
      sleep(10);
    }
  });

  // Think time after booking
  sleep(Math.random() * 2 + 1);
}

/**
 * Availability Check operation (60% of traffic)
 */
function doAvailabilityCheck() {
  group("Availability Check", () => {
    availabilityRequests.add(1);
    const unitId = getRandomUnitId();
    const dates = generateBookingDates();

    const params = new URLSearchParams({
      unit_id: unitId,
      check_in: dates.checkIn,
      check_out: dates.checkOut,
    });

    const response = http.get(`${env.baseUrl}/api/availability/check?${params.toString()}`, {
      tags: { endpoint: "availability", operation: "availability" },
    });

    availabilityDuration.add(response.timings.duration);

    const success = check(response, {
      "availability: status 200": (r) => r.status === 200,
      "availability: has data": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return typeof body.available === "boolean";
        } catch {
          return false;
        }
      },
    });

    overallSuccessRate.add(success);
  });

  // Quick think time for reads
  sleep(0.5);
}

/**
 * Status Check operation (30% of traffic)
 */
function doStatusCheck(existingBookingIds: string[]) {
  group("Status Check", () => {
    statusRequests.add(1);

    // Use created booking IDs or existing ones
    const allBookingIds = [...createdBookingIds, ...existingBookingIds];

    if (allBookingIds.length === 0) {
      // No booking IDs available, skip this iteration
      console.log("No booking IDs available for status check");
      return;
    }

    const bookingId = allBookingIds[Math.floor(Math.random() * allBookingIds.length)];

    const response = http.get(`${env.baseUrl}/api/guest-booking/status?booking_id=${bookingId}`, {
      tags: { endpoint: "status", operation: "status" },
    });

    statusDuration.add(response.timings.duration);

    const success = check(response, {
      "status: status 200 or 404": (r) => r.status === 200 || r.status === 404,
    });

    overallSuccessRate.add(success);

    // Rate limited? Back off
    if (response.status === 429) {
      sleep(5);
    }
  });

  // Quick think time for reads
  sleep(0.3);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    "load-testing/results/mixed-workload-summary.json": JSON.stringify(data, null, 2),
    stdout: generateTextSummary(data),
  };
}

function generateTextSummary(data: Record<string, unknown>): string {
  const metrics = data.metrics as Record<string, { values: Record<string, number> }>;

  return `
╔═══════════════════════════════════════════════════════════════╗
║              MIXED WORKLOAD LOAD TEST RESULTS                 ║
╠═══════════════════════════════════════════════════════════════╣
║ Environment: ${env.name.padEnd(47)}║
║ Traffic Mix: 10% Bookings, 60% Availability, 30% Status       ║
╠═══════════════════════════════════════════════════════════════╣
║ OVERALL METRICS                                               ║
║   - Success Rate: ${formatPercent(metrics.overall_success_rate?.values?.rate)}                          ║
║   - Total Requests: ${metrics.http_reqs?.values?.count || 0}                                  ║
║   - RPS: ${formatRps(metrics.http_reqs?.values?.rate)}                                      ║
╠═══════════════════════════════════════════════════════════════╣
║ BOOKING ENDPOINT (Target P95 < 500ms)                         ║
║   - Requests: ${metrics.booking_requests?.values?.count || 0}                                       ║
║   - P95: ${formatMs(metrics.booking_duration?.values?.["p(95)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ AVAILABILITY ENDPOINT (Target P95 < 100ms)                    ║
║   - Requests: ${metrics.availability_requests?.values?.count || 0}                                       ║
║   - P95: ${formatMs(metrics.availability_duration?.values?.["p(95)"])}                                       ║
╠═══════════════════════════════════════════════════════════════╣
║ STATUS ENDPOINT (Target P95 < 200ms)                          ║
║   - Requests: ${metrics.status_requests?.values?.count || 0}                                       ║
║   - P95: ${formatMs(metrics.status_duration?.values?.["p(95)"])}                                       ║
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
