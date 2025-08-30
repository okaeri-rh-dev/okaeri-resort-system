# Gate 3: Component Testing & Isolation Strategy

## Executive Summary

Gate 3 addresses **CRITICAL GAPS** in component testing and state management
isolation identified in our testing analysis. This strategy provides
comprehensive, implementable patterns for testing React components in isolation
while ensuring proper state management with Zustand and TanStack Query.

**Target**: 100% component isolation with zero state leakage between tests
**Focus**: React 19 features, Zustand stores, TanStack Query cache, and
resort-specific workflows

---

## 1. Component Isolation Testing Strategy

### 1.1 Components Requiring Isolation Testing

#### **Critical Booking Components**

```typescript
// Priority 1: Core booking workflow components
-BookingCalendar - // Calendar state, date selection
  BookingForm - // Form validation, guest data
  AvailabilityChecker - // Property availability logic
  CheckInForm - // Status transitions
  CheckOutForm - // Payment calculations
  // Priority 2: Complex state components
  BookingDashboard - // Multiple data sources
  BookingTimeline - // Date range calculations
  PropertySelector; // Multi-property state
```

#### **Financial Management Components**

```typescript
// Priority 1: Money handling components
-ExpenseForm - // File uploads, currency handling
  PaymentTracker - // Payment status, calculations
  FinancialDashboard - // Aggregated metrics
  ReceiptUploader - // File state management
  // Priority 2: Reporting components
  ExpenseReport - // Filter state, date ranges
  IncomeReport; // Real-time data updates
```

#### **State-Heavy Components**

```typescript
// Components with complex Zustand/TanStack Query integration
-ProjectSwitcher - // Multi-tenant state
  GuestManager - // Guest data with bookings
  PropertyManager - // Property configuration
  UserProfile; // Authentication state
```

### 1.2 Isolation Testing Criteria

**Every component test MUST:**

1. **Mount independently** - No dependencies on other tests
2. **Reset all state** - Clean Zustand stores and TanStack Query cache
3. **Mock external dependencies** - API calls, localStorage, file uploads
4. **Test in isolation** - Component behavior without side effects
5. **Validate cleanup** - No memory leaks or persistent state

---

## 2. State Management Test Patterns

### 2.1 Zustand Store Reset Pattern

```typescript
// src/test/utils/store-utils.ts
import { useBookingStore } from "@/stores/bookingStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";

/**
 * Reset all Zustand stores to initial state
 * MUST be called in beforeEach of every component test
 */
export const resetAllStores = () => {
  // Reset each store using their reset methods
  useBookingStore.getState().reset();
  useExpenseStore.getState().reset();
  useProjectStore.getState().reset();
  useAuthStore.getState().reset();

  // Clear any persisted state
  localStorage.clear();
  sessionStorage.clear();

  // Reset optimistic state
  useBookingStore.getState().clearOptimisticBookings();
  useExpenseStore.getState().clearOptimisticExpenses();
};

/**
 * Create isolated store for testing
 * Use for components that need specific store state
 */
export const createIsolatedStore = <T>(
  storeCreator: () => T,
  initialState?: Partial<T>
) => {
  const store = storeCreator();
  if (initialState) {
    Object.assign(store, initialState);
  }
  return store;
};
```

### 2.2 TanStack Query Cache Isolation

```typescript
// src/test/utils/query-utils.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Create isolated query client for each test
 * Prevents cache leakage between tests
 */
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,           // No retries in tests
        gcTime: 0,             // No garbage collection
        staleTime: 0,          // Always fresh data
        networkMode: 'offlineFirst', // For offline testing
      },
      mutations: {
        retry: false,
        networkMode: 'offlineFirst',
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},        // Suppress console noise
    },
  });
};

/**
 * Query provider wrapper for isolated testing
 */
export const QueryTestWrapper: React.FC<{
  children: React.ReactNode;
  queryClient?: QueryClient;
}> = ({ children, queryClient = createTestQueryClient() }) => {
  // Clear cache before each render
  queryClient.clear();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

/**
 * Assert no cached data between tests
 */
export const assertCleanQueryCache = (queryClient: QueryClient) => {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  expect(queries).toHaveLength(0);
  expect(cache.getAll().every(q => q.state.data === undefined)).toBe(true);
};
```

### 2.3 React 19 useOptimistic Testing Pattern

```typescript
// src/test/utils/optimistic-utils.ts
import { renderHook } from "@testing-library/react";
import { useOptimistic } from "react";
import { useBookingStore } from "@/stores/bookingStore";

/**
 * Test useOptimistic integration with Zustand
 */
export const testOptimisticUpdates = <T>(
  optimisticUpdater: (state: T, optimisticValue: T) => T,
  initialState: T,
  optimisticValue: T
) => {
  const TestComponent = () => {
    const [optimisticState, addOptimistic] = useOptimistic(
      initialState,
      optimisticUpdater
    );

    return { optimisticState, addOptimistic };
  };

  const { result } = renderHook(() => TestComponent());

  return result;
};

/**
 * Test booking creation with optimistic updates
 */
export const testOptimisticBookingCreation = () => {
  const bookingStore = useBookingStore.getState();
  const initialBookings = bookingStore.bookings;

  const TestBookingComponent = () => {
    const [optimisticBookings, addOptimisticBooking] = useOptimistic(
      initialBookings,
      (state, newBooking: Booking) => [newBooking, ...state]
    );

    return { optimisticBookings, addOptimisticBooking };
  };

  return renderHook(() => TestBookingComponent());
};
```

### 2.4 Complete Test Setup Pattern

```typescript
// src/test/utils/component-test-utils.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { QueryTestWrapper } from './query-utils';
import { resetAllStores } from './store-utils';
import { setupMockServices } from './mock-utils';

/**
 * Comprehensive test wrapper with full isolation
 */
export const renderWithIsolation = (
  component: React.ReactElement,
  options?: {
    initialStoreState?: Record<string, any>;
    mockApiResponses?: Record<string, any>;
    user?: User | null;
  }
) => {
  // Reset all state before each test
  resetAllStores();

  // Setup mock services
  const { mockApi, cleanup } = setupMockServices(options?.mockApiResponses);

  // Create isolated query client
  const queryClient = createTestQueryClient();

  // Render with all providers
  const result = render(
    <QueryTestWrapper queryClient={queryClient}>
      {component}
    </QueryTestWrapper>
  );

  return {
    ...result,
    queryClient,
    mockApi,
    cleanup: () => {
      cleanup();
      queryClient.clear();
      resetAllStores();
    }
  };
};

/**
 * Standard beforeEach setup for all component tests
 */
export const setupComponentTest = () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Reset DOM
    document.body.innerHTML = '';

    // Reset timers
    vi.clearAllTimers();

    // Reset fetch mocks
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Cleanup any remaining side effects
    resetAllStores();
    vi.restoreAllMocks();
  });
};
```

---

## 3. Resort-Specific Testing Scenarios

### 3.1 Booking Calendar Isolation Tests

```typescript
// src/components/booking/__tests__/BookingCalendar.test.tsx
describe('BookingCalendar Component Isolation', () => {
  setupComponentTest();

  describe('Date State Isolation', () => {
    it('should not leak selected dates between test runs', () => {
      // Test 1: Select dates
      const { cleanup } = renderWithIsolation(<BookingCalendar />);

      const calendar = screen.getByTestId('booking-calendar');
      fireEvent.click(screen.getByText('15')); // Select date

      expect(screen.getByText('Selected: 15')).toBeInTheDocument();
      cleanup();

      // Test 2: Fresh render should have no selected dates
      renderWithIsolation(<BookingCalendar />);
      expect(screen.queryByText('Selected: 15')).not.toBeInTheDocument();
    });

    it('should reset availability cache between tests', async () => {
      // Test 1: Load availability for property A
      const { cleanup, mockApi } = renderWithIsolation(<BookingCalendar />, {
        mockApiResponses: {
          '/availability': { unavailableDates: ['2024-01-15'] }
        }
      });

      await waitFor(() => {
        expect(screen.getByText('15')).toHaveClass('unavailable');
      });
      cleanup();

      // Test 2: Different property should not show cached availability
      renderWithIsolation(<BookingCalendar propertyId="different-property" />);
      expect(screen.getByText('15')).not.toHaveClass('unavailable');
    });

    it('should isolate month navigation state', () => {
      // Test navigation state doesn't persist between tests
      const { cleanup } = renderWithIsolation(<BookingCalendar />);

      fireEvent.click(screen.getByLabelText('Next month'));
      expect(screen.getByText('February 2024')).toBeInTheDocument();
      cleanup();

      // Fresh render should show default month
      renderWithIsolation(<BookingCalendar />);
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });
  });

  describe('Zustand Store Integration', () => {
    it('should update booking store without affecting other tests', async () => {
      const { cleanup } = renderWithIsolation(<BookingCalendar />);

      // Create booking through calendar
      fireEvent.click(screen.getByText('15'));
      fireEvent.click(screen.getByText('17'));
      fireEvent.click(screen.getByText('Book Selected Dates'));

      // Verify store update
      await waitFor(() => {
        const bookings = useBookingStore.getState().optimisticBookings;
        expect(bookings).toHaveLength(1);
      });

      cleanup();

      // Store should be clean in next test
      const cleanBookings = useBookingStore.getState().optimisticBookings;
      expect(cleanBookings).toHaveLength(0);
    });
  });

  describe('TanStack Query Integration', () => {
    it('should not cache availability queries between tests', async () => {
      // Test 1: Query availability
      const { cleanup, queryClient } = renderWithIsolation(<BookingCalendar />);

      await waitFor(() => {
        expect(screen.getByText('Loading availability...')).not.toBeInTheDocument();
      });

      // Verify query was made
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.some(q => q.queryKey.includes('availability'))).toBe(true);

      cleanup();

      // Test 2: Fresh query client should have no cached data
      const { queryClient: freshClient } = renderWithIsolation(<BookingCalendar />);
      assertCleanQueryCache(freshClient);
    });
  });
});
```

### 3.2 Expense Form Testing with File Uploads

```typescript
// src/components/financial/__tests__/ExpenseForm.test.tsx
describe('ExpenseForm Component Isolation', () => {
  setupComponentTest();

  describe('File Upload State Isolation', () => {
    it('should not persist uploaded files between tests', async () => {
      // Test 1: Upload file
      const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
      const { cleanup } = renderWithIsolation(<ExpenseForm />);

      const fileInput = screen.getByLabelText('Upload Receipt');
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
      });

      cleanup();

      // Test 2: Fresh form should have no files
      renderWithIsolation(<ExpenseForm />);
      expect(screen.queryByText('receipt.jpg')).not.toBeInTheDocument();
    });

    it('should reset form validation state', async () => {
      // Test 1: Trigger validation errors
      const { cleanup } = renderWithIsolation(<ExpenseForm />);

      fireEvent.click(screen.getByText('Save Expense'));

      await waitFor(() => {
        expect(screen.getByText('Amount is required')).toBeInTheDocument();
      });

      cleanup();

      // Test 2: Fresh form should have no validation errors
      renderWithIsolation(<ExpenseForm />);
      expect(screen.queryByText('Amount is required')).not.toBeInTheDocument();
    });
  });

  describe('Optimistic Updates with Zustand', () => {
    it('should handle optimistic expense creation without leakage', async () => {
      const { cleanup } = renderWithIsolation(<ExpenseForm />);

      // Fill and submit form
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Test expense' }
      });
      fireEvent.click(screen.getByText('Save Expense'));

      // Verify optimistic update
      await waitFor(() => {
        const expenses = useExpenseStore.getState().optimisticExpenses;
        expect(expenses).toHaveLength(1);
        expect(expenses[0].description).toBe('Test expense');
      });

      cleanup();

      // Next test should have clean store
      const cleanExpenses = useExpenseStore.getState().optimisticExpenses;
      expect(cleanExpenses).toHaveLength(0);
    });
  });
});
```

### 3.3 Multi-Property Context Testing

```typescript
// src/components/properties/__tests__/PropertySelector.test.tsx
describe('PropertySelector Multi-Tenant Isolation', () => {
  setupComponentTest();

  describe('Project Context Isolation', () => {
    it('should not leak project selection between tests', () => {
      // Test 1: Select project A
      const { cleanup } = renderWithIsolation(<PropertySelector />, {
        initialStoreState: {
          projects: [
            { id: 'project-a', name: 'Resort A' },
            { id: 'project-b', name: 'Resort B' }
          ]
        }
      });

      fireEvent.click(screen.getByText('Resort A'));

      const activeProject = useProjectStore.getState().activeProjectId;
      expect(activeProject).toBe('project-a');

      cleanup();

      // Test 2: Fresh component should have no active project
      renderWithIsolation(<PropertySelector />);
      const cleanProject = useProjectStore.getState().activeProjectId;
      expect(cleanProject).toBeNull();
    });

    it('should isolate property data for different projects', async () => {
      // Test 1: Load properties for project A
      const { cleanup } = renderWithIsolation(<PropertySelector />, {
        mockApiResponses: {
          '/projects/project-a/properties': {
            data: [{ id: 'prop-1', name: 'Villa A' }]
          }
        },
        initialStoreState: {
          activeProjectId: 'project-a'
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Villa A')).toBeInTheDocument();
      });

      cleanup();

      // Test 2: Different project should not show cached properties
      renderWithIsolation(<PropertySelector />, {
        mockApiResponses: {
          '/projects/project-b/properties': {
            data: [{ id: 'prop-2', name: 'Villa B' }]
          }
        },
        initialStoreState: {
          activeProjectId: 'project-b'
        }
      });

      expect(screen.queryByText('Villa A')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Villa B')).toBeInTheDocument();
      });
    });
  });
});
```

### 3.4 Offline Queue Management Testing

```typescript
// src/components/offline/__tests__/OfflineQueue.test.tsx
describe('Offline Queue Isolation', () => {
  setupComponentTest();

  describe('Offline State Management', () => {
    it('should isolate offline queue between tests', async () => {
      // Test 1: Add items to offline queue
      const { cleanup } = renderWithIsolation(<OfflineQueue />);

      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      // Create expense while offline
      const expenseStore = useExpenseStore.getState();
      await expenseStore.createExpense({
        amount: 100,
        description: 'Offline expense'
      });

      // Verify queued action
      const offlineQueue = expenseStore.offlineQueue;
      expect(offlineQueue).toHaveLength(1);

      cleanup();

      // Test 2: Fresh queue should be empty
      renderWithIsolation(<OfflineQueue />);
      const cleanQueue = useExpenseStore.getState().offlineQueue;
      expect(cleanQueue).toHaveLength(0);
    });

    it('should test sync without affecting other tests', async () => {
      // Test sync functionality in isolation
      const { cleanup } = renderWithIsolation(<OfflineQueue />);

      // Queue offline actions
      const expenseStore = useExpenseStore.getState();
      expenseStore.addToOfflineQueue('CREATE_EXPENSE', { amount: 100 });
      expenseStore.addToOfflineQueue('UPDATE_BOOKING', { id: '123' });

      // Go back online and sync
      Object.defineProperty(navigator, 'onLine', { value: true });
      await expenseStore.syncOfflineQueue();

      // Verify queue cleared
      expect(expenseStore.offlineQueue).toHaveLength(0);

      cleanup();

      // Next test should start with clean slate
      const cleanState = useExpenseStore.getState();
      expect(cleanState.offlineQueue).toHaveLength(0);
      expect(cleanState.isSyncing).toBe(false);
    });
  });
});
```

---

## 4. CI Integration Requirements

### 4.1 Gate 3 CI Job Configuration

```yaml
# .github/workflows/gate-3-component-isolation.yml
name: "Gate 3: Component Testing & Isolation"

on:
  pull_request:
    paths:
      - "src/components/**"
      - "src/stores/**"
      - "src/hooks/**"
  push:
    branches: [main]

jobs:
  component-isolation-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run Component Isolation Tests
        run: |
          npm run test:component-isolation -- \
            --reporter=verbose \
            --coverage \
            --run
        env:
          NODE_ENV: test
          CI: true

      - name: Validate State Isolation
        run: |
          npm run test:validate-isolation

      - name: Check Memory Leaks
        run: |
          npm run test:memory-check

      - name: Generate Isolation Report
        run: |
          npm run test:isolation-report

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: component-isolation-results
          path: |
            coverage/
            test-results.json
            isolation-report.html
```

### 4.2 Package.json Scripts

```json
{
  "scripts": {
    "test:component-isolation": "vitest run src/components/**/*.test.tsx --config vitest.component.config.ts",
    "test:validate-isolation": "vitest run src/test/isolation/*.test.ts",
    "test:memory-check": "node scripts/check-memory-leaks.js",
    "test:isolation-report": "node scripts/generate-isolation-report.js"
  }
}
```

### 4.3 Specialized Vitest Config for Component Testing

```typescript
// vitest.component.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup-component-isolation.ts"],

    // Component-specific configuration
    include: [
      "src/components/**/*.test.{ts,tsx}",
      "src/test/isolation/**/*.test.ts",
    ],

    // Isolation-specific settings
    isolate: true, // Force test isolation
    poolOptions: {
      forks: {
        singleFork: true, // Prevent state leakage between workers
      },
    },

    // Memory leak detection
    logHeapUsage: true,

    // Coverage for components only
    coverage: {
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/stores/**/*.ts",
        "src/hooks/**/*.ts",
      ],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: {
        global: {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
```

### 4.4 Validation Criteria

**Gate 3 passes if:**

1. **100% State Isolation** - All tests pass when run in random order
2. **Memory Leak Free** - No memory growth between test runs
3. **Cache Isolation** - TanStack Query cache cleared between tests
4. **Store Reset** - All Zustand stores return to initial state
5. **Component Independence** - Each component can render in isolation
6. **Performance** - All component tests complete within timeout limits

---

## 5. Developer Testing Workflow

### 5.1 Local Component Testing Commands

```bash
# Run all component isolation tests
npm run test:component-isolation

# Run specific component tests with watch mode
npm run test:component-isolation -- --watch BookingCalendar

# Validate isolation for single component
npm run test:validate-component -- ExpenseForm

# Check for memory leaks in component tests
npm run test:memory-check -- --component BookingForm

# Generate isolation report for debugging
npm run test:isolation-report -- --verbose
```

### 5.2 Debug Isolation Issues

```typescript
// src/test/utils/isolation-debug.ts
export const debugIsolationIssue = (componentName: string) => {
  console.log("=== ISOLATION DEBUG ===");
  console.log("Component:", componentName);
  console.log("Zustand stores state:");

  console.log("- Booking Store:", useBookingStore.getState());
  console.log("- Expense Store:", useExpenseStore.getState());
  console.log("- Project Store:", useProjectStore.getState());

  console.log("LocalStorage keys:", Object.keys(localStorage));
  console.log("SessionStorage keys:", Object.keys(sessionStorage));

  console.log("DOM elements:", document.body.innerHTML.length);
  console.log("========================");
};

// Usage in tests
afterEach(() => {
  if (process.env.DEBUG_ISOLATION) {
    debugIsolationIssue("MyComponent");
  }
});
```

### 5.3 Component Test Template

```typescript
// src/test/templates/component-test.template.tsx
import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIsolation, setupComponentTest } from "@/test/utils";
import { MyComponent } from "../MyComponent";

describe("MyComponent Isolation Tests", () => {
  setupComponentTest();

  describe("State Isolation", () => {
    it("should reset state between test runs", () => {
      // Test implementation
    });

    it("should not leak props or context", () => {
      // Test implementation
    });
  });

  describe("Store Integration", () => {
    it("should update stores without side effects", async () => {
      // Test implementation
    });

    it("should handle optimistic updates in isolation", async () => {
      // Test implementation
    });
  });

  describe("Query Cache Isolation", () => {
    it("should not cache data between tests", async () => {
      // Test implementation
    });
  });

  describe("Cleanup Validation", () => {
    it("should cleanup all resources", () => {
      // Test implementation
    });
  });
});
```

### 5.4 Add Component Test Checklist

When adding new component tests, developers must verify:

**Pre-Test Setup:**

- [ ] Component imports only necessary dependencies
- [ ] Test file uses `setupComponentTest()`
- [ ] All external dependencies are mocked
- [ ] Test data factories are used for consistent data

**During Test:**

- [ ] Each test case is independent
- [ ] Store state is validated before/after actions
- [ ] Async operations use proper waiting
- [ ] Error boundaries are tested

**Post-Test Cleanup:**

- [ ] All stores return to initial state
- [ ] Query cache is empty
- [ ] DOM is clean
- [ ] No console errors or warnings
- [ ] Memory usage is stable

**Resort-Specific Validation:**

- [ ] Currency handling is isolated per test
- [ ] Multi-property data doesn't leak
- [ ] Date calculations don't affect other tests
- [ ] File upload state is properly cleaned

---

## 6. Testing Infrastructure Files

### 6.1 Enhanced Test Setup

```typescript
// src/test/setup-component-isolation.ts
import { beforeEach, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { resetAllStores } from "./utils/store-utils";
import { setupGlobalMocks } from "./utils/mock-utils";

// Global setup for component isolation
beforeEach(() => {
  // Reset all application state
  resetAllStores();

  // Clear all mocks
  vi.clearAllMocks();

  // Setup global mocks
  setupGlobalMocks();

  // Reset DOM
  document.body.innerHTML = "";

  // Clear timers
  vi.clearAllTimers();
});

afterEach(() => {
  // Cleanup React Testing Library
  cleanup();

  // Final state validation
  if (process.env.VALIDATE_ISOLATION) {
    validateCleanState();
  }

  // Restore all mocks
  vi.restoreAllMocks();
});

const validateCleanState = () => {
  // Validate stores are clean
  const bookingStore = useBookingStore.getState();
  const expenseStore = useExpenseStore.getState();

  if (bookingStore.bookings.length > 0) {
    throw new Error("Booking store not cleaned between tests");
  }

  if (expenseStore.expenses.length > 0) {
    throw new Error("Expense store not cleaned between tests");
  }

  // Validate DOM is clean
  if (document.body.innerHTML.trim() !== "") {
    throw new Error("DOM not cleaned between tests");
  }
};
```

### 6.2 Mock Service Factory

```typescript
// src/test/utils/mock-service-factory.ts
import { vi } from "vitest";

export const createMockServices = (overrides?: Record<string, any>) => {
  const defaultResponses = {
    "/api/bookings": { data: [], meta: { total: 0 } },
    "/api/expenses": { data: [], meta: { total: 0 } },
    "/api/properties": { data: [] },
    "/api/guests": { data: [] },
  };

  const responses = { ...defaultResponses, ...overrides };

  const mockFetch = vi.fn(async (url: string) => {
    const matchingResponse = Object.entries(responses).find(([pattern]) =>
      url.includes(pattern)
    );

    if (matchingResponse) {
      return {
        ok: true,
        status: 200,
        json: async () => matchingResponse[1],
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    };
  });

  global.fetch = mockFetch;

  return {
    mockFetch,
    cleanup: () => {
      vi.restoreAllMocks();
    },
  };
};
```

---

## 7. Success Metrics & Validation

### 7.1 Gate 3 Success Criteria

**Quantitative Metrics:**

- ✅ 100% of component tests pass in isolation
- ✅ Zero state leakage detected between test runs
- ✅ Memory usage stable across test suite
- ✅ All tests complete within 15 minutes
- ✅ 95%+ code coverage for components

**Qualitative Validation:**

- ✅ Tests can run in any order without failures
- ✅ Component behavior is predictable and isolated
- ✅ Store state resets correctly between tests
- ✅ Query cache isolation prevents data leakage
- ✅ Resort-specific workflows test correctly

### 7.2 Continuous Validation

```typescript
// scripts/validate-component-isolation.js
const { execSync } = require("child_process");

const validateIsolation = () => {
  console.log("🔍 Validating component isolation...");

  // Run tests in random order multiple times
  const orders = ["--sequence.shuffle", "--sequence.concurrent"];

  for (const order of orders) {
    console.log(`Testing with ${order}...`);

    try {
      execSync(`npm run test:component-isolation -- ${order} --run`, {
        stdio: "inherit",
      });
      console.log(`✅ ${order} passed`);
    } catch (error) {
      console.error(`❌ ${order} failed`);
      process.exit(1);
    }
  }

  console.log("🎉 All isolation tests passed!");
};

validateIsolation();
```

### 7.3 Performance Monitoring

```typescript
// src/test/utils/performance-monitor.ts
export const monitorTestPerformance = (testName: string) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();

  return {
    end: () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      if (duration > 5000) {
        // 5 second warning
        console.warn(`⚠️ Test ${testName} took ${duration}ms`);
      }

      if (memoryDelta > 10_000_000) {
        // 10MB warning
        console.warn(`⚠️ Test ${testName} used ${memoryDelta} bytes`);
      }

      return { duration, memoryDelta };
    },
  };
};
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)

1. Create store reset utilities
2. Implement query cache isolation
3. Setup component test infrastructure
4. Add basic isolation validation

### Phase 2: Core Components (Week 2)

1. Test booking calendar isolation
2. Test expense form isolation
3. Test multi-property components
4. Add CI integration

### Phase 3: Advanced Features (Week 3)

1. Test React 19 useOptimistic integration
2. Test offline queue isolation
3. Add performance monitoring
4. Complete documentation

### Phase 4: Validation (Week 4)

1. Run full isolation test suite
2. Validate CI pipeline
3. Performance optimization
4. Developer workflow documentation

This strategy ensures **zero state leakage** between component tests while
maintaining high performance and developer productivity for the resort
management system.
