/**
 * MSW Server Setup
 *
 * Creates a mock server instance for intercepting HTTP requests in tests.
 * This runs in Node.js environment (not browser), perfect for Vitest.
 */

import { http, passthrough } from "msw";
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

// Passthrough handlers for Supabase REST API (allows database integration tests)
const supabasePassthroughHandlers = [
  http.all("http://127.0.0.1:54321/rest/v1/*", () => passthrough()),
  http.all("http://localhost:54321/rest/v1/*", () => passthrough()),
];

// Create server instance with handlers (Supabase passthrough first, then mocks)
export const server = setupServer(...supabasePassthroughHandlers, ...handlers);
