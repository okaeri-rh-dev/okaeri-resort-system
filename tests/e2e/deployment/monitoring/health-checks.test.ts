/**
 * Health check and monitoring validation tests
 * Tests system health endpoints and monitoring integration
 */

import { describe, test, expect, beforeAll } from "vitest";

describe("Health Check and Monitoring", () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.TEST_API_BASE_URL || "http://localhost:3000";
  });

  describe("Basic Health Check", () => {
    test("should respond to health check endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/json");

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });

    test("should include system information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      // Basic system info
      expect(data.version).toBeDefined();
      expect(data.environment).toBeDefined();
      expect(data.nodeVersion).toBeDefined();

      // Should not expose sensitive info
      expect(data.secrets).toBeUndefined();
      expect(data.privateKeys).toBeUndefined();
      expect(data.databasePassword).toBeUndefined();
    });

    test("should respond within acceptable time limits", async () => {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health/check`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds

      console.log(`Health check response time: ${responseTime}ms`);
    });
  });

  describe("Database Health Check", () => {
    test("should verify database connectivity", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.database) {
        expect(data.database.status).toBeDefined();
        expect(["connected", "healthy", "ok"]).toContain(data.database.status);

        if (data.database.responseTime) {
          expect(data.database.responseTime).toBeLessThan(1000); // DB should respond within 1 second
        }

        console.log(`Database status: ${data.database.status}`);
      }
    });

    test("should include connection pool information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.database && data.database.connectionPool) {
        expect(data.database.connectionPool.active).toBeDefined();
        expect(data.database.connectionPool.idle).toBeDefined();
        expect(data.database.connectionPool.total).toBeDefined();

        // Pool should have reasonable numbers
        expect(data.database.connectionPool.total).toBeGreaterThan(0);
        expect(data.database.connectionPool.total).toBeLessThan(20); // Reasonable upper limit

        console.log(
          `Connection pool - Total: ${data.database.connectionPool.total}, Active: ${data.database.connectionPool.active}`
        );
      }
    });
  });

  describe("Redis Health Check", () => {
    test("should verify Redis connectivity", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.redis) {
        expect(data.redis.status).toBeDefined();
        expect(["connected", "healthy", "ok"]).toContain(data.redis.status);

        if (data.redis.responseTime) {
          expect(data.redis.responseTime).toBeLessThan(500); // Redis should be very fast
        }

        console.log(`Redis status: ${data.redis.status}`);
      } else {
        console.log("Redis not configured or not included in health check");
      }
    });

    test("should include Redis memory information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.redis && data.redis.memory) {
        expect(data.redis.memory.used).toBeDefined();
        expect(data.redis.memory.total).toBeDefined();

        // Memory usage should be reasonable
        const usagePercent = (data.redis.memory.used / data.redis.memory.total) * 100;
        expect(usagePercent).toBeLessThan(90); // Less than 90% memory usage

        console.log(`Redis memory usage: ${usagePercent.toFixed(1)}%`);
      }
    });
  });

  describe("System Resource Monitoring", () => {
    test("should include memory usage information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.system) {
        if (data.system.memory) {
          expect(data.system.memory.used).toBeDefined();
          expect(data.system.memory.total).toBeDefined();
          expect(data.system.memory.free).toBeDefined();

          // Sanity check memory values
          expect(data.system.memory.used).toBeGreaterThan(0);
          expect(data.system.memory.total).toBeGreaterThan(data.system.memory.used);
          expect(data.system.memory.free).toBeGreaterThan(0);

          const memoryUsagePercent = (data.system.memory.used / data.system.memory.total) * 100;
          console.log(`System memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        }
      }
    });

    test("should include CPU information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.system && data.system.cpu) {
        expect(data.system.cpu.cores).toBeDefined();
        expect(data.system.cpu.cores).toBeGreaterThan(0);

        if (data.system.cpu.usage) {
          expect(data.system.cpu.usage).toBeGreaterThanOrEqual(0);
          expect(data.system.cpu.usage).toBeLessThanOrEqual(100);

          console.log(`CPU cores: ${data.system.cpu.cores}, Usage: ${data.system.cpu.usage}%`);
        }
      }
    });

    test("should include load average information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.system && data.system.loadAverage) {
        expect(Array.isArray(data.system.loadAverage)).toBe(true);
        expect(data.system.loadAverage.length).toBe(3); // 1min, 5min, 15min

        // Load averages should be reasonable numbers
        data.system.loadAverage.forEach((load: number) => {
          expect(load).toBeGreaterThanOrEqual(0);
          expect(load).toBeLessThan(100); // Very high load would be concerning
        });

        console.log(`Load averages: [${data.system.loadAverage.join(", ")}]`);
      }
    });
  });

  describe("Application Metrics", () => {
    test("should include application uptime", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      expect(data.uptime).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);

      // Uptime should be reasonable (not negative, not impossibly large)
      expect(data.uptime).toBeLessThan(30 * 24 * 60 * 60); // Less than 30 days in seconds

      console.log(`Application uptime: ${data.uptime} seconds`);
    });

    test("should include request statistics", async () => {
      // Make a few requests to generate stats
      await fetch(`${baseUrl}/api/health/check`);
      await fetch(`${baseUrl}/api/health/check`);
      await fetch(`${baseUrl}/api/health/check`);

      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.requests) {
        expect(data.requests.total).toBeDefined();
        expect(data.requests.total).toBeGreaterThan(0);

        if (data.requests.averageResponseTime) {
          expect(data.requests.averageResponseTime).toBeGreaterThan(0);
          expect(data.requests.averageResponseTime).toBeLessThan(10000); // Under 10 seconds

          console.log(
            `Request stats - Total: ${data.requests.total}, Avg response: ${data.requests.averageResponseTime}ms`
          );
        }
      }
    });

    test("should include error rate information", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.errors) {
        expect(data.errors.rate).toBeDefined();
        expect(data.errors.rate).toBeGreaterThanOrEqual(0);
        expect(data.errors.rate).toBeLessThanOrEqual(100);

        // Error rate should be low for healthy system
        if (data.errors.rate > 10) {
          console.warn(`High error rate detected: ${data.errors.rate}%`);
        }

        if (data.errors.total) {
          expect(data.errors.total).toBeGreaterThanOrEqual(0);
          console.log(`Error stats - Rate: ${data.errors.rate}%, Total: ${data.errors.total}`);
        }
      }
    });
  });

  describe("External Service Health", () => {
    test("should check external service connectivity", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.externalServices) {
        for (const [serviceName, serviceHealth] of Object.entries(data.externalServices)) {
          expect(serviceHealth).toHaveProperty("status");

          const status = (serviceHealth as any).status;
          expect(["healthy", "degraded", "unhealthy", "unknown"]).toContain(status);

          console.log(`External service ${serviceName}: ${status}`);
        }
      }
    });

    test("should include service response times", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      if (data.externalServices) {
        for (const [serviceName, serviceHealth] of Object.entries(data.externalServices)) {
          const service = serviceHealth as any;

          if (service.responseTime) {
            expect(service.responseTime).toBeGreaterThan(0);
            expect(service.responseTime).toBeLessThan(30000); // Under 30 seconds

            console.log(`${serviceName} response time: ${service.responseTime}ms`);
          }
        }
      }
    });
  });

  describe("Health Check Reliability", () => {
    test("should consistently return healthy status", async () => {
      const checks = [];

      // Perform multiple health checks
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/health/check`);
        const data = await response.json();

        checks.push({
          status: response.status,
          health: data.status,
          timestamp: data.timestamp,
        });

        // Small delay between checks
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // All checks should be successful
      checks.forEach((check, index) => {
        expect(check.status).toBe(200);
        expect(check.health).toBe("healthy");
        expect(check.timestamp).toBeDefined();
      });

      console.log(`Performed ${checks.length} consecutive health checks - all passed`);
    });

    test("should handle concurrent health checks", async () => {
      const concurrentChecks = 10;
      const promises = [];

      for (let i = 0; i < concurrentChecks; i++) {
        promises.push(fetch(`${baseUrl}/api/health/check`));
      }

      const responses = await Promise.all(promises);

      // All concurrent requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
      });

      // Parse all responses
      const healthData = await Promise.all(responses.map((r) => r.json()));

      healthData.forEach((data, index) => {
        expect(data.status).toBe("healthy");
        expect(data.timestamp).toBeDefined();
      });

      console.log(`${concurrentChecks} concurrent health checks completed successfully`);
    });
  });

  describe("Monitoring Integration", () => {
    test("should include monitoring metadata", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      // Should include request ID for tracing
      expect(data.requestId).toBeDefined();

      // Should include environment info
      expect(data.environment).toBeDefined();
      expect(["development", "staging", "production", "test"]).toContain(data.environment);

      // Should include build/version info
      if (data.build) {
        expect(data.build.version || data.build.commit || data.build.timestamp).toBeDefined();
      }
    });

    test("should be suitable for automated monitoring", async () => {
      const response = await fetch(`${baseUrl}/api/health/check`);
      const data = await response.json();

      // Should have a simple status field for monitoring tools
      expect(data.status).toBeDefined();
      expect(["healthy", "unhealthy", "degraded"]).toContain(data.status);

      // Should include timestamp for monitoring tools
      expect(data.timestamp).toBeDefined();
      const timestamp = new Date(data.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute

      // Should be JSON parseable
      expect(typeof data).toBe("object");
      expect(data).not.toBeNull();
    });
  });
});
