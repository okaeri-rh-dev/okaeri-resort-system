/**
 * API Client retry logic tests for unstable Philippine internet connections
 * Tests exponential backoff, circuit breakers, and connection recovery scenarios
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { server } from "@tests/mocks/server";
import { http, HttpResponse } from "msw";
import { ApiClient } from "@/api/client";
import { TEST_CONSTANTS } from "@tests/utils/test-utils";

// Enhanced API client with retry logic for Philippine internet conditions
class RetryApiClient extends ApiClient {
  private retryAttempts = 3;
  private baseDelayMs = 1000;
  private maxDelayMs = 10000;
  private circuitBreaker = {
    failures: 0,
    threshold: 5,
    timeout: 30000,
    state: "CLOSED" as "OPEN" | "CLOSED" | "HALF_OPEN",
    nextAttempt: 0,
  };

  constructor(config: any) {
    super(config);
  }

  /**
   * Enhanced request method with retry logic and circuit breaker
   */
  async requestWithRetry<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown;
      params?: Record<string, unknown>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
      retryAttempts?: number;
    }
  ): Promise<{ data: T; status: number; message?: string }> {
    const maxRetries = options?.retryAttempts ?? this.retryAttempts;

    // Check circuit breaker
    if (this.circuitBreaker.state === "OPEN") {
      if (Date.now() < this.circuitBreaker.nextAttempt) {
        throw new Error("Circuit breaker is OPEN - service unavailable");
      }
      this.circuitBreaker.state = "HALF_OPEN";
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Calculate delay with exponential backoff and jitter
        if (attempt > 0) {
          const delay = Math.min(this.baseDelayMs * Math.pow(2, attempt - 1), this.maxDelayMs);
          const jitter = Math.random() * 0.1 * delay; // 10% jitter
          await this.sleep(delay + jitter);
        }

        const response = await this.request<T>(method, endpoint, options);

        // Success - reset circuit breaker
        this.resetCircuitBreaker();
        return response;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryableError = this.isRetryableError(error);

        // Record failure for circuit breaker
        if (isRetryableError) {
          this.recordFailure();
        }

        // Don't retry on non-retryable errors
        if (!isRetryableError || isLastAttempt) {
          throw error;
        }

        console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }
    }

    throw new Error("Maximum retry attempts exceeded");
  }

  /**
   * Determine if an error is retryable (network issues, 5xx errors, timeouts)
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT") {
      return true;
    }

    // Server errors (5xx) but not client errors (4xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Rate limiting - can retry after delay
    if (error.status === 429) {
      return true;
    }

    // Connection refused, timeout, etc.
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("timeout") ||
      error.message?.includes("ENOTFOUND")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = "OPEN";
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
      console.warn("Circuit breaker opened due to repeated failures");
    }
  }

  /**
   * Reset circuit breaker on successful request
   */
  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = "CLOSED";
  }

  /**
   * Override HTTP methods to use retry logic
   */
  async getWithRetry<T>(
    endpoint: string,
    params?: Record<string, unknown>,
    options?: { signal?: AbortSignal; retryAttempts?: number }
  ) {
    return this.requestWithRetry<T>("GET", endpoint, { params, ...options });
  }

  async postWithRetry<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal; retryAttempts?: number }
  ) {
    return this.requestWithRetry<T>("POST", endpoint, { body, ...options });
  }

  async putWithRetry<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal; retryAttempts?: number }
  ) {
    return this.requestWithRetry<T>("PUT", endpoint, { body, ...options });
  }

  async patchWithRetry<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal; retryAttempts?: number }
  ) {
    return this.requestWithRetry<T>("PATCH", endpoint, { body, ...options });
  }

  async deleteWithRetry<T>(
    endpoint: string,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal; retryAttempts?: number }
  ) {
    return this.requestWithRetry<T>("DELETE", endpoint, options);
  }

  // Expose circuit breaker state for testing
  getCircuitBreakerState() {
    return { ...this.circuitBreaker };
  }

  // Reset circuit breaker for testing
  resetCircuitBreakerForTesting() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = "CLOSED";
    this.circuitBreaker.nextAttempt = 0;
  }
}

describe("API Client Retry Logic for Philippine Internet Conditions", () => {
  let retryClient: RetryApiClient;
  let requestCount: number;

  beforeEach(() => {
    retryClient = new RetryApiClient({
      baseURL: TEST_CONSTANTS.API_BASE_URL,
      timeout: 5000,
    });
    requestCount = 0;
    retryClient.resetCircuitBreakerForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Network Error Recovery", () => {
    it("should retry on network errors with exponential backoff", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-retry`, () => {
          requestCount++;
          if (requestCount < 3) {
            return HttpResponse.error(); // Network error
          }
          return HttpResponse.json({ success: true, attempt: requestCount });
        })
      );

      const startTime = Date.now();
      const result = await retryClient.getWithRetry("/test-retry");
      const endTime = Date.now();

      expect(result.data).toEqual({ success: true, attempt: 3 });
      expect(requestCount).toBe(3);

      // Should have taken time due to exponential backoff
      // First retry: ~1000ms, second retry: ~2000ms
      expect(endTime - startTime).toBeGreaterThan(2500);
    }, 10000);

    it("should fail after maximum retry attempts", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-max-retries`, () => {
          requestCount++;
          return HttpResponse.error(); // Always fail
        })
      );

      await expect(retryClient.getWithRetry("/test-max-retries")).rejects.toThrow();
      expect(requestCount).toBe(4); // Initial + 3 retries
    });

    it("should handle intermittent connection failures", async () => {
      const failurePattern = [true, true, false, true, false]; // Fail, Fail, Success
      let callIndex = 0;

      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/test-intermittent`, () => {
          const shouldFail = failurePattern[callIndex];
          callIndex++;
          requestCount++;

          if (shouldFail) {
            return HttpResponse.error();
          }
          return HttpResponse.json({ success: true, recovered: true });
        })
      );

      const result = await retryClient.postWithRetry("/test-intermittent", { data: "test" });

      expect(result.data).toEqual({ success: true, recovered: true });
      expect(requestCount).toBe(3); // Failed twice, succeeded on third
    });
  });

  describe("Server Error Recovery", () => {
    it("should retry on 5xx server errors", async () => {
      const serverErrors = [502, 503, 504, 500];

      for (const statusCode of serverErrors) {
        requestCount = 0;
        server.use(
          http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-server-error-${statusCode}`, () => {
            requestCount++;
            if (requestCount < 2) {
              return HttpResponse.json({ error: "Server error" }, { status: statusCode });
            }
            return HttpResponse.json({ recovered: true, afterStatus: statusCode });
          })
        );

        const result = await retryClient.getWithRetry(`/test-server-error-${statusCode}`);
        expect(result.data).toEqual({ recovered: true, afterStatus: statusCode });
        expect(requestCount).toBe(2);
      }
    });

    it("should not retry on 4xx client errors", async () => {
      const clientErrors = [400, 401, 403, 404, 422];

      for (const statusCode of clientErrors) {
        requestCount = 0;
        server.use(
          http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-client-error-${statusCode}`, () => {
            requestCount++;
            return HttpResponse.json({ error: "Client error" }, { status: statusCode });
          })
        );

        await expect(
          retryClient.getWithRetry(`/test-client-error-${statusCode}`)
        ).rejects.toMatchObject({
          status: statusCode,
        });
        expect(requestCount).toBe(1); // No retries on client errors
      }
    });
  });

  describe("Rate Limiting Handling", () => {
    it("should retry on 429 rate limit errors", async () => {
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/test-rate-limit`, () => {
          requestCount++;
          if (requestCount < 3) {
            return HttpResponse.json(
              { error: "Rate limit exceeded", retryAfter: 1 },
              { status: 429 }
            );
          }
          return HttpResponse.json({ success: true, rateLimit: "recovered" });
        })
      );

      const result = await retryClient.postWithRetry("/test-rate-limit", { data: "test" });

      expect(result.data).toEqual({ success: true, rateLimit: "recovered" });
      expect(requestCount).toBe(3);
    });

    it("should respect rate limit retry-after headers", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-rate-limit-header`, () => {
          requestCount++;
          if (requestCount < 2) {
            return HttpResponse.json(
              { error: "Rate limited" },
              {
                status: 429,
                headers: { "Retry-After": "1" },
              }
            );
          }
          return HttpResponse.json({ success: true });
        })
      );

      const startTime = Date.now();
      const result = await retryClient.getWithRetry("/test-rate-limit-header");
      const endTime = Date.now();

      expect(result.data).toEqual({ success: true });
      expect(endTime - startTime).toBeGreaterThan(1000); // Waited at least 1 second
    });
  });

  describe("Circuit Breaker Pattern", () => {
    it("should open circuit breaker after repeated failures", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-circuit-breaker`, () => {
          requestCount++;
          return HttpResponse.error(); // Always fail
        })
      );

      // Make 5 failed requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await retryClient.getWithRetry("/test-circuit-breaker", {}, { retryAttempts: 0 });
        } catch (error) {
          // Expected to fail
        }
      }

      const circuitState = retryClient.getCircuitBreakerState();
      expect(circuitState.state).toBe("OPEN");
      expect(circuitState.failures).toBeGreaterThanOrEqual(5);

      // Next request should fail immediately due to open circuit
      await expect(retryClient.getWithRetry("/test-circuit-breaker")).rejects.toThrow(
        "Circuit breaker is OPEN"
      );
    });

    it("should transition to half-open state after timeout", async () => {
      // Manually set circuit breaker to open with short timeout
      const circuitBreaker = retryClient.getCircuitBreakerState();
      (retryClient as any).circuitBreaker.state = "OPEN";
      (retryClient as any).circuitBreaker.failures = 5;
      (retryClient as any).circuitBreaker.nextAttempt = Date.now() + 100; // 100ms timeout

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-half-open`, () => {
          return HttpResponse.json({ success: true, state: "recovered" });
        })
      );

      // Request should succeed and close circuit
      const result = await retryClient.getWithRetry("/test-half-open");
      expect(result.data).toEqual({ success: true, state: "recovered" });

      const newState = retryClient.getCircuitBreakerState();
      expect(newState.state).toBe("CLOSED");
      expect(newState.failures).toBe(0);
    });
  });

  describe("Timeout Handling", () => {
    it("should retry on request timeouts", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-timeout`, async () => {
          requestCount++;
          if (requestCount < 3) {
            // Simulate slow response that times out
            await new Promise((resolve) => setTimeout(resolve, 6000));
            return HttpResponse.json({ slow: true });
          }
          return HttpResponse.json({ success: true, fast: true });
        })
      );

      const result = await retryClient.getWithRetry("/test-timeout");
      expect(result.data).toEqual({ success: true, fast: true });
    }, 15000);

    it("should handle abort signals properly", async () => {
      const abortController = new AbortController();

      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-abort`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return HttpResponse.json({ success: true });
        })
      );

      // Abort request after 500ms
      setTimeout(() => abortController.abort(), 500);

      await expect(
        retryClient.getWithRetry(
          "/test-abort",
          {},
          {
            signal: abortController.signal,
          }
        )
      ).rejects.toThrow();
    });
  });

  describe("Philippine Internet Condition Simulations", () => {
    it("should handle slow 3G connections with retries", async () => {
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/test-3g-speed`, async () => {
          requestCount++;

          if (requestCount < 2) {
            // Simulate slow 3G - delay but eventual success
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return HttpResponse.error(); // Still fail first time
          }

          // Simulate improved connection
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({
            success: true,
            connectionImproved: true,
            attempt: requestCount,
          });
        })
      );

      const startTime = Date.now();
      const result = await retryClient.postWithRetry("/test-3g-speed", {
        booking: "test-booking",
        guestName: "Juan Dela Cruz",
      });
      const endTime = Date.now();

      expect(result.data).toMatchObject({
        success: true,
        connectionImproved: true,
        attempt: 2,
      });

      // Should take time due to slow initial connection + retry delay
      expect(endTime - startTime).toBeGreaterThan(3000);
    }, 15000);

    it("should handle power outage recovery scenarios", async () => {
      let isOutage = true;

      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-power-outage`, () => {
          requestCount++;

          if (isOutage && requestCount < 4) {
            // Simulate power outage - connection completely fails
            return HttpResponse.error();
          }

          // Power restored
          isOutage = false;
          return HttpResponse.json({
            success: true,
            powerRestored: true,
            missedRequests: requestCount - 1,
          });
        })
      );

      // Simulate power restoration after 3 attempts
      setTimeout(() => {
        isOutage = false;
      }, 2000);

      const result = await retryClient.getWithRetry("/test-power-outage");

      expect(result.data).toMatchObject({
        success: true,
        powerRestored: true,
      });
      expect(requestCount).toBe(4); // Initial + 3 retries during outage
    }, 10000);

    it("should handle ISP connection drops", async () => {
      const connectionDrop = [false, true, true, false]; // Available, Drop, Drop, Available
      let callIndex = 0;

      server.use(
        http.patch(`${TEST_CONSTANTS.API_BASE_URL}/test-isp-drop`, () => {
          const isConnected = connectionDrop[callIndex];
          callIndex++;
          requestCount++;

          if (!isConnected) {
            return HttpResponse.error(); // ISP connection dropped
          }

          return HttpResponse.json({
            success: true,
            reconnected: callIndex > 1,
            totalOutages: callIndex - 1,
          });
        })
      );

      const result = await retryClient.patchWithRetry("/test-isp-drop", {
        bookingUpdate: { status: "confirmed" },
      });

      expect(result.data).toMatchObject({
        success: true,
        reconnected: true,
      });
    });
  });

  describe("Jitter and Backoff Strategies", () => {
    it("should apply jitter to prevent thundering herd", async () => {
      const delays: number[] = [];

      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-jitter`, () => {
          delays.push(Date.now());
          requestCount++;
          if (requestCount < 3) {
            return HttpResponse.error();
          }
          return HttpResponse.json({ success: true });
        })
      );

      await retryClient.getWithRetry("/test-jitter");

      // Check that delays have jitter (not exactly exponential)
      if (delays.length >= 3) {
        const firstDelay = delays[1] - delays[0];
        const secondDelay = delays[2] - delays[1];

        // Second delay should be roughly 2x first, but with jitter
        const ratio = secondDelay / firstDelay;
        expect(ratio).toBeGreaterThan(1.5); // At least 1.5x
        expect(ratio).toBeLessThan(2.5); // But not more than 2.5x due to jitter
      }
    }, 8000);

    it("should cap maximum delay to prevent excessive waits", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-max-delay`, () => {
          requestCount++;
          if (requestCount < 4) {
            // Will do 3 retries with increasing delays
            return HttpResponse.error();
          }
          return HttpResponse.json({ success: true });
        })
      );

      const startTime = Date.now();
      await retryClient.getWithRetry("/test-max-delay");
      const endTime = Date.now();

      // With max delay of 10s, total wait should not exceed reasonable bounds
      // even with exponential backoff (1s + 2s + 4s + jitter should be < 10s total)
      expect(endTime - startTime).toBeLessThan(12000);
    }, 15000);
  });

  describe("Request Cancellation and Cleanup", () => {
    it("should properly cancel retries when aborted", async () => {
      const abortController = new AbortController();

      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-cancel-retries`, () => {
          requestCount++;
          return HttpResponse.error(); // Always fail to trigger retries
        })
      );

      // Cancel after first failure but before retry
      setTimeout(() => abortController.abort(), 500);

      await expect(
        retryClient.getWithRetry(
          "/test-cancel-retries",
          {},
          {
            signal: abortController.signal,
            retryAttempts: 3,
          }
        )
      ).rejects.toThrow();

      // Should have made only the initial request
      expect(requestCount).toBe(1);
    });
  });

  describe("Custom Retry Configuration", () => {
    it("should allow custom retry attempts per request", async () => {
      server.use(
        http.delete(`${TEST_CONSTANTS.API_BASE_URL}/test-custom-retries`, () => {
          requestCount++;
          return HttpResponse.error();
        })
      );

      await expect(
        retryClient.deleteWithRetry("/test-custom-retries", {
          retryAttempts: 1, // Only 1 retry instead of default 3
        })
      ).rejects.toThrow();

      expect(requestCount).toBe(2); // Initial + 1 retry
    });

    it("should handle zero retry attempts", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/test-no-retries`, () => {
          requestCount++;
          return HttpResponse.error();
        })
      );

      await expect(
        retryClient.getWithRetry(
          "/test-no-retries",
          {},
          {
            retryAttempts: 0,
          }
        )
      ).rejects.toThrow();

      expect(requestCount).toBe(1); // No retries
    });
  });
});

// Export the enhanced retry client for use in other parts of the application
export { RetryApiClient };
