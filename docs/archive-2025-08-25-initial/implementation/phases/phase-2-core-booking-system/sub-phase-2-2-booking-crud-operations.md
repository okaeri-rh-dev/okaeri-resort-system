# Sub-Phase 2.2: Booking CRUD Operations

## Overview

This sub-phase implements the complete CRUD (Create, Read, Update, Delete)
operations for bookings, including API endpoints, TanStack Query hooks, Zustand
store for UI state, and optimistic updates using React 19 features.

## Objectives

1. Implement all booking API endpoints with proper middleware
2. Create TanStack Query hooks with intelligent caching
3. Setup Zustand store for booking UI state management
4. Implement optimistic updates with React 19's useOptimistic
5. Build comprehensive error handling and recovery

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.71.10",
    "zustand": "^5.0.2",
    "axios": "^1.7.0",
    "react": "^19.1.0"
  }
}
```

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for booking CRUD operations
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test booking-crud.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for booking CRUD operations"
- These tests CANNOT be modified during implementation

### Step 4: Implement Feature

- Agent writes minimal code to pass ALL tests
- Tests remain unchanged - implementation must adapt
- Use repository patterns from `/src/lib/repositories/`
- Apply dependency injection for testability

### Step 5: Independent Verification

- Different specialized agent reviews implementation
- Ensures no overfitting to test cases
- Validates general solution beyond test scenarios
- Confirms best practices and patterns are followed

### Test Coverage Areas

#### API Endpoint Tests

```typescript
// tests/api/bookings/crud.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "@/tests/utils/api-client";
import { createTestBooking } from "@/tests/fixtures/bookings";

describe("Booking CRUD API", () => {
  it("creates booking with valid data", async () => {
    const bookingData = createTestBookingData();
    const response = await testClient.post("/api/bookings", bookingData);
    expect(response.status).toBe(201);
    expect(response.data.bookingReference).toMatch(/^BK-/);
  });

  it("validates required fields on creation", async () => {
    const invalidData = { guestName: "" };
    const response = await testClient.post("/api/bookings", invalidData);
    expect(response.status).toBe(400);
    expect(response.data.errors).toBeDefined();
  });

  it("lists bookings with pagination", async () => {
    const response = await testClient.get("/api/bookings?page=1&limit=10");
    expect(response.status).toBe(200);
    expect(response.data.meta.page).toBe(1);
    expect(response.data.meta.limit).toBe(10);
  });
});
```

#### TanStack Query Hook Tests

```typescript
// tests/hooks/useBookings.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { useBookings, useCreateBooking } from "@/hooks/queries/useBookings";
import { createQueryWrapper } from "@/tests/utils/query-wrapper";

describe("useBookings hooks", () => {
  it("fetches bookings list successfully", async () => {
    const { result } = renderHook(() => useBookings(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.data).toBeInstanceOf(Array);
  });

  it("handles optimistic updates correctly", async () => {
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(),
    });

    const newBooking = createTestBookingData();
    result.current.mutate(newBooking);

    expect(result.current.isPending).toBe(true);
  });
});
```

#### Zustand Store Tests

```typescript
// tests/stores/bookingStore.test.ts
import { renderHook, act } from "@testing-library/react";
import { useBookingStore } from "@/stores/bookingStore";

describe("BookingStore", () => {
  it("manages booking selection state", () => {
    const { result } = renderHook(() => useBookingStore());

    act(() => {
      result.current.selectBooking("booking-1");
    });

    expect(result.current.selectedBookingId).toBe("booking-1");
  });

  it("handles filter state updates", () => {
    const { result } = renderHook(() => useBookingStore());

    act(() => {
      result.current.setFilter("status", "confirmed");
    });

    expect(result.current.filters.status).toBe("confirmed");
  });
});
```

#### React 19 Features Tests

```typescript
// tests/components/OptimisticBookings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { useOptimisticBookings } from '@/hooks/useOptimisticBookings'
import { createQueryWrapper } from '@/tests/utils/query-wrapper'

function TestComponent() {
  const { bookings, createBooking } = useOptimisticBookings()

  return (
    <div>
      <div data-testid="bookings-count">{bookings.length}</div>
      <button
        onClick={() => createBooking(createTestBookingData())}
        data-testid="create-booking"
      >
        Create
      </button>
    </div>
  )
}

describe('Optimistic Updates', () => {
  it('shows optimistic booking immediately', async () => {
    render(<TestComponent />, { wrapper: createQueryWrapper() })

    const initialCount = Number(screen.getByTestId('bookings-count').textContent)
    fireEvent.click(screen.getByTestId('create-booking'))

    expect(screen.getByTestId('bookings-count')).toHaveTextContent(
      String(initialCount + 1)
    )
  })
})
```

## Agent Validation Checklist

### modern-form-validation-expert Validation

- [ ] React Hook Form properly integrated
- [ ] Zod schemas for all form validations
- [ ] Field-level validation with instant feedback
- [ ] Form state management optimized
- [ ] Error messages user-friendly
- [ ] Multi-step form handling if needed
- [ ] File upload validation working
- [ ] Async validation for unique checks

### zustand-tanstack-resort-architect Validation

- [ ] TanStack Query hooks properly structured with caching strategies
- [ ] Zustand store follows best practices for state separation
- [ ] Optimistic updates implemented correctly with rollback
- [ ] Query invalidation strategies comprehensive
- [ ] Mutation error handling with retry logic
- [ ] State synchronization between local and server state
- [ ] Performance optimization for large datasets
- [ ] Offline support considerations

### typescript-react-quality-expert Validation

- [ ] 100% TypeScript coverage with no `any` types
- [ ] React 19 hooks (useOptimistic, useActionState) used correctly
- [ ] Type-safe API client implementation
- [ ] Proper generic types for reusable hooks
- [ ] Discriminated unions for complex state
- [ ] Error boundaries implemented
- [ ] Component props fully typed
- [ ] Form validation with type safety

## Success Criteria

1. **CRUD Operations** - All booking operations functional
2. **Query Hooks** - TanStack Query hooks with caching
3. **UI State** - Zustand store managing UI state
4. **Optimistic Updates** - React 19 hooks for instant feedback
5. **Error Handling** - Comprehensive error recovery
6. **Type Safety** - 100% TypeScript coverage
7. **Performance** - Response times < 200ms
8. **Testing** - 85% test coverage

## Deliverables

- [ ] Complete CRUD API endpoints
- [ ] TanStack Query hooks
- [ ] Zustand UI store
- [ ] Optimistic update implementation
- [ ] Error handling system
- [ ] Form components
- [ ] Unit and integration tests
- [ ] API documentation

## Completion Checklist

- [ ] All CRUD endpoints implemented and tested
- [ ] TanStack Query hooks with proper caching
- [ ] Zustand store managing UI state
- [ ] Optimistic updates working smoothly
- [ ] Error handling comprehensive
- [ ] Forms with validation
- [ ] All tests passing
- [ ] Agent validations passed
- [ ] Documentation complete
- [ ] Ready for Sub-Phase 2.3

---

_Sub-Phase 2.2 implements the core booking operations with modern state
management and optimistic UI patterns._
