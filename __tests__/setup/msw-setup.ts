/**
 * MSW Setup for Vitest
 *
 * Starts the MSW server before all tests and cleans up after.
 * This file is loaded via Vitest's setupFiles configuration.
 */

import { afterAll, afterEach, beforeAll } from "vitest";

import { resetIdempotencyCache, resetMultiUnitBookings } from "../mocks/handlers";
import { server } from "../mocks/server";

// Start server before all tests
beforeAll(() => {
  server.listen({
    // Allow Supabase REST API requests to pass through (for database constraint tests)
    // Warn about other unhandled requests
    onUnhandledRequest: (request) => {
      // Allow Supabase REST API calls to pass through
      if (request.url.includes("/rest/v1/") || request.url.includes(":54321")) {
        return;
      }
      // Warn about other unhandled requests
      console.warn(
        `[MSW] Warning: intercepted unhandled request: ${request.method} ${request.url}`
      );
    },
  });
  console.log("🔧 MSW server started for API mocking");
});

// Reset handlers and caches after each test
afterEach(() => {
  server.resetHandlers();
  resetIdempotencyCache();
  resetMultiUnitBookings();
});

// Clean up after all tests
afterAll(() => {
  server.close();
  console.log("✅ MSW server closed");
});
