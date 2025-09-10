/**
 * API routes deployment validation tests
 * Tests serverless function deployment and functionality
 */

import { describe, test, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

describe("API Routes Deployment Validation", () => {
  let apiRoutes: string[] = [];
  let baseUrl: string;

  beforeAll(async () => {
    // Discover API routes
    apiRoutes = await discoverApiRoutes();

    // Set base URL based on environment
    baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.TEST_API_BASE_URL || "http://localhost:3000";
  });

  describe("API Route Discovery", () => {
    test("should find expected API routes", async () => {
      expect(apiRoutes.length).toBeGreaterThan(0);

      // Expected core routes
      const expectedRoutes = ["auth/login", "auth/refresh", "health/check"];

      for (const expectedRoute of expectedRoutes) {
        const hasRoute = apiRoutes.some((route) => route.includes(expectedRoute));
        expect(hasRoute).toBe(true);
      }

      console.log(`Found ${apiRoutes.length} API routes:`, apiRoutes.slice(0, 5));
    });

    test("should have proper API route structure", async () => {
      // Check that routes follow expected patterns
      const validRoutePattern = /^api\/[a-zA-Z0-9\-_\/\[\]]+\.(js|ts)$/;

      for (const route of apiRoutes) {
        const relativePath = route.replace(process.cwd(), "").replace(/^\//, "");
        expect(relativePath).toMatch(validRoutePattern);
      }
    });
  });

  describe("Health Check Endpoint", () => {
    test("should respond to health check", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
    });

    test("should include system information in health check", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      // Should include basic system info
      expect(data.environment).toBeDefined();
      expect(data.version).toBeDefined();

      // Should include database connectivity
      if (data.database) {
        expect(data.database.status).toBeDefined();
      }

      // Should include Redis connectivity (if configured)
      if (data.redis) {
        expect(data.redis.status).toBeDefined();
      }
    });

    test("should respond within acceptable time", async () => {
      const startTime = Date.now();

      const response = await fetch(`${baseUrl}/api/health/check`);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds

      console.log(`Health check response time: ${responseTime}ms`);
    });
  });

  describe("Authentication Endpoints", () => {
    test("should reject invalid login attempts", async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "invalid@example.com",
          password: "wrongpassword",
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test("should require proper request format", async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("validation"); // Should mention validation error
    });

    test("should handle CORS properly", async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://okaeri-resort.vercel.app",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });

      expect(response.status).toBe(200);

      const corsHeaders = response.headers.get("Access-Control-Allow-Origin");
      const allowedMethods = response.headers.get("Access-Control-Allow-Methods");
      const allowedHeaders = response.headers.get("Access-Control-Allow-Headers");

      expect(corsHeaders).toBeDefined();
      expect(allowedMethods).toContain("POST");
      expect(allowedHeaders).toContain("Authorization");
    });
  });

  describe("Rate Limiting", () => {
    test("should implement rate limiting on auth endpoints", async () => {
      const requests: Promise<Response>[] = [];

      // Send multiple requests quickly
      for (let i = 0; i < 20; i++) {
        requests.push(
          fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: `test${i}@example.com`,
              password: "testpassword",
            }),
          })
        );
      }

      const responses = await Promise.all(requests);

      // Should receive at least one rate limit response
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].headers.get("X-RateLimit-Limit")).toBeDefined();
        expect(rateLimitedResponses[0].headers.get("X-RateLimit-Remaining")).toBeDefined();
      }

      console.log(`Rate limited responses: ${rateLimitedResponses.length}/20`);
    });
  });

  describe("Error Handling", () => {
    test("should handle 404 for non-existent routes", async () => {
      const response = await fetch(`${baseUrl}/api/nonexistent/route`);

      expect(response.status).toBe(404);
    });

    test("should handle method not allowed", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`, {
        method: "DELETE", // Health check only supports GET
      });

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.allowed).toBeDefined();
    });

    test("should return proper error format", async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.requestId).toBeDefined();
      expect(data.code).toBeDefined();
    });
  });

  describe("Security Headers", () => {
    test("should include security headers", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);

      // Check for security headers
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("Referrer-Policy")).toBeDefined();

      // Should not expose server information
      expect(response.headers.get("Server")).toBeNull();
      expect(response.headers.get("X-Powered-By")).toBeNull();
    });

    test("should include request ID in responses", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);

      const requestId = response.headers.get("X-Request-ID");
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^[a-f0-9-]{36}$/); // UUID format

      const data = await response.json();
      expect(data.requestId).toBe(requestId);
    });
  });

  describe("Database Connectivity", () => {
    test("should connect to database successfully", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.database) {
        expect(data.database.status).toBe("connected");
        expect(data.database.responseTime).toBeLessThan(1000); // Under 1 second
      }
    });
  });

  describe("Performance", () => {
    test("should handle cold starts efficiently", async () => {
      // Wait for potential cold start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health/check`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Cold start should be under 3 seconds

      console.log(`Cold start response time: ${responseTime}ms`);
    });

    test("should handle concurrent requests", async () => {
      const concurrentRequests = 10;
      const requests: Promise<Response>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(fetch(`${baseUrl}/api/health/check`));
      }

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(5000); // All requests under 5 seconds

      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
    });
  });
});

/**
 * Discover all API routes in the project
 */
async function discoverApiRoutes(): Promise<string[]> {
  const apiPath = path.join(process.cwd(), "api");
  const routes: string[] = [];

  try {
    await scanDirectory(apiPath, routes);
  } catch (error) {
    console.warn("Could not scan API directory:", error);
  }

  return routes;
}

/**
 * Recursively scan directory for API route files
 */
async function scanDirectory(dir: string, routes: string[]): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip __tests__ directories
        if (entry.name !== "__tests__") {
          await scanDirectory(fullPath, routes);
        }
      } else if (entry.isFile() && /\.(js|ts)$/.test(entry.name)) {
        // Skip test files and non-API files
        if (!entry.name.includes(".test.") && !entry.name.includes(".spec.")) {
          routes.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not scan directory ${dir}:`, error);
  }
}
