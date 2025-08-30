# Test Utilities Specification

> **Purpose**: Complete specification for test utilities and helpers  
> **Status**: Authoritative Reference  
> **Last Updated**: August 2025

---

## Overview

This document provides comprehensive specifications for all test utilities,
helpers, and patterns used in the Okaeri Resort Management System test suite.
These utilities ensure consistent, maintainable, and deterministic testing
across all phases.

---

## 1. Core Test Utilities

### renderWithProviders

**Purpose**: Render components with all required providers for testing

**Function Signature**:

```typescript
function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    initialState?: Partial<RootState>;
    route?: string;
    user?: User;
    mockServices?: Partial<ServiceRegistry>;
    queryClient?: QueryClient;
  }
): RenderResult & {
  user: UserEvent;
  store: StoreApi;
  queryClient: QueryClient;
};
```

**Usage Example**:

```typescript
const { getByRole, user, store } = renderWithProviders(
  <LoginPage />,
  {
    route: '/login',
    user: null,
    mockServices: { auth: mockAuthService }
  }
)
```

**Required Providers**:

- React Query Provider (TanStack Query)
- Router Provider (TanStack Router)
- Zustand Store Provider
- Theme Provider
- Toast Provider
- Error Boundary

**Return Values**:

- All React Testing Library queries
- User event instance for interactions
- Store instance for state assertions
- Query client for cache manipulation

---

## 2. Form Testing Helpers

### formHelpers

**Purpose**: Utilities for testing form interactions

**Available Methods**:

```typescript
interface FormHelpers {
  fillInput: (element: HTMLElement, value: string) => Promise<void>;
  submitForm: (form: HTMLElement) => Promise<void>;
  clearInput: (element: HTMLElement) => Promise<void>;
  selectOption: (select: HTMLElement, value: string) => Promise<void>;
  checkBox: (checkbox: HTMLElement, checked: boolean) => Promise<void>;
  uploadFile: (input: HTMLElement, file: File) => Promise<void>;
  getValidationError: (field: string) => HTMLElement | null;
  waitForValidation: () => Promise<void>;
}
```

**Usage Examples**:

```typescript
// Fill and submit login form
await formHelpers.fillInput(emailInput, "test@resort.com");
await formHelpers.fillInput(passwordInput, "SecurePass123!");
await formHelpers.submitForm(loginForm);

// Check validation error
const error = formHelpers.getValidationError("email");
expect(error).toHaveTextContent("Invalid email format");

// Wait for async validation
await formHelpers.waitForValidation();
```

**Implementation Details**:

- Uses `userEvent` for realistic interactions
- Handles debounced validation
- Simulates keyboard events
- Triggers form validation
- Manages focus states

---

## 3. Mock Users Constants

### MOCK_USERS

**Purpose**: Predefined test users for consistent testing

**Structure**:

```typescript
const MOCK_USERS = {
  admin: {
    id: "1001",
    email: "admin@okaeri-resort.com",
    password: "Admin123!",
    role: "admin",
    name: "Admin User",
    projectId: "proj_admin",
    permissions: ["all"],
    phone: "+639171234567",
  },
  owner: {
    id: "1002",
    email: "owner@resort.com",
    password: "Owner123!",
    role: "owner",
    name: "Juan Dela Cruz",
    projectId: "proj_resort_1",
    permissions: ["read", "write", "delete"],
    phone: "+639181234567",
  },
  staff: {
    id: "1003",
    email: "staff@resort.com",
    password: "Staff123!",
    role: "staff",
    name: "Maria Santos",
    projectId: "proj_resort_1",
    permissions: ["read", "write"],
    phone: "+639191234567",
  },
  guest: {
    id: "1004",
    email: "guest@email.com",
    password: "Guest123!",
    role: "guest",
    name: "Guest User",
    projectId: null,
    permissions: ["read"],
    phone: "+639201234567",
  },
  invalidUser: {
    id: null,
    email: "invalid@test.com",
    password: "wrong",
    role: null,
    name: null,
    projectId: null,
    permissions: [],
    phone: null,
  },
};
```

**Usage Scenarios**:

- Authentication testing
- Role-based access testing
- Multi-tenant isolation testing
- Permission validation
- Profile management testing

---

## 4. Factory Patterns

### User Factory

**Purpose**: Generate test user data

**Interface**:

```typescript
interface UserFactory {
  create(overrides?: Partial<User>): User;
  createMany(count: number, overrides?: Partial<User>): User[];
  createWithBookings(bookingCount: number): UserWithBookings;
  createWithPayments(paymentCount: number): UserWithPayments;
  createPhilippineUser(): User;
}
```

**Usage**:

```typescript
const user = userFactory.create({
  name: "José Rizal",
  email: "jose@resort.ph",
});

const users = userFactory.createMany(10);
const userWithData = userFactory.createWithBookings(5);
```

### Booking Factory

**Purpose**: Generate test booking data

**Interface**:

```typescript
interface BookingFactory {
  create(overrides?: Partial<Booking>): Booking;
  createConfirmed(): Booking;
  createPending(): Booking;
  createCancelled(): Booking;
  createWithPayments(): BookingWithPayments;
  createAirbnbImport(): Booking;
  createManual(): Booking;
}
```

### Expense Factory

**Purpose**: Generate test expense data

**Interface**:

```typescript
interface ExpenseFactory {
  create(overrides?: Partial<Expense>): Expense;
  createWithReceipt(): ExpenseWithReceipt;
  createRecurring(): RecurringExpense;
  createByCategory(category: ExpenseCategory): Expense;
}
```

### Payment Factory

**Purpose**: Generate test payment data

**Interface**:

```typescript
interface PaymentFactory {
  create(overrides?: Partial<Payment>): Payment;
  createCash(): Payment;
  createGCash(): Payment;
  createBankTransfer(): Payment;
  createPartial(amount: number, total: number): Payment;
}
```

---

## 5. Test Setup and Teardown

### setupTest

**Purpose**: Initialize test environment

**Function**:

```typescript
function setupTest(options?: {
  scenario?: "STABLE" | "ERROR" | "SLOW";
  seed?: string;
  timestamp?: string;
  timezone?: string;
}): TestContext;
```

**Default Configuration**:

```typescript
{
  scenario: 'STABLE',
  seed: 'test-seed-2024',
  timestamp: '2024-01-01T00:00:00Z',
  timezone: 'Asia/Manila'
}
```

### cleanupTest

**Purpose**: Clean up after tests

**Function**:

```typescript
function cleanupTest(): Promise<void>;
```

**Actions**:

- Clear all mocks
- Reset mock service state
- Clear localStorage/sessionStorage
- Reset timers
- Clear query cache
- Reset store state

---

## 6. Deterministic Test Configuration

### Time Control

```typescript
const timeHelpers = {
  freezeTime: (date: Date | string) => void
  advanceTime: (ms: number) => void
  restoreTime: () => void
  mockNow: () => Date
}
```

### Random Control

```typescript
const randomHelpers = {
  setSeed: (seed: string) => void
  nextId: () => string
  nextInt: (min: number, max: number) => number
  nextBool: () => boolean
  reset: () => void
}
```

### Network Control

```typescript
const networkHelpers = {
  goOffline: () => void
  goOnline: () => void
  simulateLatency: (ms: number) => void
  simulateError: (error: NetworkError) => void
  reset: () => void
}
```

---

## 7. Async Testing Utilities

### waitForAsync

**Purpose**: Wait for async operations

```typescript
async function waitForAsync(
  callback: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
  }
): Promise<void>;
```

### waitForLoadingToFinish

**Purpose**: Wait for all loading states to complete

```typescript
async function waitForLoadingToFinish(): Promise<void>;
```

### flushPromises

**Purpose**: Flush all pending promises

```typescript
async function flushPromises(): Promise<void>;
```

---

## 8. Accessibility Testing

### checkA11y

**Purpose**: Run accessibility checks

```typescript
async function checkA11y(
  container: HTMLElement,
  options?: {
    rules?: string[];
    skipRules?: string[];
  }
): Promise<A11yResults>;
```

### getByAccessibleName

**Purpose**: Query by accessible name

```typescript
function getByAccessibleName(container: HTMLElement, name: string): HTMLElement;
```

---

## 9. Error Testing Utilities

### expectError

**Purpose**: Assert error states

```typescript
function expectError(
  fn: () => void | Promise<void>,
  error: string | RegExp | Error
): Promise<void>;
```

### simulateError

**Purpose**: Trigger error conditions

```typescript
function simulateError(
  type: "network" | "validation" | "auth" | "server",
  details?: ErrorDetails
): void;
```

---

## 10. Debug Utilities

### debugState

**Purpose**: Log current application state

```typescript
function debugState(): void;
```

**Output**:

- Store state
- Query cache state
- Route state
- Form state
- Mock service state

### takeSnapshot

**Purpose**: Capture state snapshot for comparison

```typescript
function takeSnapshot(name: string): StateSnapshot;
```

### compareSnapshots

**Purpose**: Compare two state snapshots

```typescript
function compareSnapshots(
  snapshot1: StateSnapshot,
  snapshot2: StateSnapshot
): SnapshotDiff;
```

---

## Integration Examples

### Complete Login Test

```typescript
import { renderWithProviders, formHelpers, MOCK_USERS } from '@/test/utils'

describe('Login Flow', () => {
  it('should login successfully', async () => {
    const { getByRole, user } = renderWithProviders(<LoginPage />)

    const emailInput = getByRole('textbox', { name: /email/i })
    const passwordInput = getByRole('textbox', { name: /password/i })
    const submitButton = getByRole('button', { name: /login/i })

    await formHelpers.fillInput(emailInput, MOCK_USERS.owner.email)
    await formHelpers.fillInput(passwordInput, MOCK_USERS.owner.password)
    await user.click(submitButton)

    await waitForLoadingToFinish()

    expect(window.location.pathname).toBe('/dashboard')
  })
})
```

### Error Scenario Test

```typescript
it('should handle network errors', async () => {
  networkHelpers.simulateError({ type: 'NETWORK_ERROR' })

  const { getByRole, getByText } = renderWithProviders(<LoginPage />)

  // ... perform login

  await waitForAsync(() => getByText(/network error/i))
  expect(getByText(/please try again/i)).toBeInTheDocument()
})
```

---

## Configuration Files

### vitest.setup.ts

```typescript
import { setupTest, cleanupTest } from "@/test/utils";

beforeEach(() => {
  setupTest({ scenario: "STABLE" });
});

afterEach(async () => {
  await cleanupTest();
});
```

### test-utils.tsx (exports)

```typescript
export {
  renderWithProviders,
  formHelpers,
  MOCK_USERS,
  setupTest,
  cleanupTest,
  waitForAsync,
  waitForLoadingToFinish,
  // ... all other utilities
};
```

---

## Best Practices

1. **Always use deterministic data** - Never rely on Math.random() or Date.now()
2. **Clean up after tests** - Prevent test pollution
3. **Use realistic interactions** - Prefer userEvent over fireEvent
4. **Test accessibility** - Include a11y checks in component tests
5. **Mock at service level** - Not at fetch/axios level
6. **Use factories for complex data** - Maintain consistency
7. **Await async operations** - Prevent act() warnings
8. **Test error scenarios** - Cover unhappy paths
9. **Snapshot sparingly** - Only for stable UI
10. **Keep tests focused** - One concept per test

---

## Troubleshooting

### Common Issues

| Issue           | Solution                                   |
| --------------- | ------------------------------------------ |
| Act warnings    | Use waitForAsync or waitForLoadingToFinish |
| Flaky tests     | Check for proper time/random mocking       |
| Memory leaks    | Ensure cleanupTest is called               |
| Slow tests      | Check for unnecessary waits or large data  |
| False positives | Verify assertions are specific enough      |

---

## Migration Guide

For migrating from existing test utilities:

1. Replace custom render with `renderWithProviders`
2. Replace fireEvent with `formHelpers` methods
3. Replace hardcoded test data with `MOCK_USERS` and factories
4. Add `setupTest()` to test setup
5. Add `cleanupTest()` to test teardown
6. Replace custom wait utilities with provided async helpers

---

## Summary

These test utilities provide a comprehensive, consistent foundation for TDD
implementation. By using these specifications, all tests will be deterministic,
maintainable, and aligned with project standards.
