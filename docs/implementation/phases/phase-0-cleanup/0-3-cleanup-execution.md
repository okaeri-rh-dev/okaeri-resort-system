# Sub-Phase 0.3: Cleanup Execution

## Overview

This sub-phase executes the systematic removal of UI components that require TDD
rewriting while maintaining the integrity of preserved infrastructure. It
implements safe deletion procedures, creates comprehensive test infrastructure
for TDD development, and establishes mock services to support UI development
without backend dependencies.

## Objectives

1. **Safe Component Removal**: Remove UI components in dependency-safe order
2. **Test Infrastructure Setup**: Create comprehensive TDD testing utilities and
   templates
3. **Mock Service Implementation**: Build robust mock services for UI
   development
4. **Quality Gate Installation**: Implement continuous validation during cleanup
5. **Development Readiness**: Ensure clean development environment for TDD

## Cleanup Execution Strategy

### 1. Component Removal Order

```typescript
// cleanup-execution.ts
// Systematic cleanup execution with dependency management

interface CleanupPhase {
  phase: number;
  description: string;
  components: string[];
  dependencies: string[];
  validationRequired: boolean;
  rollbackProcedure: string;
}

const cleanupPlan: CleanupPhase[] = [
  {
    phase: 1,
    description: "Remove unused and deprecated components",
    components: [
      "src/components/deprecated/",
      "src/pages/unused/",
      "src/layouts/legacy/",
      "src/routes/temp/",
    ],
    dependencies: [],
    validationRequired: false,
    rollbackProcedure: "git restore from cleanup-phase-1 tag",
  },
  {
    phase: 2,
    description: "Remove page components (keeping route structure)",
    components: [
      "src/pages/LoginPage.tsx",
      "src/pages/RegisterPage.tsx",
      "src/pages/DashboardPage.tsx",
      "src/pages/BookingsPage.tsx",
      "src/pages/ExpensesPage.tsx",
      "src/pages/SettingsPage.tsx",
      "src/pages/ReportsPage.tsx",
    ],
    dependencies: ["src/routes/", "src/components/navigation/"],
    validationRequired: true,
    rollbackProcedure: "git restore from cleanup-phase-2 tag",
  },
  {
    phase: 3,
    description: "Remove layout components",
    components: [
      "src/layouts/AuthLayout.tsx",
      "src/layouts/DashboardLayout.tsx",
      "src/layouts/RootLayout.tsx",
    ],
    dependencies: ["src/routes/", "src/pages/"],
    validationRequired: true,
    rollbackProcedure: "git restore from cleanup-phase-3 tag",
  },
  {
    phase: 4,
    description: "Remove UI components (except base UI library)",
    components: [
      "src/components/auth/",
      "src/components/navigation/",
      "src/components/loading/",
      "src/components/error/",
    ],
    dependencies: ["src/components/ui/"],
    validationRequired: true,
    rollbackProcedure: "git restore from cleanup-phase-4 tag",
  },
  {
    phase: 5,
    description: "Remove route implementations (keeping structure)",
    components: [
      "src/routes/_auth.tsx",
      "src/routes/_protected.tsx",
      "src/routes/index.tsx",
    ],
    dependencies: ["src/routeTree.gen.ts"],
    validationRequired: true,
    rollbackProcedure: "git restore from cleanup-phase-5 tag",
  },
];

class CleanupExecutor {
  private currentPhase: number = 0;
  private validationResults: Map<number, boolean> = new Map();

  async executeCleanup(): Promise<void> {
    console.log("🧹 Starting systematic cleanup execution...");

    for (const phase of cleanupPlan) {
      await this.executePhase(phase);
    }

    console.log("✅ Cleanup execution completed successfully");
  }

  private async executePhase(phase: CleanupPhase): Promise<void> {
    console.log(`\n📋 Executing Phase ${phase.phase}: ${phase.description}`);

    // Create checkpoint
    await this.createCheckpoint(phase.phase);

    // Validate dependencies before removal
    if (phase.validationRequired) {
      await this.validateDependencies(phase);
    }

    // Remove components safely
    await this.removeComponents(phase.components);

    // Run validation tests
    await this.runValidationTests(phase);

    // Update project structure
    await this.updateProjectStructure(phase);

    console.log(`✅ Phase ${phase.phase} completed successfully`);
  }

  private async createCheckpoint(phase: number): Promise<void> {
    const { execSync } = require("child_process");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const tagName = `cleanup-phase-${phase}-${timestamp}`;

    try {
      execSync(`git add -A`);
      execSync(`git commit -m "Checkpoint before cleanup phase ${phase}"`);
      execSync(`git tag ${tagName}`);

      console.log(`📌 Created checkpoint: ${tagName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create checkpoint: ${error.message}`);
    }
  }

  private async validateDependencies(phase: CleanupPhase): Promise<void> {
    console.log("🔍 Validating dependencies...");

    for (const component of phase.components) {
      const dependencies = await this.findDependencies(component);

      if (dependencies.length > 0) {
        const allowedDeps = phase.dependencies;
        const problematicDeps = dependencies.filter(
          (dep) => !allowedDeps.some((allowed) => dep.includes(allowed))
        );

        if (problematicDeps.length > 0) {
          throw new Error(
            `Cannot remove ${component} - has problematic dependencies: ${problematicDeps.join(", ")}`
          );
        }
      }
    }

    console.log("✅ Dependency validation passed");
  }

  private async removeComponents(components: string[]): Promise<void> {
    const fs = require("fs").promises;
    const path = require("path");

    for (const component of components) {
      try {
        const fullPath = path.resolve(component);
        const stats = await fs.stat(fullPath).catch(() => null);

        if (stats) {
          if (stats.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`🗑️  Removed directory: ${component}`);
          } else {
            await fs.unlink(fullPath);
            console.log(`🗑️  Removed file: ${component}`);
          }
        } else {
          console.log(
            `ℹ️  Component not found (already removed): ${component}`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to remove ${component}: ${error.message}`);
        throw error;
      }
    }
  }

  private async runValidationTests(phase: CleanupPhase): Promise<void> {
    if (!phase.validationRequired) return;

    const { execSync } = require("child_process");

    try {
      // Run TypeScript compilation check
      console.log("🔍 Running TypeScript validation...");
      execSync("npx tsc --noEmit", { stdio: "pipe" });

      // Run infrastructure tests
      console.log("🧪 Running infrastructure tests...");
      execSync("npm run test:infrastructure", { stdio: "pipe" });

      // Run basic smoke tests
      console.log("🔍 Running smoke tests...");
      execSync("npm run test:smoke", { stdio: "pipe" });

      this.validationResults.set(phase.phase, true);
      console.log("✅ Validation tests passed");
    } catch (error) {
      this.validationResults.set(phase.phase, false);
      console.error(`❌ Validation failed for phase ${phase.phase}`);
      throw error;
    }
  }
}
```

### 2. TDD Test Infrastructure Setup

```typescript
// tests/utils/tdd-infrastructure.ts
// Comprehensive TDD testing utilities and patterns

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, RouterProvider } from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
import { vi, expect } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

// Test Wrapper for all TDD components
interface TestWrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
  router?: Router;
  initialEntries?: string[];
}

export function TestWrapper({
  children,
  queryClient,
  router,
  initialEntries = ['/']
}: TestWrapperProps): ReactElement {
  // Create default query client if not provided
  const defaultQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  // Create test router if not provided
  const testRouter = router || createTestRouter(initialEntries);

  return (
    <QueryClientProvider client={queryClient || defaultQueryClient}>
      <RouterProvider router={testRouter}>
        {children}
      </RouterProvider>
    </QueryClientProvider>
  );
}

// Custom render function for TDD components
export function renderWithProviders(
  ui: ReactElement,
  options: {
    queryClient?: QueryClient;
    router?: Router;
    initialEntries?: string[];
  } = {}
) {
  const user = userEvent.setup();

  const result = render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper {...options}>
        {children}
      </TestWrapper>
    ),
  });

  return {
    ...result,
    user,
    rerender: (ui: ReactElement) =>
      result.rerender(
        <TestWrapper {...options}>
          {ui}
        </TestWrapper>
      ),
  };
}

// Mock Data Factory System
export class MockDataFactory {
  private static instance: MockDataFactory;
  private generators: Map<string, (...args: any[]) => any> = new Map();

  static getInstance(): MockDataFactory {
    if (!MockDataFactory.instance) {
      MockDataFactory.instance = new MockDataFactory();
    }
    return MockDataFactory.instance;
  }

  register<T>(name: string, generator: (...args: any[]) => T): void {
    this.generators.set(name, generator);
  }

  create<T>(name: string, ...args: any[]): T {
    const generator = this.generators.get(name);
    if (!generator) {
      throw new Error(`No generator registered for: ${name}`);
    }
    return generator(...args);
  }

  createMany<T>(name: string, count: number, ...args: any[]): T[] {
    return Array.from({ length: count }, () => this.create<T>(name, ...args));
  }
}

// Initialize mock factories
const mockFactory = MockDataFactory.getInstance();

// User mock factory
mockFactory.register('user', (overrides = {}) => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: `test-${Math.random().toString(36).substr(2, 5)}@example.com`,
  name: `Test User ${Math.random().toString(36).substr(2, 3)}`,
  role: 'user',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
}));

// Booking mock factory
mockFactory.register('booking', (overrides = {}) => ({
  id: `booking-${Math.random().toString(36).substr(2, 9)}`,
  propertyId: `property-${Math.random().toString(36).substr(2, 9)}`,
  userId: `user-${Math.random().toString(36).substr(2, 9)}`,
  checkIn: new Date(Date.now() + 86400000), // Tomorrow
  checkOut: new Date(Date.now() + 172800000), // Day after tomorrow
  guests: Math.floor(Math.random() * 6) + 1,
  status: 'confirmed',
  totalAmount: Math.floor(Math.random() * 1000) + 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
}));

// API Response mock factory
mockFactory.register('apiResponse', (data: any, overrides = {}) => ({
  data,
  success: true,
  message: 'Success',
  timestamp: new Date().toISOString(),
  ...overrides
}));

// Export factory instance
export { mockFactory };

// TDD Test Pattern Templates
export const testPatterns = {
  // Red-Green-Refactor pattern helper
  redGreenRefactor: {
    red: (description: string, testFn: () => void | Promise<void>) => {
      it(`RED: ${description}`, testFn);
    },
    green: (description: string, testFn: () => void | Promise<void>) => {
      it(`GREEN: ${description}`, testFn);
    },
    refactor: (description: string, testFn: () => void | Promise<void>) => {
      it(`REFACTOR: ${description}`, testFn);
    }
  },

  // Component testing patterns
  component: {
    rendering: (componentName: string) =>
      `should render ${componentName} without crashing`,

    props: (propName: string, behavior: string) =>
      `should ${behavior} when ${propName} prop is provided`,

    interaction: (action: string, result: string) =>
      `should ${result} when user ${action}`,

    state: (stateChange: string, trigger: string) =>
      `should ${stateChange} when ${trigger}`,

    accessibility: (requirement: string) =>
      `should meet accessibility requirement: ${requirement}`,

    error: (scenario: string) =>
      `should handle error gracefully when ${scenario}`
  },

  // Form testing patterns
  form: {
    validation: (field: string, rule: string) =>
      `should validate ${field} field according to ${rule}`,

    submission: (scenario: string) =>
      `should handle form submission when ${scenario}`,

    errorDisplay: (field: string) =>
      `should display error message for invalid ${field}`,

    successFlow: (action: string) =>
      `should complete successful ${action} flow`
  },

  // API integration patterns
  api: {
    success: (endpoint: string) =>
      `should handle successful response from ${endpoint}`,

    error: (endpoint: string, errorType: string) =>
      `should handle ${errorType} error from ${endpoint}`,

    loading: (operation: string) =>
      `should show loading state during ${operation}`,

    retry: (operation: string) =>
      `should retry ${operation} on transient failure`
  }
};

// Custom Jest/Vitest matchers for TDD
expect.extend({
  toBeAccessible: async function(received: HTMLElement) {
    const axe = await import('axe-core');
    const results = await axe.run(received);

    const pass = results.violations.length === 0;

    if (pass) {
      return {
        message: () => 'Element is accessible',
        pass: true
      };
    } else {
      const violations = results.violations.map(v =>
        `${v.id}: ${v.description}`
      ).join('\n');

      return {
        message: () => `Element has accessibility violations:\n${violations}`,
        pass: false
      };
    }
  },

  toHaveFormValidation: function(received: HTMLFormElement, field: string) {
    const fieldElement = received.querySelector(`[name="${field}"]`);
    const errorElement = received.querySelector(`[data-testid="${field}-error"]`);

    const hasValidation = fieldElement?.hasAttribute('required') ||
                         fieldElement?.hasAttribute('pattern') ||
                         errorElement !== null;

    const pass = hasValidation;

    return {
      message: () => pass
        ? `Form has validation for ${field}`
        : `Form missing validation for ${field}`,
      pass
    };
  },

  toHaveLoadingState: function(received: HTMLElement) {
    const hasLoadingIndicator = received.querySelector('[data-testid*="loading"]') ||
                               received.querySelector('[aria-label*="loading" i]') ||
                               received.querySelector('.loading') ||
                               received.hasAttribute('aria-busy');

    const pass = !!hasLoadingIndicator;

    return {
      message: () => pass
        ? 'Element has loading state'
        : 'Element missing loading state indicators',
      pass
    };
  }
});

// Test utilities export
export const testUtils = {
  // Wait for API calls to complete
  waitForApiCall: async (mockFn: any, timeout = 5000) => {
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalled();
    }, { timeout });
  },

  // Simulate user typing with realistic delays
  typeWithDelay: async (user: any, element: HTMLElement, text: string) => {
    await user.type(element, text, { delay: 50 });
  },

  // Fill form with validation
  fillForm: async (user: any, formData: Record<string, string>) => {
    for (const [field, value] of Object.entries(formData)) {
      const element = screen.getByRole('textbox', { name: new RegExp(field, 'i') });
      await user.clear(element);
      await user.type(element, value);
    }
  },

  // Submit form and wait for response
  submitForm: async (user: any, buttonText = /submit|save|create/i) => {
    const submitButton = screen.getByRole('button', { name: buttonText });
    await user.click(submitButton);

    // Wait for loading state to appear and disappear
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  }
};
```

### 3. Mock Service Implementation

```typescript
// src/mocks/services/auth-service.mock.ts
// Comprehensive mock service for authentication

import { delay } from "../utils/delay";
import { mockFactory } from "../../tests/utils/tdd-infrastructure";
import type {
  User,
  LoginCredentials,
  RegisterData,
  ApiResponse,
} from "@/types";

interface AuthServiceMock {
  login: (
    credentials: LoginCredentials
  ) => Promise<ApiResponse<{ user: User; token: string }>>;
  register: (data: RegisterData) => Promise<ApiResponse<User>>;
  logout: () => Promise<ApiResponse<void>>;
  refreshToken: () => Promise<ApiResponse<{ token: string }>>;
  forgotPassword: (email: string) => Promise<ApiResponse<void>>;
  resetPassword: (
    token: string,
    password: string
  ) => Promise<ApiResponse<void>>;
  verifyEmail: (token: string) => Promise<ApiResponse<void>>;
  getCurrentUser: () => Promise<ApiResponse<User>>;
}

class AuthServiceMockImpl implements AuthServiceMock {
  private users: Map<string, User & { password: string }> = new Map();
  private tokens: Map<string, { userId: string; expiresAt: Date }> = new Map();
  private currentUser: User | null = null;

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    // Create test users
    const testUser = mockFactory.create("user", {
      email: "test@example.com",
      name: "Test User",
      role: "admin",
    });

    this.users.set(testUser.email, { ...testUser, password: "password123" });

    // Create additional test users
    for (let i = 0; i < 5; i++) {
      const user = mockFactory.create("user");
      this.users.set(user.email, { ...user, password: "password123" });
    }
  }

  async login(
    credentials: LoginCredentials
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    await delay(800); // Simulate network delay

    const user = this.users.get(credentials.email);

    if (!user || user.password !== credentials.password) {
      return {
        success: false,
        message: "Invalid email or password",
        error: {
          code: "INVALID_CREDENTIALS",
          message: "The email or password you entered is incorrect.",
        },
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        message: "Account is deactivated",
        error: {
          code: "ACCOUNT_DEACTIVATED",
          message: "Your account has been deactivated. Please contact support.",
        },
      };
    }

    // Generate mock token
    const token = `mock-token-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    this.tokens.set(token, { userId: user.id, expiresAt });
    this.currentUser = user;

    const { password, ...userWithoutPassword } = user;

    return {
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
      },
    };
  }

  async register(data: RegisterData): Promise<ApiResponse<User>> {
    await delay(1200); // Simulate network delay

    // Check if user already exists
    if (this.users.has(data.email)) {
      return {
        success: false,
        message: "Email already registered",
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email address already exists.",
        },
      };
    }

    // Validate password strength
    if (data.password.length < 8) {
      return {
        success: false,
        message: "Password too weak",
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 8 characters long.",
        },
      };
    }

    // Create new user
    const newUser = mockFactory.create("user", {
      email: data.email,
      name: data.name,
      role: "user",
      isActive: false, // Requires email verification
    });

    this.users.set(data.email, { ...newUser, password: data.password });

    return {
      success: true,
      message: "Registration successful. Please verify your email.",
      data: newUser,
    };
  }

  async logout(): Promise<ApiResponse<void>> {
    await delay(300);

    this.currentUser = null;
    // In a real implementation, we'd invalidate the token on the server

    return {
      success: true,
      message: "Logout successful",
    };
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    await delay(500);

    if (!this.currentUser) {
      return {
        success: false,
        message: "No active session",
        error: {
          code: "NO_SESSION",
          message: "Please log in to continue.",
        },
      };
    }

    // Generate new token
    const token = `mock-token-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    this.tokens.set(token, { userId: this.currentUser.id, expiresAt });

    return {
      success: true,
      message: "Token refreshed",
      data: { token },
    };
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    await delay(1000);

    const user = this.users.get(email);

    if (!user) {
      // Don't reveal whether email exists (security best practice)
      return {
        success: true,
        message:
          "If an account with that email exists, a reset link has been sent.",
      };
    }

    // In real implementation, send email with reset token
    console.log(`Mock: Reset password email sent to ${email}`);

    return {
      success: true,
      message: "Password reset email sent.",
    };
  }

  async resetPassword(
    token: string,
    password: string
  ): Promise<ApiResponse<void>> {
    await delay(800);

    // In real implementation, validate reset token
    if (!token || token === "invalid-token") {
      return {
        success: false,
        message: "Invalid or expired reset token",
        error: {
          code: "INVALID_TOKEN",
          message: "The reset token is invalid or has expired.",
        },
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message: "Password too weak",
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 8 characters long.",
        },
      };
    }

    // Mock password update
    console.log(`Mock: Password updated for token ${token}`);

    return {
      success: true,
      message: "Password updated successfully.",
    };
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    await delay(600);

    // Mock email verification
    if (!token || token === "invalid-token") {
      return {
        success: false,
        message: "Invalid verification token",
        error: {
          code: "INVALID_TOKEN",
          message: "The verification token is invalid or has expired.",
        },
      };
    }

    return {
      success: true,
      message: "Email verified successfully.",
    };
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    await delay(300);

    if (!this.currentUser) {
      return {
        success: false,
        message: "Not authenticated",
        error: {
          code: "NOT_AUTHENTICATED",
          message: "Please log in to access this resource.",
        },
      };
    }

    return {
      success: true,
      message: "User retrieved",
      data: this.currentUser,
    };
  }
}

// Export singleton instance
export const authServiceMock = new AuthServiceMockImpl();

// Mock service factory for testing
export const createAuthServiceMock = (
  overrides: Partial<AuthServiceMock> = {}
): AuthServiceMock => {
  return {
    ...authServiceMock,
    ...overrides,
  };
};

// Test scenarios for different auth states
export const authScenarios = {
  successfulLogin: () =>
    createAuthServiceMock({
      async login(credentials) {
        await delay(300);
        return mockFactory.create("apiResponse", {
          user: mockFactory.create("user", { email: credentials.email }),
          token: "valid-token",
        });
      },
    }),

  failedLogin: () =>
    createAuthServiceMock({
      async login() {
        await delay(500);
        return {
          success: false,
          message: "Invalid credentials",
          error: { code: "INVALID_CREDENTIALS", message: "Login failed" },
        };
      },
    }),

  networkError: () =>
    createAuthServiceMock({
      async login() {
        await delay(100);
        throw new Error("Network error");
      },
    }),

  slowNetwork: () =>
    createAuthServiceMock({
      async login(credentials) {
        await delay(5000); // 5 second delay
        return mockFactory.create("apiResponse", {
          user: mockFactory.create("user", { email: credentials.email }),
          token: "valid-token",
        });
      },
    }),
};
```

### 4. Quality Gates and Validation

```typescript
// scripts/quality-gates.ts
// Continuous quality validation during cleanup

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

interface QualityGate {
  name: string;
  description: string;
  check: () => Promise<QualityResult>;
  required: boolean;
  weight: number;
}

interface QualityResult {
  passed: boolean;
  score: number;
  message: string;
  details?: string[];
}

class QualityGateRunner {
  private gates: QualityGate[] = [
    {
      name: "TypeScript Compilation",
      description: "All TypeScript files must compile without errors",
      check: this.checkTypeScriptCompilation,
      required: true,
      weight: 20,
    },
    {
      name: "Infrastructure Tests",
      description: "All preserved infrastructure tests must pass",
      check: this.checkInfrastructureTests,
      required: true,
      weight: 25,
    },
    {
      name: "Test Coverage",
      description: "Test coverage must meet minimum thresholds",
      check: this.checkTestCoverage,
      required: false,
      weight: 15,
    },
    {
      name: "Linting Rules",
      description: "Code must pass ESLint rules",
      check: this.checkLinting,
      required: true,
      weight: 10,
    },
    {
      name: "Import Resolution",
      description: "All imports must resolve correctly",
      check: this.checkImportResolution,
      required: true,
      weight: 15,
    },
    {
      name: "Build Process",
      description: "Project must build successfully",
      check: this.checkBuildProcess,
      required: true,
      weight: 15,
    },
  ];

  async runAllGates(): Promise<{
    passed: boolean;
    score: number;
    results: QualityResult[];
  }> {
    console.log("🚪 Running quality gates...\n");

    const results: QualityResult[] = [];
    let totalScore = 0;
    let maxScore = 0;
    let allRequiredPassed = true;

    for (const gate of this.gates) {
      console.log(`🔍 Checking: ${gate.name}`);

      try {
        const result = await gate.check();
        results.push({ ...result, ...{ gateName: gate.name } });

        if (result.passed) {
          console.log(`✅ ${gate.name}: ${result.message}`);
          totalScore += gate.weight * result.score;
        } else {
          console.log(`❌ ${gate.name}: ${result.message}`);
          if (gate.required) {
            allRequiredPassed = false;
          }

          if (result.details) {
            result.details.forEach((detail) => console.log(`   ${detail}`));
          }
        }
      } catch (error) {
        console.log(`💥 ${gate.name}: Failed with error - ${error.message}`);
        results.push({
          passed: false,
          score: 0,
          message: `Failed with error: ${error.message}`,
          gateName: gate.name,
        });

        if (gate.required) {
          allRequiredPassed = false;
        }
      }

      maxScore += gate.weight;
      console.log("");
    }

    const finalScore = Math.round((totalScore / maxScore) * 100);
    const passed = allRequiredPassed && finalScore >= 80;

    console.log(`📊 Quality Gate Results:`);
    console.log(`   Overall Score: ${finalScore}%`);
    console.log(
      `   Required Gates: ${allRequiredPassed ? "PASSED" : "FAILED"}`
    );
    console.log(`   Final Result: ${passed ? "✅ PASSED" : "❌ FAILED"}\n`);

    return { passed, score: finalScore, results };
  }

  private async checkTypeScriptCompilation(): Promise<QualityResult> {
    try {
      execSync("npx tsc --noEmit --skipLibCheck", { stdio: "pipe" });

      return {
        passed: true,
        score: 1.0,
        message: "TypeScript compilation successful",
      };
    } catch (error) {
      const errorOutput = error.stdout?.toString() || error.message;

      return {
        passed: false,
        score: 0,
        message: "TypeScript compilation failed",
        details: errorOutput
          .split("\n")
          .filter((line) => line.trim())
          .slice(0, 10),
      };
    }
  }

  private async checkInfrastructureTests(): Promise<QualityResult> {
    try {
      const testOutput = execSync(
        "npm run test:infrastructure -- --reporter=json",
        {
          stdio: "pipe",
        }
      ).toString();

      const testResults = JSON.parse(testOutput);
      const totalTests = testResults.numTotalTests;
      const passedTests = testResults.numPassedTests;
      const failedTests = testResults.numFailedTests;

      if (failedTests > 0) {
        return {
          passed: false,
          score: passedTests / totalTests,
          message: `${failedTests} infrastructure tests failed`,
          details: testResults.testResults
            .filter((result) => result.status === "failed")
            .map((result) => `Failed: ${result.name}`)
            .slice(0, 5),
        };
      }

      return {
        passed: true,
        score: 1.0,
        message: `All ${totalTests} infrastructure tests passed`,
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        message: "Infrastructure tests failed to run",
        details: [error.message],
      };
    }
  }

  private async checkTestCoverage(): Promise<QualityResult> {
    try {
      execSync("npm run test:coverage -- --reporter=json", { stdio: "pipe" });

      // Read coverage report
      const coveragePath = path.join(
        process.cwd(),
        "coverage/coverage-final.json"
      );
      if (!existsSync(coveragePath)) {
        return {
          passed: false,
          score: 0,
          message: "Coverage report not found",
        };
      }

      const coverageData = JSON.parse(readFileSync(coveragePath, "utf-8"));
      const coveragePercentage = this.calculateOverallCoverage(coverageData);

      const targetCoverage = 80;
      const passed = coveragePercentage >= targetCoverage;

      return {
        passed,
        score: Math.min(coveragePercentage / targetCoverage, 1.0),
        message: `Test coverage: ${coveragePercentage}% (target: ${targetCoverage}%)`,
        details: passed ? undefined : ["Coverage below target threshold"],
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        message: "Coverage check failed",
        details: [error.message],
      };
    }
  }

  private async checkLinting(): Promise<QualityResult> {
    try {
      execSync("npx eslint . --ext .ts,.tsx --format json", { stdio: "pipe" });

      return {
        passed: true,
        score: 1.0,
        message: "No linting errors found",
      };
    } catch (error) {
      const errorOutput = error.stdout?.toString();

      if (errorOutput) {
        const lintResults = JSON.parse(errorOutput);
        const totalErrors = lintResults.reduce(
          (sum, result) => sum + result.errorCount,
          0
        );
        const totalWarnings = lintResults.reduce(
          (sum, result) => sum + result.warningCount,
          0
        );

        if (totalErrors > 0) {
          return {
            passed: false,
            score: 0,
            message: `${totalErrors} linting errors found`,
            details: lintResults
              .filter((result) => result.errorCount > 0)
              .slice(0, 5)
              .map(
                (result) => `${result.filePath}: ${result.errorCount} errors`
              ),
          };
        }

        return {
          passed: true,
          score: 0.9,
          message: `${totalWarnings} linting warnings found`,
          details: ["Consider addressing warnings for better code quality"],
        };
      }

      return {
        passed: false,
        score: 0,
        message: "Linting check failed",
        details: [error.message],
      };
    }
  }

  private async checkImportResolution(): Promise<QualityResult> {
    // Check for common import resolution issues
    const issuesFound: string[] = [];

    try {
      // Check for missing preserved infrastructure imports
      const preservedPaths = [
        "src/lib/security",
        "src/stores",
        "src/lib/api-client.ts",
        "src/types",
      ];

      for (const pathToCheck of preservedPaths) {
        if (!existsSync(pathToCheck)) {
          issuesFound.push(`Missing preserved infrastructure: ${pathToCheck}`);
        }
      }

      // Try to resolve critical imports
      const criticalImports = [
        "@/lib/api-client",
        "@/stores/authStore",
        "@/types/api",
      ];

      for (const importPath of criticalImports) {
        try {
          require.resolve(importPath);
        } catch {
          issuesFound.push(`Cannot resolve critical import: ${importPath}`);
        }
      }

      if (issuesFound.length > 0) {
        return {
          passed: false,
          score: Math.max(0, 1 - issuesFound.length / 10),
          message: `${issuesFound.length} import resolution issues found`,
          details: issuesFound.slice(0, 10),
        };
      }

      return {
        passed: true,
        score: 1.0,
        message: "All imports resolve correctly",
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        message: "Import resolution check failed",
        details: [error.message],
      };
    }
  }

  private async checkBuildProcess(): Promise<QualityResult> {
    try {
      execSync("npm run build", { stdio: "pipe" });

      return {
        passed: true,
        score: 1.0,
        message: "Build completed successfully",
      };
    } catch (error) {
      const errorOutput = error.stdout?.toString() || error.message;

      return {
        passed: false,
        score: 0,
        message: "Build process failed",
        details: errorOutput
          .split("\n")
          .filter((line) => line.trim())
          .slice(0, 10),
      };
    }
  }

  private calculateOverallCoverage(coverageData: any): number {
    let totalLines = 0;
    let coveredLines = 0;

    for (const file of Object.values(coverageData)) {
      const lineCoverage = (file as any).s;
      for (const line of Object.values(lineCoverage)) {
        totalLines++;
        if (line > 0) coveredLines++;
      }
    }

    return totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
  }
}

// Export runner
export const qualityGateRunner = new QualityGateRunner();

// CLI interface
if (require.main === module) {
  qualityGateRunner.runAllGates().then((result) => {
    process.exit(result.passed ? 0 : 1);
  });
}
```

## Acceptance Criteria

### Cleanup Execution

- [ ] All UI components safely removed in dependency order
- [ ] Preserved infrastructure remains intact and functional
- [ ] No broken imports or compilation errors
- [ ] Quality gates pass at each cleanup phase
- [ ] Comprehensive rollback procedures tested

### Test Infrastructure

- [ ] TDD test utilities created and documented
- [ ] Mock data factories implemented for all major entities
- [ ] Test patterns and templates available for UI development
- [ ] Custom matchers for accessibility and form validation
- [ ] Integration with preserved infrastructure validated

### Mock Services

- [ ] Authentication service mock with all scenarios
- [ ] Booking service mock with realistic data
- [ ] API service mocks with proper error simulation
- [ ] Network delay simulation for testing loading states
- [ ] Mock service factory for easy test customization

### Development Environment

- [ ] Vite configuration optimized for TDD development
- [ ] Git hooks prevent modification of preserved infrastructure
- [ ] Quality gates run automatically on commits
- [ ] Development server configured for mock services
- [ ] Hot reload working for TDD components only

## Risk Mitigation

### Cleanup Risks

| Risk                                  | Impact   | Likelihood | Mitigation                               |
| ------------------------------------- | -------- | ---------- | ---------------------------------------- |
| Accidental deletion of preserved code | Critical | Low        | Checkpoint system, Git hooks, validation |
| Breaking dependency chains            | High     | Medium     | Dependency analysis, staged removal      |
| Test infrastructure gaps              | Medium   | Medium     | Comprehensive test templates, validation |
| Mock service inadequacy               | Medium   | Low        | Realistic mock data, scenario coverage   |

### Recovery Procedures

```bash
# Emergency cleanup rollback
rollback_cleanup_phase() {
  local phase=$1
  echo "🔄 Rolling back to cleanup phase ${phase}..."

  git checkout "cleanup-phase-${phase}-*"
  npm install
  npm run test:infrastructure

  echo "✅ Rollback completed"
}

# Restore specific component
restore_component() {
  local component_path=$1
  echo "🔄 Restoring component: ${component_path}"

  git checkout HEAD~1 -- "${component_path}"
  git add "${component_path}"
  git commit -m "Emergency restore: ${component_path}"

  echo "✅ Component restored"
}
```

## Deliverables

1. **Clean Repository Structure**
   - All UI components removed using safe dependency order
   - Preserved infrastructure validated and protected
   - Quality gates passing at 100%

2. **TDD Test Infrastructure**
   - Comprehensive test utilities and patterns
   - Mock data factories for all entities
   - Custom matchers for common testing scenarios
   - Integration with preserved infrastructure

3. **Mock Service Layer**
   - Complete authentication service mock
   - Realistic data generation for all services
   - Error scenario simulation
   - Performance testing capabilities

4. **Quality Assurance System**
   - Automated quality gates for continuous validation
   - Git hooks preventing infrastructure modification
   - Comprehensive rollback procedures
   - Development environment optimization

## Agent Responsibilities

### Primary Agent: Context Manager

- Coordinate cleanup execution across all phases
- Validate cleanup completeness and quality
- Manage quality gate implementation
- Oversee test infrastructure setup

### Supporting Agents

- **TypeScript React Quality Expert**: TDD infrastructure and test patterns
- **Security Compliance Auditor**: Validate preserved security infrastructure
- **Modern Form Validation Expert**: Mock service implementation

## Success Metrics

| Metric                        | Target | Current |
| ----------------------------- | ------ | ------- |
| Cleanup Phases Completed      | 5/5    | -       |
| Quality Gates Passing         | 100%   | -       |
| Test Infrastructure Coverage  | 100%   | -       |
| Mock Service Completeness     | 100%   | -       |
| Development Environment Ready | 100%   | -       |

## Handoff to Sub-Phase 0.4

### Completion Checklist

- [ ] All UI components removed safely
- [ ] Preserved infrastructure protected and validated
- [ ] TDD test infrastructure implemented
- [ ] Mock services created and tested
- [ ] Quality gates installed and passing
- [ ] Development environment configured
- [ ] Documentation completed and reviewed

### Next Steps

1. Final validation of cleanup completion
2. Handoff briefing to Phase 1 development team
3. Documentation review and approval
4. Development environment testing
5. Agent role assignments for Phase 1

---

**Status**: Ready to Begin **Duration**: 1 day **Components to Remove**: 23 UI
components **Test Infrastructure**: 12 utility modules **Mock Services**: 8
service implementations **Quality Gates**: 6 validation checks
