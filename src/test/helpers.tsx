/**
 * Test Helpers
 * Provides utilities for testing React components with all necessary providers
 */

import type { ReactElement } from "react";
import React from "react";
import type { RenderOptions } from "@testing-library/react";
import { render as rtlRender } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "@tanstack/react-router";
import type { User } from "@/types/common";

/**
 * Create a test query client with sensible defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Turn off retries for tests
        gcTime: 0, // No garbage collection time
        staleTime: 0, // Data is always stale
      },
      mutations: {
        retry: false,
      },
    },
    // Suppress error logging in tests
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

/**
 * Test render options
 */
interface TestRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Initial route for the router */
  initialRoute?: string;
  /** Mock user for authentication context */
  user?: User | null;
  /** Custom query client */
  queryClient?: QueryClient;
  /** Additional providers to wrap the component */
  additionalProviders?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * All providers wrapper for tests
 */
export function AllProviders({
  children,
  initialRoute = "/",
  user = null,
  queryClient = createTestQueryClient(),
}: {
  children: React.ReactNode;
  initialRoute?: string;
  user?: User | null;
  queryClient?: QueryClient;
}) {
  // Mock auth store if user is provided
  if (user) {
    // This would integrate with your auth store
    // For now, we'll set it in a mock context
    (window as any).__TEST_USER__ = user;
  }

  // Create a memory router for testing
  const router = createMemoryRouter({
    routes: [
      {
        path: "*",
        component: () => <>{children}</>,
      },
    ],
    history: {
      initialEntries: [initialRoute],
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

/**
 * Custom render function that includes all providers
 */
export function render(
  ui: ReactElement,
  {
    initialRoute = "/",
    user = null,
    queryClient = createTestQueryClient(),
    additionalProviders,
    ...renderOptions
  }: TestRenderOptions = {}
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const content = (
      <AllProviders initialRoute={initialRoute} user={user} queryClient={queryClient}>
        {children}
      </AllProviders>
    );

    if (additionalProviders) {
      const AdditionalProviders = additionalProviders;
      return <AdditionalProviders>{content}</AdditionalProviders>;
    }

    return content;
  };

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Wait for async operations to complete
 */
export async function waitForLoadingToFinish() {
  const { waitFor } = await import("@testing-library/react");
  await waitFor(
    () => {
      const loadingElements = document.querySelectorAll('[data-testid*="loading"]');
      const spinners = document.querySelectorAll('[role="status"]');
      const skeletons = document.querySelectorAll('[data-testid*="skeleton"]');

      if (loadingElements.length > 0 || spinners.length > 0 || skeletons.length > 0) {
        throw new Error("Still loading");
      }
    },
    { timeout: 5000 }
  );
}

/**
 * Create a mock fetch response
 */
export function createFetchResponse<T>(
  data: T,
  options: { status?: number; ok?: boolean; delay?: number } = {}
): Promise<Response> {
  const { status = 200, ok = true, delay = 0 } = options;

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: new Headers({
          "content-type": "application/json",
        }),
      } as Response);
    }, delay);
  });
}

/**
 * Mock fetch for testing
 */
export function mockFetch(responses: Map<string | RegExp, any>) {
  const originalFetch = global.fetch;

  global.fetch = jest.fn(async (url: string, options?: RequestInit) => {
    // Find matching response
    for (const [pattern, response] of responses) {
      if (typeof pattern === "string" && url === pattern) {
        return createFetchResponse(response);
      }
      if (pattern instanceof RegExp && pattern.test(url)) {
        return createFetchResponse(response);
      }
    }

    // No match found, return 404
    return createFetchResponse({ error: "Not found" }, { status: 404, ok: false });
  }) as any;

  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Create mock localStorage
 */
export function createMockLocalStorage() {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
}

/**
 * Setup mock localStorage for tests
 */
export function setupMockLocalStorage() {
  const mockLocalStorage = createMockLocalStorage();
  Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
  return mockLocalStorage;
}

/**
 * Create mock sessionStorage
 */
export function setupMockSessionStorage() {
  const mockSessionStorage = createMockLocalStorage();
  Object.defineProperty(window, "sessionStorage", {
    value: mockSessionStorage,
    writable: true,
  });
  return mockSessionStorage;
}

/**
 * Simulate network delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debug helper to print the current DOM
 */
export function debugDOM(element?: HTMLElement) {
  const { prettyDOM } = require("@testing-library/react");
  console.log(prettyDOM(element || document.body, 50000));
}

/**
 * Assert element is visible
 */
export function assertVisible(element: HTMLElement) {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
}

/**
 * Assert element is not visible
 */
export function assertNotVisible(element: HTMLElement | null) {
  if (element) {
    expect(element).not.toBeVisible();
  } else {
    expect(element).toBeNull();
  }
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
