/**
 * Global test environment setup
 * Configures testing libraries, mocks, and utilities for consistent test environment
 */

import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";

// Enable API mocking before tests run
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// Reset any request handlers that are declared as a part of tests
afterEach(() => {
  cleanup();
  server.resetHandlers();

  // Clear all mocks after each test
  vi.clearAllMocks();

  // Reset localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();

  // Reset any global state
  resetGlobalState();
});

// Clean up after the tests are finished
afterAll(() => server.close());

// Mock global APIs
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

// Mock crypto.randomUUID for security tests
Object.defineProperty(global.crypto, "randomUUID", {
  value: () => "mocked-uuid-for-testing",
});

// Mock crypto.subtle for token validation tests
Object.defineProperty(global.crypto, "subtle", {
  value: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue({}),
    sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
    verify: vi.fn().mockResolvedValue(true),
  },
});

// Mock setTimeout and setInterval for session monitoring tests
vi.stubGlobal(
  "setTimeout",
  vi.fn((fn, delay) => {
    return Number(setTimeout(fn, delay));
  })
);

vi.stubGlobal(
  "setInterval",
  vi.fn((fn, delay) => {
    return Number(setInterval(fn, delay));
  })
);

vi.stubGlobal("clearTimeout", vi.fn(clearTimeout));
vi.stubGlobal("clearInterval", vi.fn(clearInterval));

// Mock console methods in test environment to reduce noise
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is no longer supported") ||
        args[0].includes("Warning: Function components cannot be given refs"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Mock window.location for redirect tests
const mockLocation = {
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  href: "http://localhost:3000",
  origin: "http://localhost:3000",
  protocol: "http:",
  host: "localhost:3000",
  hostname: "localhost",
  port: "3000",
  pathname: "/",
  search: "",
  hash: "",
};

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

// Mock navigator for offline tests
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Mock fetch for tests that need it
global.fetch = vi.fn();

// Function to reset any global state between tests
function resetGlobalState() {
  // Reset location mock
  mockLocation.href = "http://localhost:3000";
  mockLocation.pathname = "/";
  mockLocation.search = "";
  mockLocation.hash = "";

  // Reset navigator
  Object.defineProperty(navigator, "onLine", {
    writable: true,
    value: true,
  });

  // Reset any other global variables
  (global as any).__TEST_STATE__ = {};
}

// Export test utilities
export { mockLocation };
export const testUtils = {
  resetGlobalState,
  mockLocation,
};

// Environment configuration
process.env.NODE_ENV = "test";
process.env.VITE_API_BASE_URL = "http://localhost:3000";
process.env.VITE_APP_TITLE = "Okaeri Resort System";

// Global test constants
export const TEST_CONSTANTS = {
  API_BASE_URL: "http://localhost:3000",
  MOCK_USER_ID: "test-user-123",
  MOCK_PROJECT_ID: "test-project-456",
  MOCK_TOKEN:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZXhwIjoxNjk5OTk5OTk5LCJyb2xlIjoiT1dORVIifQ.mock-jwt-token",
  MOCK_REFRESH_TOKEN: "mock-refresh-token-abc123",
  PHILIPPINE_PHONE: "+639171234567",
  PHILIPPINE_EMAIL: "test@okaeriresort.ph",
} as const;

// Type definitions for test utilities
declare global {
  var __TEST_STATE__: Record<string, any>;
}
