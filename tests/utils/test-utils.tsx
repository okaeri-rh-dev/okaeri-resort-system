/**
 * Custom testing utilities for consistent test setup
 * Provides wrapped render functions and common test helpers
 */

import type { ReactElement } from "react";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { User, AuthState } from "@/types/common";

// Test IDs for easier element selection
export const TEST_IDS = {
  // Auth forms
  LOGIN_FORM: "login-form",
  LOGIN_EMAIL: "login-email",
  LOGIN_PASSWORD: "login-password",
  LOGIN_SUBMIT: "login-submit",
  LOGIN_REMEMBER_ME: "login-remember-me",

  REGISTER_FORM: "register-form",
  REGISTER_NAME: "register-name",
  REGISTER_EMAIL: "register-email",
  REGISTER_PASSWORD: "register-password",
  REGISTER_CONFIRM_PASSWORD: "register-confirm-password",
  REGISTER_PROJECT_NAME: "register-project-name",
  REGISTER_PHONE: "register-phone",
  REGISTER_TERMS: "register-terms",
  REGISTER_SUBMIT: "register-submit",

  FORGOT_PASSWORD_FORM: "forgot-password-form",
  FORGOT_PASSWORD_EMAIL: "forgot-password-email",
  FORGOT_PASSWORD_SUBMIT: "forgot-password-submit",

  RESET_PASSWORD_FORM: "reset-password-form",
  RESET_PASSWORD_NEW: "reset-password-new",
  RESET_PASSWORD_CONFIRM: "reset-password-confirm",
  RESET_PASSWORD_SUBMIT: "reset-password-submit",

  // UI elements
  ERROR_MESSAGE: "error-message",
  SUCCESS_MESSAGE: "success-message",
  LOADING_SPINNER: "loading-spinner",
  SKELETON_LOADER: "skeleton-loader",

  // Navigation
  USER_MENU: "user-menu",
  USER_AVATAR: "user-avatar",
  PROJECT_SWITCHER: "project-switcher",
  LOGOUT_BUTTON: "logout-button",

  // Security
  SESSION_WARNING: "session-warning",
  SESSION_EXTEND: "session-extend",
  PERMISSION_DENIED: "permission-denied",

  // Password strength
  PASSWORD_STRENGTH: "password-strength",
  PASSWORD_REQUIREMENTS: "password-requirements",
} as const;

// Mock users for testing
export const MOCK_USERS = {
  OWNER: {
    id: "owner-123",
    email: "owner@okaeriresort.ph",
    name: "Juan Dela Cruz",
    role: "OWNER",
    phone: "+639171234567",
    projectId: "project-456",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-15T00:00:00Z"),
  } as User,

  MANAGER: {
    id: "manager-456",
    email: "manager@okaeriresort.ph",
    name: "Maria Santos",
    role: "MANAGER",
    phone: "+639281234567",
    projectId: "project-456",
    createdAt: new Date("2024-01-02T00:00:00Z"),
    updatedAt: new Date("2024-01-16T00:00:00Z"),
  } as User,

  STAFF: {
    id: "staff-789",
    email: "staff@okaeriresort.ph",
    name: "Pedro Gonzales",
    role: "STAFF",
    phone: "+639391234567",
    projectId: "project-456",
    createdAt: new Date("2024-01-03T00:00:00Z"),
    updatedAt: new Date("2024-01-17T00:00:00Z"),
  } as User,
} as const;

// Mock auth states
export const MOCK_AUTH_STATES = {
  LOGGED_OUT: {
    user: null,
    token: null,
    refreshToken: null,
    sessionExpiry: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  } as AuthState,

  LOGGED_IN_OWNER: {
    user: MOCK_USERS.OWNER,
    token: "mock-token-owner",
    refreshToken: "mock-refresh-token-owner",
    sessionExpiry: Date.now() + 3600000, // 1 hour
    isAuthenticated: true,
    isLoading: false,
    error: null,
  } as AuthState,

  LOGGED_IN_MANAGER: {
    user: MOCK_USERS.MANAGER,
    token: "mock-token-manager",
    refreshToken: "mock-refresh-token-manager",
    sessionExpiry: Date.now() + 3600000, // 1 hour
    isAuthenticated: true,
    isLoading: false,
    error: null,
  } as AuthState,

  LOADING: {
    user: null,
    token: null,
    refreshToken: null,
    sessionExpiry: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  } as AuthState,

  ERROR: {
    user: null,
    token: null,
    refreshToken: null,
    sessionExpiry: null,
    isAuthenticated: false,
    isLoading: false,
    error: "Authentication failed",
  } as AuthState,
} as const;

// Create test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
}

// Create test router
export function createTestRouter(initialEntries: string[] = ["/"], initialIndex?: number) {
  return createMemoryHistory({
    initialEntries,
    initialIndex,
  });
}

// Enhanced render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  initialEntries?: string[];
  initialIndex?: number;
  authState?: Partial<AuthState>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    initialEntries = ["/"],
    initialIndex,
    authState,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Mock auth store if auth state provided
  if (authState) {
    vi.doMock("@/stores/authStore", () => ({
      useAuthStore: vi.fn(() => ({
        ...MOCK_AUTH_STATES.LOGGED_OUT,
        ...authState,
      })),
      useUser: vi.fn(() => authState.user),
      useIsAuthenticated: vi.fn(() => authState.isAuthenticated),
      useAuthLoading: vi.fn(() => authState.isLoading),
      useAuthError: vi.fn(() => authState.error),
    }));
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
    user: userEvent.setup(),
  };
}

// Render function for components that need routing
export function renderWithRouter(ui: ReactElement, options: CustomRenderOptions = {}) {
  return renderWithProviders(ui, options);
}

// Wait for loading states to resolve
export async function waitForLoadingToFinish() {
  const { findByTestId } = await import("@testing-library/react");
  try {
    await findByTestId(TEST_IDS.LOADING_SPINNER, {}, { timeout: 100 });
    await waitFor(() => {
      expect(findByTestId(TEST_IDS.LOADING_SPINNER)).not.toBeInTheDocument();
    });
  } catch {
    // Loading spinner might not be present
  }
}

// Accessibility testing helper
export async function checkA11y(container: HTMLElement) {
  const { axe } = await import("@axe-core/react");
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// Form testing helpers
export const formHelpers = {
  async fillLoginForm(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
    const emailInput = document.querySelector(
      `[data-testid="${TEST_IDS.LOGIN_EMAIL}"]`
    ) as HTMLInputElement;
    const passwordInput = document.querySelector(
      `[data-testid="${TEST_IDS.LOGIN_PASSWORD}"]`
    ) as HTMLInputElement;

    if (emailInput) await user.type(emailInput, email);
    if (passwordInput) await user.type(passwordInput, password);
  },

  async fillRegisterForm(
    user: ReturnType<typeof userEvent.setup>,
    data: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      projectName?: string;
      phone?: string;
    }
  ) {
    const nameInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_NAME}"]`
    ) as HTMLInputElement;
    const emailInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_EMAIL}"]`
    ) as HTMLInputElement;
    const passwordInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_PASSWORD}"]`
    ) as HTMLInputElement;
    const confirmPasswordInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_CONFIRM_PASSWORD}"]`
    ) as HTMLInputElement;
    const projectNameInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_PROJECT_NAME}"]`
    ) as HTMLInputElement;
    const phoneInput = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_PHONE}"]`
    ) as HTMLInputElement;
    const termsCheckbox = document.querySelector(
      `[data-testid="${TEST_IDS.REGISTER_TERMS}"]`
    ) as HTMLInputElement;

    if (nameInput) await user.type(nameInput, data.name);
    if (emailInput) await user.type(emailInput, data.email);
    if (passwordInput) await user.type(passwordInput, data.password);
    if (confirmPasswordInput) await user.type(confirmPasswordInput, data.confirmPassword);
    if (projectNameInput && data.projectName) await user.type(projectNameInput, data.projectName);
    if (phoneInput && data.phone) await user.type(phoneInput, data.phone);
    if (termsCheckbox) await user.click(termsCheckbox);
  },

  async submitForm(user: ReturnType<typeof userEvent.setup>, testId: string) {
    const submitButton = document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
    if (submitButton) await user.click(submitButton);
  },
};

// Security testing helpers
export const securityHelpers = {
  // Create expired token for testing
  createExpiredToken: () => "expired-token-for-testing",

  // Create invalid token for testing
  createInvalidToken: () => "invalid.token.format",

  // Mock rate limit exceeded
  mockRateLimitExceeded: () => ({
    allowed: false,
    retryAfter: 60,
    remaining: 0,
  }),

  // Mock successful rate limit
  mockRateLimitSuccess: () => ({
    allowed: true,
    retryAfter: 0,
    remaining: 10,
  }),
};

// Philippine-specific testing data
export const philippineTestData = {
  validPhoneNumbers: [
    "+639171234567",
    "09171234567",
    "639171234567",
    "+639281234567",
    "09281234567",
  ],

  invalidPhoneNumbers: [
    "1234567890",
    "+1234567890",
    "09171234", // too short
    "+639171234567890", // too long
    "+639071234567", // invalid prefix
  ],

  validNames: [
    "Juan Dela Cruz",
    "María José Santos",
    "José Rizal Jr.",
    "Ana-Marie Gonzales",
    "John O'Connor",
    "Niño Gabriel",
  ],

  invalidNames: [
    "Juan123", // contains numbers
    "Juan@Dela", // special characters
    "J", // too short
    "", // empty
  ],

  validEmails: ["juan@okaeriresort.ph", "maria.santos@gmail.com", "owner+test@okaeriresort.ph"],

  validProjectNames: [
    "Okaeri Beach Resort",
    "Paradise Bay Resort & Spa",
    "Sunset Villa (Boracay)",
    "The Palawan Experience",
  ],
};

// Performance testing helpers
export const performanceHelpers = {
  // Measure component render time
  measureRenderTime: async (renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  },

  // Check for memory leaks in components
  checkMemoryLeaks: () => {
    // Basic memory usage check
    if (typeof window !== "undefined" && "performance" in window && "memory" in performance) {
      const { memory } = performance as any;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  },
};

// Export commonly used testing utilities
export { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
export { userEvent };
export { vi, expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

// Re-export for convenience
export * from "./test-utils";
