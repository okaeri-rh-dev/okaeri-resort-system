/**
 * K6 Load Testing Suite for API Endpoints
 * @since Phase 1.7 - Performance Testing
 *
 * Comprehensive load testing for resort management API
 * covering authentication, bookings, expenses, and concurrent operations
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";
import { SharedArray } from "k6/data";

// Custom metrics
const errorRate = new Rate("errors");
const apiDuration = new Trend("api_duration");
const bookingCreationDuration = new Trend("booking_creation_duration");
const authDuration = new Trend("auth_duration");
const successfulRequests = new Counter("successful_requests");
const failedRequests = new Counter("failed_requests");
const activeVUs = new Gauge("active_vus");

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 50 }, // Stay at 50 users
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "1m", target: 200 }, // Peak load at 200 users
    { duration: "30s", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    errors: ["rate<0.01"], // Error rate < 1%
    api_duration: ["p(95)<500"], // 95% of requests < 500ms
    booking_creation_duration: ["p(95)<1000"], // 95% of booking creations < 1s
    auth_duration: ["p(95)<300"], // 95% of auth requests < 300ms
    http_req_duration: ["p(99)<1000"], // 99% of all requests < 1s
    http_req_failed: ["rate<0.05"], // Overall failure rate < 5%
  },
};

// Scenarios for different user behaviors
export const scenarios = {
  regular_operations: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 50 },
      { duration: "2m", target: 50 },
      { duration: "30s", target: 0 },
    ],
    exec: "regularUserFlow",
  },
  burst_traffic: {
    executor: "shared-iterations",
    vus: 100,
    iterations: 500,
    startTime: "30s",
    exec: "burstTrafficFlow",
  },
  sustained_load: {
    executor: "constant-vus",
    vus: 30,
    duration: "5m",
    exec: "sustainedLoadFlow",
  },
};

// Test data
const testUsers = new SharedArray("users", function () {
  return [
    { email: "test1@okaeri.ph", password: "TestPassword123!" },
    { email: "test2@okaeri.ph", password: "TestPassword123!" },
    { email: "test3@okaeri.ph", password: "TestPassword123!" },
    { email: "test4@okaeri.ph", password: "TestPassword123!" },
    { email: "test5@okaeri.ph", password: "TestPassword123!" },
  ];
});

const bookingData = new SharedArray("bookings", function () {
  const bookings = [];
  const today = new Date();

  for (let i = 0; i < 100; i++) {
    const checkin = new Date(today.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
    const checkout = new Date(checkin.getTime() + (1 + Math.random() * 7) * 24 * 60 * 60 * 1000);

    bookings.push({
      guestName: `Guest ${i}`,
      guestEmail: `guest${i}@test.com`,
      checkinDate: checkin.toISOString().split("T")[0],
      checkoutDate: checkout.toISOString().split("T")[0],
      guestCount: Math.ceil(Math.random() * 4),
      totalAmount: 3000 + Math.random() * 7000,
      source: ["direct", "airbnb", "booking", "agoda"][Math.floor(Math.random() * 4)],
      status: "confirmed",
    });
  }

  return bookings;
});

// Helper functions
function getBaseUrl() {
  return __ENV.API_URL || "http://localhost:3000";
}

function login(email?: string, password?: string) {
  const user =
    email && password
      ? { email, password }
      : testUsers[Math.floor(Math.random() * testUsers.length)];

  const startTime = new Date().getTime();
  const res = http.post(`${getBaseUrl()}/api/auth/login`, JSON.stringify(user), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "auth_login" },
  });

  authDuration.add(new Date().getTime() - startTime);

  const success = check(res, {
    "login successful": (r) => r.status === 200,
    "has access token": (r) => JSON.parse(r.body).accessToken !== undefined,
  });

  if (success) {
    successfulRequests.add(1);
    return JSON.parse(res.body).accessToken;
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    return null;
  }
}

// Main test scenario
export default function () {
  activeVUs.add(1);

  // Login
  const token = login();

  if (!token) {
    console.error("Login failed, skipping test iteration");
    activeVUs.add(-1);
    return;
  }

  // Get project ID (assuming first project)
  const projectsRes = http.get(`${getBaseUrl()}/api/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    tags: { name: "get_projects" },
  });

  if (projectsRes.status !== 200) {
    errorRate.add(1);
    activeVUs.add(-1);
    return;
  }

  const projects = JSON.parse(projectsRes.body);
  const projectId = projects[0]?.id;

  if (!projectId) {
    console.error("No projects found");
    activeVUs.add(-1);
    return;
  }

  // Test booking operations
  testBookingOperations(token, projectId);

  // Test expense operations
  testExpenseOperations(token, projectId);

  // Test dashboard metrics
  testDashboardMetrics(token, projectId);

  // Logout
  http.post(`${getBaseUrl()}/api/auth/logout`, null, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "auth_logout" },
  });

  activeVUs.add(-1);
  sleep(1); // Think time between iterations
}

function testBookingOperations(token: string, projectId: string) {
  // Create booking
  const booking = bookingData[Math.floor(Math.random() * bookingData.length)];
  const startTime = new Date().getTime();

  const createRes = http.post(
    `${getBaseUrl()}/api/projects/${projectId}/bookings`,
    JSON.stringify(booking),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      tags: { name: "create_booking" },
    }
  );

  bookingCreationDuration.add(new Date().getTime() - startTime);

  const createSuccess = check(createRes, {
    "booking created": (r) => r.status === 201,
    "has booking id": (r) => r.status === 201 && JSON.parse(r.body).id !== undefined,
  });

  if (createSuccess) {
    successfulRequests.add(1);
    const bookingId = JSON.parse(createRes.body).id;

    // Get booking list
    const listRes = http.get(`${getBaseUrl()}/api/projects/${projectId}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: "list_bookings" },
    });

    apiDuration.add(listRes.timings.duration);

    check(listRes, {
      "booking list retrieved": (r) => r.status === 200,
      "is array": (r) => Array.isArray(JSON.parse(r.body)),
    });

    // Get specific booking
    const getRes = http.get(`${getBaseUrl()}/api/projects/${projectId}/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: "get_booking" },
    });

    check(getRes, {
      "booking retrieved": (r) => r.status === 200,
    });

    // Update booking
    const updateRes = http.put(
      `${getBaseUrl()}/api/projects/${projectId}/bookings/${bookingId}`,
      JSON.stringify({ guestCount: booking.guestCount + 1 }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        tags: { name: "update_booking" },
      }
    );

    check(updateRes, {
      "booking updated": (r) => r.status === 200,
    });

    // Delete booking (50% chance to keep some data)
    if (Math.random() > 0.5) {
      const deleteRes = http.del(
        `${getBaseUrl()}/api/projects/${projectId}/bookings/${bookingId}`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          tags: { name: "delete_booking" },
        }
      );

      check(deleteRes, {
        "booking deleted": (r) => r.status === 204,
      });
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
}

function testExpenseOperations(token: string, projectId: string) {
  // Create expense
  const expense = {
    description: `Load test expense ${Date.now()}`,
    amount: 100 + Math.random() * 1000,
    category: ["supplies", "utilities", "maintenance", "other"][Math.floor(Math.random() * 4)],
    expenseDate: new Date().toISOString().split("T")[0],
  };

  const createRes = http.post(
    `${getBaseUrl()}/api/projects/${projectId}/expenses`,
    JSON.stringify(expense),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      tags: { name: "create_expense" },
    }
  );

  apiDuration.add(createRes.timings.duration);

  const createSuccess = check(createRes, {
    "expense created": (r) => r.status === 201,
    "has expense id": (r) => r.status === 201 && JSON.parse(r.body).id !== undefined,
  });

  if (createSuccess) {
    successfulRequests.add(1);

    // List expenses
    const listRes = http.get(`${getBaseUrl()}/api/projects/${projectId}/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: "list_expenses" },
    });

    check(listRes, {
      "expense list retrieved": (r) => r.status === 200,
      "is array": (r) => Array.isArray(JSON.parse(r.body)),
    });
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
}

function testDashboardMetrics(token: string, projectId: string) {
  // Get dashboard metrics
  const metricsRes = http.get(`${getBaseUrl()}/api/projects/${projectId}/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "dashboard_metrics" },
  });

  apiDuration.add(metricsRes.timings.duration);

  check(metricsRes, {
    "metrics retrieved": (r) => r.status === 200 || r.status === 404, // 404 if endpoint doesn't exist yet
  });

  // Get recent activity
  const activityRes = http.get(`${getBaseUrl()}/api/projects/${projectId}/dashboard/activity`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "dashboard_activity" },
  });

  check(activityRes, {
    "activity retrieved": (r) => r.status === 200 || r.status === 404,
  });
}

// Scenario: Regular user flow
export function regularUserFlow() {
  const token = login();
  if (!token) return;

  // Simulate typical user behavior
  sleep(Math.random() * 2); // Think time

  // View dashboard
  http.get(`${getBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  sleep(Math.random() * 3);

  // Check bookings
  http.get(`${getBaseUrl()}/api/projects/*/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  sleep(Math.random() * 5);

  // Maybe create a booking (30% chance)
  if (Math.random() < 0.3) {
    const booking = bookingData[Math.floor(Math.random() * bookingData.length)];
    http.post(`${getBaseUrl()}/api/projects/*/bookings`, JSON.stringify(booking), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  sleep(Math.random() * 2);

  // Logout
  http.post(`${getBaseUrl()}/api/auth/logout`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Scenario: Burst traffic
export function burstTrafficFlow() {
  // Simulate sudden spike in traffic
  const token = login();
  if (!token) return;

  // Rapid requests
  for (let i = 0; i < 5; i++) {
    http.get(`${getBaseUrl()}/api/projects/*/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

// Scenario: Sustained load
export function sustainedLoadFlow() {
  const token = login();
  if (!token) return;

  // Continuous operations
  while (true) {
    http.get(`${getBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    sleep(5);

    http.get(`${getBaseUrl()}/api/projects/*/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    sleep(5);
  }
}
