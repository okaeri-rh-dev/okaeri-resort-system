/**
 * Test Setup Configuration
 * Initializes test environment for all tests
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";
import "@testing-library/jest-dom";
import { config } from "dotenv";
import { enableMapSet } from "immer";
import { toHaveNoViolations } from "jest-axe";

// Enable Immer MapSet plugin for zustand stores
enableMapSet();

// Mock Canvas API for chart/visualization libraries
class MockCanvasRenderingContext2D {
  canvas = { width: 800, height: 600 };
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  lineCap = "butt" as CanvasLineCap;
  lineJoin = "miter" as CanvasLineJoin;
  font = "10px sans-serif";
  textAlign = "start" as CanvasTextAlign;
  textBaseline = "alphabetic" as CanvasTextBaseline;

  // Drawing methods
  fillRect = vi.fn();
  clearRect = vi.fn();
  strokeRect = vi.fn();
  fillText = vi.fn();
  strokeText = vi.fn();
  measureText = vi.fn(() => ({ width: 0 }));

  // Path methods
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  bezierCurveTo = vi.fn();
  quadraticCurveTo = vi.fn();

  // Transformation methods
  rotate = vi.fn();
  scale = vi.fn();
  translate = vi.fn();
  transform = vi.fn();
  setTransform = vi.fn();

  // Other methods
  save = vi.fn();
  restore = vi.fn();
  clip = vi.fn();
  stroke = vi.fn();
  fill = vi.fn();
  createLinearGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  createRadialGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  createPattern = vi.fn(() => ({}));
  getImageData = vi.fn(() => ({
    width: 100,
    height: 100,
    data: new Uint8ClampedArray(40000),
  }));
  putImageData = vi.fn();
  drawImage = vi.fn();
}

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(function (contextType) {
  if (contextType === "2d") {
    return new MockCanvasRenderingContext2D() as any;
  }
  return null;
});

// Mock canvas.toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,mock");
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(["mock"], { type: "image/png" }));
});

// Load test environment variables
config({ path: ".env.test" });

// Canonical defaults from TDD_SINGLE_SOURCE_OF_TRUTH.md
const FIXED_TIME = process.env.FIXED_TIME ?? "2024-01-01T00:00:00Z";
const RANDOM_SEED = process.env.RANDOM_SEED ?? "test-seed-2024";
const TEST_SCENARIO = process.env.TEST_SCENARIO ?? "STABLE";
const MOCK_DELAY = process.env.MOCK_DELAY ?? "0";

// Set deterministic test environment for TDD
process.env.TZ = "Asia/Manila";
process.env.NODE_ENV = "test";
process.env.TEST_SCENARIO = TEST_SCENARIO;
process.env.MOCK_DELAY = MOCK_DELAY;
process.env.RANDOM_SEED = RANDOM_SEED;

// Use fake timers with canonical fixed time for deterministic tests
vi.useFakeTimers();
vi.setSystemTime(new Date(FIXED_TIME));

// Implement seeded PRNG instead of fixed value
let seed = 0;
for (let i = 0; i < RANDOM_SEED.length; i++) {
  seed = (seed * 31 + RANDOM_SEED.charCodeAt(i)) >>> 0;
}

// Simple Linear Congruential Generator for deterministic random
const seededRandom = (() => {
  let state = seed || 123456789;
  return () => {
    // Numerical Recipes LCG parameters
    state = (1664525 * state + 1013904223) >>> 0;
    return (state & 0xffffffff) / 0x100000000;
  };
})();

// Mock Math.random with seeded PRNG
const originalRandom = Math.random;
beforeAll(() => {
  vi.spyOn(Math, "random").mockImplementation(() => seededRandom());
});

afterAll(() => {
  Math.random = originalRandom;
  vi.useRealTimers();
});

// Set default test environment variables if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test_db";
}

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
  toHaveNoViolations,
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
