/**
 * Performance validation tests for deployment
 * Modern load testing without vulnerable dependencies
 */

import { describe, test, expect, beforeAll } from "vitest";

describe("Performance Load Testing", () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.TEST_API_BASE_URL || "http://localhost:3000";
  });

  describe("Cold Start Performance", () => {
    test("should handle cold start within 3 seconds", async () => {
      // Wait to ensure cold start
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health/check`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // 3 second cold start limit

      console.log(`Cold start performance: ${responseTime}ms`);
    });

    test("should warm up quickly after cold start", async () => {
      // Make first request (potential cold start)
      await fetch(`${baseUrl}/api/health/check`);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Measure warm request
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health/check`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // 500ms warm request limit

      console.log(`Warm request performance: ${responseTime}ms`);
    });
  });

  describe("Concurrent Load Testing", () => {
    test("should handle 10 concurrent requests efficiently", async () => {
      const concurrentRequests = 10;
      const requests: Promise<{ response: Response; time: number }>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const startTime = Date.now();
        requests.push(
          fetch(`${baseUrl}/api/health/check`).then((response) => ({
            response,
            time: Date.now() - startTime,
          }))
        );
      }

      const results = await Promise.all(requests);

      // All requests should succeed
      results.forEach(({ response }, index) => {
        expect(response.status).toBe(200);
      });

      // Calculate performance metrics
      const responseTimes = results.map((r) => r.time);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds

      console.log(
        `Concurrent load test - Avg: ${avgResponseTime.toFixed(0)}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`
      );
    });

    test("should handle 50 concurrent requests without failures", async () => {
      const concurrentRequests = 50;
      const requests: Promise<Response>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(fetch(`${baseUrl}/api/health/check`));
      }

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Count successful responses
      const successfulResponses = responses.filter((r) => r.status === 200);
      const errorResponses = responses.filter((r) => r.status >= 400);

      // Should have high success rate
      expect(successfulResponses.length / responses.length).toBeGreaterThan(0.95); // 95% success rate

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds total

      console.log(
        `Heavy load test - ${successfulResponses.length}/${responses.length} successful, ${totalTime}ms total`
      );

      if (errorResponses.length > 0) {
        console.log(
          `Error responses:`,
          errorResponses.map((r) => r.status)
        );
      }
    });
  });

  describe("Sustained Load Testing", () => {
    test("should maintain performance under sustained load", async () => {
      const duration = 30000; // 30 seconds
      const requestInterval = 500; // Request every 500ms
      const requests: Promise<{ response: Response; time: number }>[] = [];

      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const reqStartTime = Date.now();
        requests.push(
          fetch(`${baseUrl}/api/health/check`).then((response) => ({
            response,
            time: Date.now() - reqStartTime,
          }))
        );

        await new Promise((resolve) => setTimeout(resolve, requestInterval));
      }

      const results = await Promise.all(requests);

      // Analyze performance degradation
      const responseTimes = results.map((r) => r.time);
      const firstHalf = responseTimes.slice(0, Math.floor(responseTimes.length / 2));
      const secondHalf = responseTimes.slice(Math.floor(responseTimes.length / 2));

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Performance should not degrade significantly
      const degradationRatio = secondHalfAvg / firstHalfAvg;
      expect(degradationRatio).toBeLessThan(2); // Less than 2x slower

      // Success rate should remain high
      const successfulRequests = results.filter((r) => r.response.status === 200).length;
      const successRate = successfulRequests / results.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      console.log(
        `Sustained load test - ${results.length} requests, ${(successRate * 100).toFixed(1)}% success rate`
      );
      console.log(
        `Performance - First half: ${firstHalfAvg.toFixed(0)}ms, Second half: ${secondHalfAvg.toFixed(0)}ms`
      );
    }, 35000); // 35 second timeout for this test
  });

  describe("Memory and Resource Testing", () => {
    test("should handle large response payloads efficiently", async () => {
      // Test with health check that includes system info
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health/check`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);

      const data = await response.json();
      const responseSize = JSON.stringify(data).length;

      // Should respond quickly even with detailed info
      expect(responseTime).toBeLessThan(1000);

      console.log(`Health check response - Size: ${responseSize} bytes, Time: ${responseTime}ms`);
    });

    test("should handle rapid sequential requests without memory leaks", async () => {
      const requestCount = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}/api/health/check`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        responseTimes.push(responseTime);

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Analyze for memory leak indicators (increasing response times)
      const firstQuarter = responseTimes.slice(0, 25);
      const lastQuarter = responseTimes.slice(-25);

      const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

      // Response times should not increase significantly
      const performanceDrift = lastQuarterAvg / firstQuarterAvg;
      expect(performanceDrift).toBeLessThan(3); // Less than 3x increase

      console.log(
        `Sequential requests - First 25: ${firstQuarterAvg.toFixed(0)}ms, Last 25: ${lastQuarterAvg.toFixed(0)}ms`
      );
    });
  });

  describe("Edge Function Performance", () => {
    test("should perform well on different routes", async () => {
      const routes = [
        "/api/health/check",
        "/api/auth/login", // Will fail auth but tests route performance
      ];

      const results: Array<{ route: string; time: number; status: number }> = [];

      for (const route of routes) {
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}${route}`, {
          method: route.includes("login") ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
          },
          body: route.includes("login")
            ? JSON.stringify({
                email: "test@example.com",
                password: "testpass",
              })
            : undefined,
        });
        const responseTime = Date.now() - startTime;

        results.push({
          route,
          time: responseTime,
          status: response.status,
        });

        // All routes should respond quickly
        expect(responseTime).toBeLessThan(3000);
      }

      console.log(
        "Route performance:",
        results.map((r) => `${r.route}: ${r.time}ms (${r.status})`)
      );
    });

    test("should handle edge caching effectively", async () => {
      // Make first request
      const firstStart = Date.now();
      const firstResponse = await fetch(`${baseUrl}/api/health/check`);
      const firstTime = Date.now() - firstStart;

      expect(firstResponse.status).toBe(200);

      // Make second request (should benefit from any edge caching)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondStart = Date.now();
      const secondResponse = await fetch(`${baseUrl}/api/health/check`);
      const secondTime = Date.now() - secondStart;

      expect(secondResponse.status).toBe(200);

      // Second request might be faster due to edge caching
      console.log(`Edge caching test - First: ${firstTime}ms, Second: ${secondTime}ms`);

      // Both should be reasonably fast
      expect(firstTime).toBeLessThan(3000);
      expect(secondTime).toBeLessThan(2000);
    });
  });
});

/**
 * Performance testing utilities
 */
export class LoadTestUtils {
  static async measureResponseTime(
    url: string,
    options?: RequestInit
  ): Promise<{ time: number; response: Response }> {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const time = Date.now() - startTime;

    return { time, response };
  }

  static calculatePercentile(times: number[], percentile: number): number {
    const sorted = times.slice().sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }

  static async runConcurrentRequests(
    url: string,
    count: number,
    options?: RequestInit
  ): Promise<Array<{ response: Response; time: number }>> {
    const requests = Array.from({ length: count }, () => this.measureResponseTime(url, options));

    return Promise.all(requests);
  }
}
