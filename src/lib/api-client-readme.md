# Enhanced API Client with Dependency Injection

The API client has been enhanced with dependency injection capabilities to
improve testability and enable Test-Driven Development (TDD). This maintains
full backward compatibility while providing powerful new testing capabilities.

## Quick Start

### Existing Code (Unchanged)

```typescript
import { apiClient, api } from "@/lib/api-client";

// These continue to work exactly as before
const user = await api.get("/auth/me");
const response = await apiClient.post("/auth/login", { email, password });
```

### New Testing Capabilities

```typescript
import { TestApiClientFactory } from "@tests/mocks/api-client-mocks";

// Create a client with mock authenticated user for testing
const { client, authProvider, tokenManager, user } =
  TestApiClientFactory.createWithAuthenticatedUser({
    name: "Test User",
    role: "admin",
  });

// Use in tests without real authentication
const response = await client.get("/auth/me");
expect(response.data).toEqual(user);
```

## Architecture

### Dependency Interfaces

**AuthProvider**: Abstracts authentication operations

```typescript
interface AuthProvider {
  getToken(): string | null;
  getRefreshToken(): string | null;
  getUser(): User | null;
  getProjectId(): string | null;
  refreshSession(): Promise<void>;
  logout(): void;
  isTokenExpired(token: string, buffer?: number): boolean;
}
```

**TokenManager**: Abstracts token storage and validation

```typescript
interface TokenManager {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  storeTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
  isTokenExpired(token: string, buffer?: number): boolean;
  validateTokenStructure(token: string): { valid: boolean; error?: string };
}
```

## Factory Pattern

### Production Usage

```typescript
import { ApiClientFactory } from "@/lib/api-client-factory";

// Production client with real dependencies
const client = ApiClientFactory.createProductionClient({
  baseURL: "/api/v2",
  timeout: 10000,
});

// Development client with debug headers
const devClient = ApiClientFactory.createDevelopmentClient();
```

### Test Usage

```typescript
import {
  ApiClientFactory,
  setupTestEnvironment,
} from "@/lib/api-client-factory";
import {
  MockAuthProvider,
  MockTokenManager,
} from "@tests/mocks/api-client-mocks";

// Setup test environment
const authProvider = new MockAuthProvider();
const tokenManager = new MockTokenManager();
setupTestEnvironment(authProvider, tokenManager);

// All factory methods now use mocks
const client = ApiClientFactory.createTestClient();
```

## Test Doubles

### MockAuthProvider

```typescript
import {
  MockAuthProvider,
  createMockUser,
} from "@tests/mocks/api-client-mocks";

const mockAuth = new MockAuthProvider({
  token: "test-token",
  user: createMockUser({ role: "admin" }),
  projectId: "test-project",
});

// Control token expiration in tests
mockAuth.setTokenExpired(true);
expect(mockAuth.isTokenExpired("any-token")).toBe(true);

// Simulate refresh failures
mockAuth.setRefreshSessionShouldFail(true);
await expect(mockAuth.refreshSession()).rejects.toThrow();

// Track logout calls
mockAuth.logout();
expect(mockAuth.wasLogoutCalled()).toBe(true);
```

### MockTokenManager

```typescript
import { MockTokenManager } from "@tests/mocks/api-client-mocks";

const mockTokens = new MockTokenManager({
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
});

// Simulate token validation
mockTokens.setTokenValidationResult({
  valid: false,
  error: "Invalid format",
});
```

## Pre-configured Test Scenarios

### Common Scenarios

```typescript
import { TestScenarios } from "@tests/mocks/api-client-mocks";

// Authenticated user with valid tokens
const { user, authProvider, tokenManager } = TestScenarios.authenticatedUser();

// Unauthenticated user
const { authProvider } = TestScenarios.unauthenticatedUser();

// User with expired token
const { authProvider } = TestScenarios.expiredToken();

// Failed refresh scenario
const { authProvider } = TestScenarios.refreshFailure();
```

### Philippine-Specific Scenarios

```typescript
// Philippine resort admin with GCash preferences
const { user, authProvider } = TestScenarios.philippineAdmin();
expect(user.preferredPaymentMethod).toBe("gcash");
expect(user.phoneNumber).toMatch(/^\+63/);

// Staff member with limited permissions
const { user, authProvider } = TestScenarios.staffMember();
expect(user.role).toBe("staff");
```

## TDD Workflow Example

### 1. Write the Test First

```typescript
// user-profile.test.ts
describe("User Profile API", () => {
  it("should update user profile with GCash number", async () => {
    const { client, authProvider, user } =
      TestApiClientFactory.createWithAuthenticatedUser({
        preferredPaymentMethod: "gcash",
      });

    const updatedData = { gcashNumber: "09171234567" };
    const response = await client.patch("/auth/profile", updatedData);

    expect(response.success).toBe(true);
    expect(response.data.gcashNumber).toBe("09171234567");
  });
});
```

### 2. Run Test (Red)

```bash
npm test -- user-profile.test.ts
# Test fails because API endpoint doesn't exist yet
```

### 3. Implement the Feature (Green)

```typescript
// Implement the actual API endpoint
// The test passes because we can mock the response
```

### 4. Refactor (Refactor)

```typescript
// Clean up implementation while tests remain green
```

## Testing Patterns

### Unit Testing Individual Methods

```typescript
describe("API Client Token Refresh", () => {
  it("should refresh token when expired", async () => {
    const mockAuth = new MockAuthProvider();
    mockAuth.setToken("expired-token");
    mockAuth.setTokenExpired(true);

    const client = createApiClient({
      baseURL: "/api",
      authProvider: mockAuth,
      tokenManager: new MockTokenManager(),
    });

    await client.get("/auth/me");

    // Should have triggered refresh
    expect(mockAuth.getToken()).toBe("new-access-token");
  });
});
```

### Integration Testing with Real API

```typescript
describe("API Client Integration", () => {
  beforeEach(() => {
    setupProductionEnvironment(); // Use real dependencies
  });

  it("should authenticate with real API", async () => {
    const client = ApiClientFactory.createProductionClient();

    // Real API call in integration test
    const response = await client.post(
      "/auth/login",
      {
        email: "test@example.com",
        password: "password",
      },
      { skipAuth: true }
    );

    expect(response.success).toBe(true);
  });
});
```

### Mocking HTTP Responses

```typescript
import {
  createMockResponse,
  createMockErrorResponse,
} from "@tests/mocks/api-client-mocks";

// Mock successful response
global.fetch = vi
  .fn()
  .mockResolvedValue(createMockResponse({ id: "1", name: "Test User" }));

// Mock error response
global.fetch = vi
  .fn()
  .mockResolvedValue(createMockErrorResponse("Unauthorized", 401));
```

## Philippine Resort Features

### GCash Payment Support

```typescript
const user = createMockUser({
  preferredPaymentMethod: "gcash",
  gcashNumber: "09171234567",
  phoneNumber: "+63 917 123 4567",
});

// Test GCash-specific functionality
expect(user.preferredPaymentMethod).toBe("gcash");
expect(user.gcashNumber).toMatch(/^09\d{9}$/);
```

### Multi-Property Support

```typescript
const resortAdmin = createMockUser({
  role: "admin",
  projects: ["okaeri-resort-bohol", "okaeri-resort-palawan"],
});

const mockAuth = new MockAuthProvider({
  user: resortAdmin,
  projectId: "okaeri-resort-bohol",
});

expect(mockAuth.getProjectId()).toBe("okaeri-resort-bohol");
```

## Migration Guide

### From Existing Tests

**Before:**

```typescript
// Had to mock the entire auth store
vi.mock("@/stores/authStore", () => ({
  useAuthStore: mockAuthStore,
}));
```

**After:**

```typescript
// Just inject mock dependencies
const { client } = TestApiClientFactory.createWithAuthenticatedUser();
```

### From Manual Mocking

**Before:**

```typescript
// Manual fetch mocking for every test
global.fetch = vi.fn().mockImplementation(/* complex logic */);
```

**After:**

```typescript
// Use pre-configured scenarios
const { client } = TestApiClientFactory.createWithScenario("philippineAdmin");
```

## Performance Benefits

1. **Faster Test Execution**: Mock dependencies eliminate network calls
2. **Isolated Tests**: Each test controls its own authentication state
3. **Deterministic Results**: No dependency on external auth service
4. **Parallel Testing**: Tests don't interfere with each other's state

## Backward Compatibility

- All existing `apiClient` usage continues to work unchanged
- All existing `api` helper functions work unchanged
- No breaking changes to existing authentication flow
- Production code uses the same dependencies as before

This enhancement enables faster, more reliable testing while maintaining the
same production behavior your application depends on.
