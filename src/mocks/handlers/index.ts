/**
 * MSW Handlers Index
 * Combines all API handlers for the mock service worker
 */

import { http, HttpResponse } from "msw";
import { authHandlers } from "./auth";
import { bookingHandlers } from "./bookings";

/**
 * Health check endpoint
 */
const healthHandlers = [
  http.get("/api/health", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return HttpResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: "mock",
      version: "1.0.0",
      database: "IndexedDB",
    });
  }),
];

/**
 * Fallback handler for unmatched requests
 */
const fallbackHandlers = [
  http.all("*", ({ request }) => {
    const url = new URL(request.url);

    // Only handle API routes that we haven't implemented yet
    if (url.pathname.startsWith("/api/")) {
      console.warn(`[MSW] Unhandled API request: ${request.method} ${url.pathname}`);
      return HttpResponse.json(
        {
          error: "Not implemented",
          message: `API endpoint ${request.method} ${url.pathname} is not yet implemented in mock handlers`,
          path: url.pathname,
          method: request.method,
        },
        { status: 501 }
      );
    }

    // Pass through non-API requests
    return undefined;
  }),
];

/**
 * All handlers combined in the correct order
 * More specific handlers should come first
 */
export const handlers = [
  ...authHandlers,
  ...bookingHandlers,
  ...healthHandlers,
  ...fallbackHandlers, // Keep this last
];

/**
 * Export individual handler groups for selective use
 */
export { authHandlers, bookingHandlers, healthHandlers };
