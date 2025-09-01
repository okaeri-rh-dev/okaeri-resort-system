# Phase 0 API Contracts Documentation

## Overview

This document captures the API contracts from preserved infrastructure
components that will be used in Phase 1 and beyond.

## Preserved Infrastructure Contracts

### 1. Authentication Store (src/stores/authStore.ts)

```typescript
interface AuthStore {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  hydrate: () => Promise<void>;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: "admin" | "user";
}
```

### 2. Security Infrastructure

#### JWT Security Manager

```typescript
interface SecureTokenManager {
  // Token Management
  setTokens: (accessToken: string, refreshToken: string) => void;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  clearTokens: () => void;
  isTokenValid: () => boolean;

  // Auth Headers
  getAuthHeaders: () => { Authorization: string } | {};

  // Token Refresh
  scheduleTokenRefresh: () => void;
  cancelTokenRefresh: () => void;
}
```

#### Session Monitor

```typescript
interface SessionMonitor {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetTimeout: () => void;
  onSessionExpired: (callback: () => void) => void;

  // Configuration
  SESSION_TIMEOUT: number; // 60 minutes
  WARNING_THRESHOLD: number; // 5 minutes before expiry
}
```

#### Rate Limiter

```typescript
interface RateLimiter {
  checkLimit: (key: string) => Promise<boolean>;
  increment: (key: string) => Promise<void>;
  reset: (key: string) => Promise<void>;

  // Configuration
  LOGIN_ATTEMPTS: number; // 5 attempts
  WINDOW_DURATION: number; // 15 minutes
}
```

### 3. API Client (src/lib/api-client.ts)

```typescript
interface ApiClient {
  // HTTP Methods
  get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>>;
  put<T>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;

  // Configuration
  setBaseURL: (url: string) => void;
  setDefaultHeaders: (headers: Record<string, string>) => void;

  // Interceptors
  addRequestInterceptor: (interceptor: RequestInterceptor) => void;
  addResponseInterceptor: (interceptor: ResponseInterceptor) => void;
}

interface ApiResponse<T = any> {
  data?: T;
  success: boolean;
  message: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp?: string;
}

interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  retry?: number;
  skipAuth?: boolean;
}
```

### 4. Database Types (src/types/)

```typescript
// User Types
interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
}

// Project Types (Multi-tenant)
interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectSettings {
  timezone: string;
  currency: string;
  language: string;
  features: {
    bookings: boolean;
    financial: boolean;
    staff: boolean;
    reports: boolean;
  };
}

// Booking Types
interface Booking {
  id: string;
  projectId: string;
  propertyId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  totalAmount: number;
  currency: string;
  guests: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Financial Types
interface Expense {
  id: string;
  projectId: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  date: Date;
  receiptUrl?: string;
  approvedBy?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. Mock Service Contracts

```typescript
interface MockServiceConfig {
  delay?: number; // Network delay simulation
  errorRate?: number; // Error simulation rate (0-1)
  seed?: string; // Deterministic seed for random data
}

interface AuthServiceMock {
  login: (
    credentials: LoginCredentials
  ) => Promise<ApiResponse<{ user: User; token: string }>>;
  register: (data: RegisterData) => Promise<ApiResponse<User>>;
  logout: () => Promise<ApiResponse<void>>;
  refreshToken: () => Promise<ApiResponse<{ token: string }>>;
  getCurrentUser: () => Promise<ApiResponse<User>>;

  // Test utilities
  seedUsers: (users: User[]) => void;
  clearUsers: () => void;
  simulateError: (operation: string) => void;
}

interface BookingServiceMock {
  getBookings: (filters?: BookingFilters) => Promise<ApiResponse<Booking[]>>;
  createBooking: (data: CreateBookingData) => Promise<ApiResponse<Booking>>;
  updateBooking: (
    id: string,
    data: UpdateBookingData
  ) => Promise<ApiResponse<Booking>>;
  cancelBooking: (id: string) => Promise<ApiResponse<void>>;

  // Test utilities
  seedBookings: (bookings: Booking[]) => void;
  clearBookings: () => void;
}
```

## Integration Points for Phase 1

### Authentication Flow

1. **Login Form** → `authStore.login()` → `apiClient.post('/api/auth/login')`
2. **Token Management** → `SecureTokenManager.setTokens()` → Memory-only storage
3. **API Calls** → `SecureTokenManager.getAuthHeaders()` → Authorization: Bearer
   header
4. **Session Monitoring** → `SessionMonitor.startMonitoring()` → Auto-logout on
   timeout

### Security Requirements

- JWT tokens MUST be sent via Authorization headers only
- NO cookie-based authentication
- Tokens stored in memory only (no localStorage/sessionStorage)
- Rate limiting on login attempts (5 attempts per 15 minutes)
- Session timeout after 60 minutes of inactivity

### Testing Contracts

- Mock services use deterministic seeds for consistent test data
- All mock services simulate network delays (configurable)
- Error scenarios can be triggered for testing error handling
- Mock data follows the same type contracts as real API

## Usage Examples

### Authentication Example

```typescript
import { useAuthStore } from "@/stores/authStore";
import { secureTokenManager } from "@/lib/security/secure-token-manager";

// Login
const authStore = useAuthStore();
await authStore.login({ email: "user@example.com", password: "password" });

// Make authenticated API call
const headers = secureTokenManager.getAuthHeaders();
const response = await apiClient.get("/api/bookings", { headers });
```

### Mock Service Example

```typescript
import { authServiceMock } from "@/mocks/services/auth-service.mock";

// Configure mock for testing
authServiceMock.seedUsers([
  { id: "1", email: "test@example.com", name: "Test User", role: "admin" },
]);

// Test login
const response = await authServiceMock.login({
  email: "test@example.com",
  password: "password",
});
```

## Phase 1 Requirements

Components implementing these contracts in Phase 1 must:

1. Use the existing authStore for all authentication state
2. Call SecureTokenManager for token management
3. Use apiClient for all API calls
4. Include proper TypeScript types from src/types/
5. Follow the security requirements (no cookies, memory-only storage)
6. Integrate with mock services for development/testing

## Validation Checklist

- [ ] All API calls use Authorization headers
- [ ] No JWT tokens in cookies
- [ ] No tokens in localStorage/sessionStorage
- [ ] Rate limiting implemented on login
- [ ] Session timeout monitoring active
- [ ] Mock services configured with deterministic seeds
- [ ] TypeScript types properly imported
- [ ] Multi-tenant projectId included where required

---

_This document serves as the authoritative API contract reference for Phase 1
implementation._ _All components must adhere to these contracts to ensure
compatibility with preserved infrastructure._
