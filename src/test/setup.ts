/**
 * Test Setup Configuration
 * Initializes test environment for all tests
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";
import "@testing-library/jest-dom";
import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

// Set default test environment variables if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test_db";
}

// Set NODE_ENV to test
process.env.NODE_ENV = "test";

// Mock window.matchMedia for tests that use responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors in tests unless explicitly testing error handling
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Warning: useLayoutEffect") ||
        args[0].includes("Not implemented: navigation"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Extend expect matchers for better assertions
declare global {
  namespace Vi {
    interface Assertion {
      toBeWithinRange(min: number, max: number): void;
    }
  }
}

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${min} - ${max}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${min} - ${max}`,
        pass: false,
      };
    }
  },
});

// Database test utilities
export const TEST_DATABASE_CONFIG = {
  connectionTimeout: 30000,
  defaultTimeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Test data cleanup tracking
const cleanupFunctions: Array<() => Promise<void>> = [];

export const registerCleanup = (fn: () => Promise<void>) => {
  cleanupFunctions.push(fn);
};

export const runCleanup = async () => {
  for (const fn of cleanupFunctions) {
    try {
      await fn();
    } catch (error) {
      console.warn("Cleanup function failed:", error);
    }
  }
  cleanupFunctions.length = 0;
};

// Run cleanup after all tests
afterAll(async () => {
  await runCleanup();
});

// Performance helpers for tests
export const measurePerformance = (name: string) => {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    },
  };
};

// Mock fetch for API tests
global.fetch = vi.fn();

// Reset fetch mock after each test
afterEach(() => {
  vi.mocked(fetch).mockReset();
});

export default {};
