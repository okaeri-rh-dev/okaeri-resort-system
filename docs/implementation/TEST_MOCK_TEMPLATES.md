# Test Mock Templates

> **Purpose**: Standardized mock templates for consistent testing across the
> codebase  
> **Status**: Active  
> **Last Updated**: January 2025

## Overview

This document provides standardized mock templates to ensure consistency across
all test files. Using these templates prevents duplicate mocks, reduces
brittleness, and maintains proper RED phase testing.

## TanStack Router Mock Template

### Standard Mock (Use in All Test Files)

```typescript
// Place at the top of test file, after imports
vi.mock("@tanstack/react-router", () => ({
  // Navigation Components and Hooks
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouter: () => ({
    history: { location: { pathname: "/" } },
    navigate: vi.fn(),
  }),

  // Route Parameters and Search
  useParams: () => ({}),
  useSearch: () => ({}),

  // File-based Routing
  createFileRoute: vi.fn((path: string) => ({
    createRoute: vi.fn(),
    useRouteContext: vi.fn(() => ({})),
    useLoaderData: vi.fn(() => undefined),
    component: vi.fn(),
    beforeLoad: vi.fn(),
    loader: vi.fn(),
    validateSearch: vi.fn(),
  })),

  // Route Utilities
  redirect: vi.fn((opts: any) => {
    throw new Error(`Redirect to ${opts.to}`);
  }),

  // Metadata Hooks
  useDocumentTitle: vi.fn(),
  useMeta: vi.fn(),

  // Router Creation
  createMemoryHistory: vi.fn(() => ({
    location: { pathname: "/" }
  })),
  createRouter: vi.fn(),
  createRoute: vi.fn(),
  createRootRouteWithContext: vi.fn(),

  // Components
  RouterProvider: ({ children }: any) => children,
  Outlet: ({ children }: any) => <div data-testid="outlet">{children}</div>,
}));
```

### Usage Guidelines

1. **One Mock Per File**: Only use one `vi.mock("@tanstack/react-router")` block
   per test file
2. **Placement**: Place the mock immediately after imports, before any test
   suites
3. **Consistency**: Use the exact same mock structure across all files
4. **Extension**: If you need additional mocked functions, add them to the
   standard template

### Extending for Specific Tests

If a test needs specific behavior:

```typescript
// In beforeEach or specific test
const mockNavigate = vi.fn();
vi.mocked(useNavigate).mockReturnValue(mockNavigate);

// Test specific navigation behavior
await user.click(submitButton);
expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
```

## Zustand Store Mock Template

### Auth Store Mock

```typescript
vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    // State
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    // Actions
    login: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    refreshToken: vi.fn(),
    updateUser: vi.fn(),
  })),
}));
```

### Project Store Mock

```typescript
vi.mock("@/stores/projectStore", () => ({
  useProjectStore: vi.fn(() => ({
    // State
    currentProject: null,
    projects: [],
    isLoading: false,

    // Actions
    switchProject: vi.fn(),
    loadProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
  })),
}));
```

## Service Mock Templates

### Mock Auth Service

```typescript
vi.mock("@/services/mock/auth.mock.service", () => ({
  MockAuthService: vi.fn().mockImplementation(() => ({
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyToken: vi.fn(),
    refreshToken: vi.fn(),
    checkEmailExists: vi.fn(),
    validateSession: vi.fn(),
  })),
}));
```

### Important: Use Correct Service Paths

- ✅ Correct: `@/services/mock/auth.mock.service`
- ❌ Wrong: `@/services/auth`
- ❌ Wrong: `@/services/authService`

## Validation Schema Mock Templates

### Zod Schema Imports

```typescript
// Always import from the correct path
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

// NOT from non-existent paths like:
// ❌ @/lib/validation/philippineValidation
// ❌ @/lib/schemas/auth
```

## DOM Testing Patterns (Avoiding Brittleness)

### ❌ BAD: Brittle jsdom Assertions

```typescript
// Don't use window.getComputedStyle - jsdom doesn't compute real styles
const styles = window.getComputedStyle(element);
expect(parseInt(styles.height)).toBeGreaterThanOrEqual(44);

// Don't reference unmocked globals
expect(global.alert).not.toHaveBeenCalled(); // Will throw if not mocked
```

### ✅ GOOD: Reliable Assertions

```typescript
// Use class-based assertions
expect(element).toHaveClass("min-h-[44px]");
expect(element).toHaveClass("text-red-600");

// Mock window.alert before using
vi.spyOn(window, "alert").mockImplementation(() => {});
expect(window.alert).not.toHaveBeenCalled();

// Use data-testid for reliable selection
import { TEST_IDS } from "@tests/utils/test-utils";
const form = screen.getByTestId(TEST_IDS.LOGIN_FORM);
```

## RED Phase Test Patterns

### Maintaining Proper RED Phase Failures

```typescript
describe("Component Test", () => {
  it("should render component", () => {
    // RED PHASE: Component not implemented yet
    expect(() => {
      // renderWithProviders(<Component />);
      throw new Error("Component not implemented");
    }).toThrow("Component not implemented");
  });

  it.todo("should handle user interaction");

  it("should validate form input", () => {
    // RED PHASE: Validation not implemented
    expect(false).toBe(true); // Explicit failure
  });
});
```

### Important Rules

1. **Tests Must Fail**: All tests should fail in RED phase
2. **Fail for Right Reason**: Should fail because functionality is missing, not
   because modules don't exist
3. **Use Explicit Errors**: Make it clear why the test is failing
4. **Use .todo()**: For tests not yet written

## Common Issues and Solutions

| Issue                      | Solution                                                       |
| -------------------------- | -------------------------------------------------------------- |
| Module not found errors    | Use correct import paths from this document                    |
| Duplicate mock errors      | Remove all but one mock declaration per module                 |
| Brittle DOM assertions     | Use class-based assertions and TEST_IDS                        |
| Tests passing accidentally | Add explicit `throw new Error()` or `expect(false).toBe(true)` |
| Missing mock functions     | Add to standard template rather than creating new mock         |

## Checklist for Test Files

- [ ] Single mock declaration per external module
- [ ] Using correct import paths for all services
- [ ] Using `@/lib/validations/auth` for schemas
- [ ] No `window.getComputedStyle` usage
- [ ] `window.alert` mocked if used
- [ ] Tests failing with clear error messages
- [ ] Using TEST_IDS for element selection
- [ ] Following RED phase patterns

## Integration with CI/CD

These templates ensure tests work correctly in:

- Local development (`npm test`)
- CI pipeline (GitHub Actions)
- Pre-commit hooks
- Coverage reports

---

**Note**: This document is the authoritative source for test mocking patterns.
All test files should follow these templates to maintain consistency and prevent
test brittleness.
