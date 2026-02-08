/**
 * Load Testing Thresholds (SLA Definitions)
 *
 * Defines performance thresholds that determine test pass/fail criteria.
 * These thresholds are based on the performance targets from the optimization plan.
 */

import { Threshold } from "k6/options";

/**
 * Performance targets from the optimization plan:
 * - Guest Booking P95: <500ms
 * - Availability Check P95: <100ms
 * - Concurrent Users: 50+
 * - Error Rate: <1%
 */

export interface ThresholdConfig {
  http_req_duration: Threshold[];
  http_req_failed: Threshold[];
  http_reqs: Threshold[];
  iteration_duration: Threshold[];
}

/**
 * Standard thresholds for production-ready performance
 */
export const standardThresholds: ThresholdConfig = {
  // Response time thresholds
  http_req_duration: [
    { threshold: "p(50)<300", abortOnFail: false }, // Median under 300ms
    { threshold: "p(90)<500", abortOnFail: false }, // 90th percentile under 500ms
    { threshold: "p(95)<800", abortOnFail: true }, // 95th percentile under 800ms (fail test if exceeded)
    { threshold: "p(99)<1500", abortOnFail: false }, // 99th percentile under 1.5s
  ],

  // Error rate thresholds
  http_req_failed: [
    { threshold: "rate<0.01", abortOnFail: true }, // Less than 1% error rate
  ],

  // Throughput thresholds
  http_reqs: [
    { threshold: "rate>10", abortOnFail: false }, // At least 10 requests per second
  ],

  // Iteration duration (full user flow)
  iteration_duration: [
    { threshold: "p(95)<3000", abortOnFail: false }, // 95th percentile under 3s
  ],
};

/**
 * Endpoint-specific thresholds using k6 tags
 */
export const endpointThresholds = {
  // Guest Booking endpoint - target P95 < 500ms
  guest_booking: {
    "http_req_duration{endpoint:guest-booking}": [
      { threshold: "p(95)<500", abortOnFail: true },
    ],
    "http_req_failed{endpoint:guest-booking}": [{ threshold: "rate<0.01", abortOnFail: true }],
  },

  // Availability Check endpoint - target P95 < 100ms
  availability: {
    "http_req_duration{endpoint:availability}": [
      { threshold: "p(95)<100", abortOnFail: false },
    ],
    "http_req_failed{endpoint:availability}": [{ threshold: "rate<0.01", abortOnFail: false }],
  },

  // Status Check endpoint - target P95 < 200ms
  status_check: {
    "http_req_duration{endpoint:status}": [{ threshold: "p(95)<200", abortOnFail: false }],
    "http_req_failed{endpoint:status}": [{ threshold: "rate<0.01", abortOnFail: false }],
  },
};

/**
 * Combined thresholds for mixed workload tests
 */
export function getMixedWorkloadThresholds(): Record<string, Threshold[]> {
  return {
    ...standardThresholds,
    ...endpointThresholds.guest_booking,
    ...endpointThresholds.availability,
    ...endpointThresholds.status_check,
  };
}

/**
 * Relaxed thresholds for stress testing
 * Used when intentionally pushing beyond normal limits
 */
export const stressTestThresholds: ThresholdConfig = {
  http_req_duration: [
    { threshold: "p(50)<500", abortOnFail: false },
    { threshold: "p(90)<1000", abortOnFail: false },
    { threshold: "p(95)<2000", abortOnFail: false },
    { threshold: "p(99)<5000", abortOnFail: false },
  ],

  http_req_failed: [
    { threshold: "rate<0.05", abortOnFail: false }, // Allow up to 5% errors under stress
  ],

  http_reqs: [
    { threshold: "rate>5", abortOnFail: false },
  ],

  iteration_duration: [
    { threshold: "p(95)<10000", abortOnFail: false },
  ],
};
