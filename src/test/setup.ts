/**
 * Vitest Global Test Setup
 * Configures the test environment for all tests
 */

import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia
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

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
  takeRecords: () => [],
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Create enhanced Supabase mock with chainable methods
const createChainableMock = (defaultResponse = { data: [], error: null }) => {
  const chainable = {
    select: vi.fn(() => chainable),
    insert: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),
    upsert: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    neq: vi.fn(() => chainable),
    gt: vi.fn(() => chainable),
    gte: vi.fn(() => chainable),
    lt: vi.fn(() => chainable),
    lte: vi.fn(() => chainable),
    like: vi.fn(() => chainable),
    ilike: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    contains: vi.fn(() => chainable),
    match: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
    or: vi.fn(() => chainable),
    and: vi.fn(() => chainable),
    filter: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    offset: vi.fn(() => chainable),
    range: vi.fn(() => chainable),
    single: vi.fn(() => Promise.resolve(defaultResponse)),
    maybeSingle: vi.fn(() => Promise.resolve(defaultResponse)),
    then: vi.fn((callback) => Promise.resolve(defaultResponse).then(callback)),
    catch: vi.fn((callback) => Promise.resolve(defaultResponse).catch(callback)),
  };
  return chainable;
};

// Mock Supabase client with comprehensive API coverage
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((_table: string) => createChainableMock()),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: null },
          error: null,
        })
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({
          data: {
            user: { id: "test-user", email: "test@example.com" },
            session: { access_token: "test-token", refresh_token: "test-refresh" },
          },
          error: null,
        })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      refreshSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: "new-token",
              refresh_token: "new-refresh",
              expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            },
          },
          error: null,
        })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: {} },
        error: null,
      })),
    },
    rpc: vi.fn((functionName: string, _params?: any) => {
      // Return appropriate mock based on function name
      const mockResults: Record<string, any> = {
        check_unit_availability: { data: true, error: null },
        generate_booking_reference: { data: "BK-TEST-001", error: null },
        check_multi_unit_availability: {
          data: [{ unit_id: "test", available: true }],
          error: null,
        },
        get_unit_availability_calendar: { data: [], error: null },
        refresh_availability_cache: { data: null, error: null },
      };

      return Promise.resolve(mockResults[functionName] || { data: null, error: null });
    }),
    storage: {
      from: vi.fn((_bucket: string) => ({
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://test.com/file.jpg" } })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve({
            data: { signedUrl: "https://test.com/signed-file.jpg" },
            error: null,
          })
        ),
      })),
    },
  },
}));

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.VITE_SUPABASE_URL = "https://test.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";

// Performance monitoring mock
global.performance.mark = vi.fn();
global.performance.measure = vi.fn();
global.performance.getEntriesByName = vi.fn(
  () =>
    [
      {
        duration: 100,
        entryType: "measure",
        name: "test",
        startTime: 0,
        toJSON: () => ({}),
      },
    ] as PerformanceEntryList
);

// Console error suppression for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Warning: unmountComponentAtNode") ||
        args[0].includes("not wrapped in act"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock DOMPurify for testing
vi.mock("dompurify", () => ({
  default: {
    sanitize: (input: string) => input, // In tests, return input as-is for predictability
    setConfig: vi.fn(),
    isSupported: true,
  },
}));

// Mock date for consistent testing
const mockDate = new Date("2025-09-25T12:00:00.000Z");
vi.setSystemTime(mockDate);

// Export test utilities
export const testUtils = {
  mockSupabaseResponse: (data: any, error: any = null) => {
    return { data, error };
  },

  mockAuthUser: (overrides = {}) => ({
    id: "test-user-id",
    email: "test@example.com",
    role: "authenticated",
    ...overrides,
  }),

  mockBooking: (overrides = {}) => ({
    booking_id: "test-booking-id",
    guest_name: "Test Guest",
    check_in: "2025-10-01",
    check_out: "2025-10-05",
    unit_id: "test-unit-id",
    total_amount: 5000,
    booking_status: "confirmed",
    ...overrides,
  }),

  mockUnit: (overrides = {}) => ({
    unit_id: "test-unit-id",
    unit_name: "Test Unit",
    unit_type: "villa",
    base_rate: 1000,
    max_occupancy: 4,
    is_active: true,
    ...overrides,
  }),
};
