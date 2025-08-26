# TypeScript Types & Zod Validation Documentation

## Overview

The Okaeri Resort Management System now features a comprehensive, type-safe
architecture with strict TypeScript types and runtime validation using Zod
schemas. This documentation explains the new type system and how to use it
effectively.

## Architecture

### 1. Database Types (`src/types/database.ts`)

Core TypeScript types derived from Drizzle ORM schemas, providing:

- **Entity Types**: Complete type definitions for all database entities
- **Helper Types**: Create/Update input types, relations, and utility types
- **Type Guards**: Runtime type checking functions
- **Constants**: Database constraints and Philippine-specific constants

```typescript
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  isValidEntityId,
} from "@/types";

// Type-safe user creation
const newUser: CreateUserInput = {
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "+639123456789",
  password: "SecurePass123",
};

// Type guard usage
if (isValidEntityId(userId)) {
  // TypeScript knows userId is a valid UUID string
}
```

### 2. Validation Schemas (`src/types/schemas.ts`)

Comprehensive Zod schemas for runtime validation:

- **Entity Schemas**: Complete validation for all database entities
- **Input Schemas**: Separate schemas for create/update operations
- **Business Rules**: Built-in validation for Philippine phone numbers,
  currency, etc.
- **Cross-Field Validation**: Complex validation rules (e.g., check-out after
  check-in)

```typescript
import { CreateBookingSchema, BookingInput } from "@/types";

// Runtime validation with automatic type inference
const bookingData = CreateBookingSchema.parse(untrustedInput);
// TypeScript knows bookingData is CreateBookingInput type

// Safe parsing with error handling
const result = CreateBookingSchema.safeParse(untrustedInput);
if (result.success) {
  // result.data is properly typed
  console.log(result.data.guestName);
} else {
  // result.error contains validation details
  console.error(result.error.issues);
}
```

### 3. API Types (`src/types/api.ts`)

Complete API communication types:

- **Request/Response Wrappers**: Standardized API response format
- **Authentication Types**: JWT tokens, sessions, permissions
- **Error Handling**: Comprehensive error types and utilities
- **Pagination**: Type-safe paginated responses

```typescript
import { ApiSuccessResponse, ApiError, createSuccessResponse } from "@/types";

// Type-safe API response creation
function createUserResponse(user: User): ApiSuccessResponse<User> {
  return createSuccessResponse(user, "User created successfully");
}

// Error handling with detailed information
try {
  const response = await apiCall();
  const data = handleApiResponse(response);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.isValidationError()) {
      // Handle validation error
    } else if (error.isAuthError()) {
      // Handle authentication error
    }
  }
}
```

## Key Features

### Philippine-Specific Validations

The type system includes built-in support for Philippine business requirements:

```typescript
// Phone number validation and normalization
const PhilippinePhoneSchema = z
  .string()
  .regex(/^(\+63|63|0)?[89]\d{9}$|^(\+63|63|0)?[2-8]\d{7}$/)
  .transform((phone) => normalizePhilippinePhone(phone));

// Currency validation (PHP amounts)
const PhpAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((val) => parseFloat(val) >= 0 && parseFloat(val) <= 999999999.99);

// Constants for Philippine settings
export const PHILIPPINE_CONSTANTS = {
  CURRENCY: "PHP",
  TIMEZONE: "Asia/Manila",
  COUNTRY_CODE: "PH",
  PHONE_PREFIX: "+63",
  LOCALE: "en-PH",
} as const;
```

### Strict Type Safety

All types follow strict null checking patterns:

```typescript
// Explicit nullable types
export interface User {
  id: string; // Required
  email: string; // Required
  phone: string | null; // Explicitly nullable
  avatarUrl?: string; // Optional (undefined allowed)
}

// Helper types prevent manual setting of auto-generated fields
export type CreateUserInput = Omit<
  NewUser,
  "id" | "createdAt" | "updatedAt"
> & {
  loginAttempts?: never; // Prevents manual setting
};
```

### Cross-Field Validation

Zod schemas include business rule validation:

```typescript
export const BookingSchema = z.object({
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
  totalAmount: PhpAmountSchema,
  basePrice: PhpAmountSchema,
  // ... other fields
}).refine(
  (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  }
).refine(
  (data) => {
    // Validate amount calculations
    const calculated = parseFloat(data.basePrice) + /* other calculations */;
    return Math.abs(calculated - parseFloat(data.totalAmount)) < 0.01;
  },
  {
    message: 'Total amount calculation is incorrect',
    path: ['totalAmount'],
  }
);
```

## Integration with Zustand and TanStack Query

### Zustand Store Typing

```typescript
import { User, CreateUserInput, ApiSuccessResponse } from "@/types";

interface AuthState {
  user: User | null;
  login: (credentials: LoginInput) => Promise<void>;
  updateProfile: (data: UpdateUserInput) => Promise<void>;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  login: async (credentials) => {
    // LoginSchema.parse(credentials) ensures runtime validation
    const validCredentials = LoginSchema.parse(credentials);
    // API call with type-safe response
    const response = await authApi.login(validCredentials);
    set({ user: response.data.user });
  },
  // ... other actions
}));
```

### TanStack Query Integration

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ApiBookingsResponse,
  BookingSearchParams,
  CreateBookingInput,
  BookingSchema,
} from "@/types";

// Type-safe query hooks
function useBookings(searchParams: BookingSearchParams) {
  return useQuery({
    queryKey: ["bookings", searchParams],
    queryFn: async (): Promise<ApiBookingsResponse["data"]> => {
      const response = await bookingsApi.getAll(searchParams);
      return handleApiResponse(response);
    },
  });
}

// Type-safe mutation hooks
function useCreateBooking() {
  return useMutation({
    mutationFn: async (data: CreateBookingInput) => {
      // Runtime validation before API call
      const validData = CreateBookingSchema.parse(data);
      const response = await bookingsApi.create(validData);
      return handleApiResponse(response);
    },
    onSuccess: (data) => {
      // data is properly typed as Booking
      console.log("Created booking:", data.bookingCode);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        // Handle specific error types
        if (error.isValidationError()) {
          // Show validation errors
        }
      }
    },
  });
}
```

## Best Practices

### 1. Always Use Runtime Validation

```typescript
// ❌ Bad: Direct API data usage
const handleUserData = (userData: unknown) => {
  const user = userData as User; // Dangerous cast
  return user.email;
};

// ✅ Good: Runtime validation first
const handleUserData = (userData: unknown) => {
  const user = UserSchema.parse(userData); // Runtime validation
  return user.email; // Type-safe access
};
```

### 2. Separate Input/Output Types

```typescript
// ✅ Use specific input types for forms/API calls
const createUser = (input: CreateUserInput) => {
  /* ... */
};

// ✅ Use entity types for data display
const UserProfile = ({ user }: { user: User }) => {
  /* ... */
};
```

### 3. Handle Errors Properly

```typescript
// ✅ Use type-safe error handling
try {
  const result = await apiCall();
  const data = extractApiData(result);
  // Use data safely
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API errors with full context
    console.error(`API Error [${error.code}]: ${error.message}`);
    if (error.field) {
      // Handle field-specific validation errors
    }
  } else {
    // Handle unexpected errors
    console.error("Unexpected error:", error);
  }
}
```

### 4. Use Type Guards

```typescript
// ✅ Use built-in type guards
if (isValidEntityId(id)) {
  // TypeScript knows id is a valid UUID
  await deleteUser(id);
}

if (hasAuditFields(entity)) {
  // TypeScript knows entity has createdAt, updatedAt, etc.
  console.log("Created:", entity.createdAt);
}
```

## Migration from Legacy Types

The new type system is designed to be backward compatible. Legacy types are
still available but marked as deprecated:

```typescript
// ✅ New approach (recommended)
import { User, CreateUserInput, UserSchema } from "@/types";

// ⚠️ Legacy approach (still works but deprecated)
import { User, CreateUserData } from "@/types/common";
```

## Testing with Types

```typescript
import { CreateBookingSchema, BookingInput } from "@/types";

describe("Booking validation", () => {
  it("should validate correct booking data", () => {
    const validBooking: BookingInput = {
      guestName: "John Doe",
      guestPhone: "+639123456789",
      checkInDate: "2024-01-01",
      checkOutDate: "2024-01-02",
      basePrice: "1500.00",
      totalAmount: "1500.00",
      // ... other required fields
    };

    expect(() => CreateBookingSchema.parse(validBooking)).not.toThrow();
  });

  it("should reject invalid dates", () => {
    const invalidBooking = {
      // ... valid fields
      checkInDate: "2024-01-02",
      checkOutDate: "2024-01-01", // Before check-in
    };

    expect(() => CreateBookingSchema.parse(invalidBooking)).toThrow();
  });
});
```

## Performance Considerations

1. **Schema Caching**: Zod schemas are created once and reused
2. **Selective Validation**: Use `.pick()` and `.omit()` for partial validation
3. **Async Validation**: Only when necessary (e.g., database uniqueness checks)
4. **Transform vs Parse**: Use `.transform()` for data normalization

## Conclusion

This comprehensive type system provides:

- **Runtime Safety**: All data is validated before use
- **Development Experience**: Full IntelliSense and compile-time checking
- **Maintainability**: Centralized type definitions and validation rules
- **Business Logic**: Built-in Philippine-specific validations
- **Error Handling**: Detailed, actionable error information

The type system grows with your application needs while maintaining backward
compatibility and providing a smooth migration path from legacy code.
