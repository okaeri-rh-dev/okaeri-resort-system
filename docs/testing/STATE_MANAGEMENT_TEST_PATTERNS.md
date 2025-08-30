# State Management Test Patterns

## Overview

This document defines comprehensive test patterns for state management using
Zustand stores and TanStack Query in the Okaeri Resort System. All patterns
follow TDD principles and integrate with the existing mock service architecture.

## Table of Contents

1. [Core Testing Principles](#core-testing-principles)
2. [Zustand Store Testing](#zustand-store-testing)
3. [TanStack Query Testing](#tanstack-query-testing)
4. [Integration Testing Patterns](#integration-testing-patterns)
5. [Phase-Specific Patterns](#phase-specific-patterns)
6. [Test Utilities and Helpers](#test-utilities-and-helpers)

## Core Testing Principles

### Test Isolation

```typescript
// Each test should have isolated state
beforeEach(() => {
  // Reset stores to initial state
  useAuthStore.setState(initialAuthState);
  // Clear query cache
  queryClient.clear();
  // Reset mock service state
  mockServiceRegistry.reset();
});
```

### Deterministic Testing

- Use fixed timestamps and IDs
- Control async timing with fake timers
- Provide stable mock data through factories
- Ensure reproducible test runs

### Test Coverage Requirements

- Store actions: 100% coverage
- Selectors/computed values: 100% coverage
- Query/mutation hooks: 100% coverage
- Error scenarios: Comprehensive coverage
- Edge cases: Documented and tested

## Zustand Store Testing

### 1. Store Initialization Testing

#### Pattern: Testing Initial State

```typescript
describe("Store Initialization", () => {
  it("should initialize with default state", () => {
    const store = createBookingStore();
    const state = store.getState();

    expect(state).toEqual({
      bookings: [],
      selectedBooking: null,
      filters: defaultFilters,
      isLoading: false,
      error: null,
      optimisticBookings: [],
    });
  });

  it("should restore persisted state", async () => {
    // Set up localStorage mock
    const persistedState = {
      bookings: [mockBooking],
      filters: customFilters,
    };
    localStorage.setItem("booking-storage", JSON.stringify(persistedState));

    const store = createBookingStore();
    await waitFor(() => {
      expect(store.getState().bookings).toEqual(persistedState.bookings);
    });
  });
});
```

#### Pattern: Testing Store Configuration

```typescript
describe("Store Configuration", () => {
  it("should enable devtools in development", () => {
    const store = createStoreWithDevtools();
    expect(window.__REDUX_DEVTOOLS_EXTENSION__).toHaveBeenCalled();
  });

  it("should configure persistence middleware", () => {
    const store = createPersistedStore();
    const persistOptions = store.persist.getOptions();

    expect(persistOptions).toMatchObject({
      name: "booking-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: expect.any(Function),
    });
  });
});
```

### 2. Actions and Mutations Testing

#### Pattern: Testing Synchronous Actions

```typescript
describe("Store Actions", () => {
  let store: BookingStore;

  beforeEach(() => {
    store = createBookingStore();
  });

  it("should add booking to store", () => {
    const booking = bookingFactory.build();

    act(() => {
      store.getState().addBooking(booking);
    });

    expect(store.getState().bookings).toContainEqual(booking);
  });

  it("should update existing booking", () => {
    const booking = bookingFactory.build();
    store.setState({ bookings: [booking] });

    const updates = { status: "confirmed" as const };

    act(() => {
      store.getState().updateBooking(booking.id, updates);
    });

    expect(store.getState().bookings[0]).toMatchObject({
      ...booking,
      ...updates,
    });
  });
});
```

#### Pattern: Testing Asynchronous Actions

```typescript
describe("Async Store Actions", () => {
  it("should handle async data fetching", async () => {
    const store = createBookingStore();
    const mockBookings = bookingFactory.buildList(3);

    mockBookingService.getBookings.mockResolvedValue(mockBookings);

    await act(async () => {
      await store.getState().fetchBookings();
    });

    expect(store.getState()).toMatchObject({
      bookings: mockBookings,
      isLoading: false,
      error: null,
    });
  });

  it("should handle async errors", async () => {
    const store = createBookingStore();
    const error = new Error("Failed to fetch");

    mockBookingService.getBookings.mockRejectedValue(error);

    await act(async () => {
      await store.getState().fetchBookings();
    });

    expect(store.getState()).toMatchObject({
      bookings: [],
      isLoading: false,
      error: error.message,
    });
  });
});
```

### 3. Computed Values and Selectors Testing

#### Pattern: Testing Selectors

```typescript
describe("Store Selectors", () => {
  it("should compute filtered bookings", () => {
    const store = createBookingStore();
    const bookings = [
      bookingFactory.build({ status: "pending" }),
      bookingFactory.build({ status: "confirmed" }),
      bookingFactory.build({ status: "cancelled" }),
    ];

    store.setState({
      bookings,
      filters: { status: "confirmed" },
    });

    const filtered = store.getState().getFilteredBookings();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe("confirmed");
  });

  it("should memoize expensive computations", () => {
    const store = createBookingStore();
    const computeSpy = jest.fn();

    const selector = createSelector(
      (state) => state.bookings,
      (bookings) => {
        computeSpy();
        return calculateMetrics(bookings);
      }
    );

    // First call
    selector(store.getState());
    expect(computeSpy).toHaveBeenCalledTimes(1);

    // Second call with same state
    selector(store.getState());
    expect(computeSpy).toHaveBeenCalledTimes(1);
  });
});
```

### 4. Middleware Testing

#### Pattern: Testing Persist Middleware

```typescript
describe("Persistence Middleware", () => {
  it("should persist state changes to localStorage", async () => {
    const store = createPersistedStore();
    const booking = bookingFactory.build();

    act(() => {
      store.getState().addBooking(booking);
    });

    await waitFor(() => {
      const persisted = JSON.parse(
        localStorage.getItem("booking-storage") || "{}"
      );
      expect(persisted.state.bookings).toContainEqual(booking);
    });
  });

  it("should exclude sensitive data from persistence", async () => {
    const store = createPersistedStore();

    act(() => {
      store.setState({
        bookings: [bookingFactory.build()],
        temporaryToken: "secret-token",
      });
    });

    await waitFor(() => {
      const persisted = JSON.parse(
        localStorage.getItem("booking-storage") || "{}"
      );
      expect(persisted.state.temporaryToken).toBeUndefined();
    });
  });
});
```

### 5. Subscription Testing

#### Pattern: Testing Store Subscriptions

```typescript
describe("Store Subscriptions", () => {
  it("should notify subscribers on state changes", () => {
    const store = createBookingStore();
    const listener = jest.fn();

    const unsubscribe = store.subscribe(listener);

    act(() => {
      store.getState().addBooking(bookingFactory.build());
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ bookings: expect.any(Array) }),
      expect.objectContaining({ bookings: [] })
    );

    unsubscribe();
  });

  it("should support selective subscriptions", () => {
    const store = createBookingStore();
    const listener = jest.fn();

    // Subscribe only to booking changes
    const unsubscribe = store.subscribe(listener, (state) => state.bookings);

    // Change unrelated state
    act(() => {
      store.setState({ filters: { status: "confirmed" } });
    });

    expect(listener).not.toHaveBeenCalled();

    // Change bookings
    act(() => {
      store.getState().addBooking(bookingFactory.build());
    });

    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});
```

### 6. Store Composition Testing

#### Pattern: Testing Combined Stores

```typescript
describe("Store Composition", () => {
  it("should compose multiple store slices", () => {
    const store = createCombinedStore();

    expect(store.getState()).toMatchObject({
      auth: expect.any(Object),
      booking: expect.any(Object),
      financial: expect.any(Object),
    });
  });

  it("should handle cross-store actions", async () => {
    const store = createCombinedStore();

    // Login affects auth store
    await act(async () => {
      await store.getState().auth.login("user@test.com", "password");
    });

    // Should trigger booking data fetch
    await waitFor(() => {
      expect(store.getState().booking.bookings).not.toBeEmpty();
    });
  });
});
```

## TanStack Query Testing

### 1. Query Hook Testing

#### Pattern: Testing Basic Queries

```typescript
describe("Query Hooks", () => {
  it("should fetch data successfully", async () => {
    const { result } = renderHook(() => useBookings(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) }),
      ])
    );
  });

  it("should handle query errors", async () => {
    mockBookingService.getBookings.mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() => useBookings(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toMatchObject({
      message: "Network error",
    });
  });
});
```

#### Pattern: Testing Query Options

```typescript
describe("Query Options", () => {
  it("should respect staleTime configuration", async () => {
    const { result, rerender } = renderHook(
      () => useBookings({ staleTime: 5000 }),
      { wrapper: createQueryWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockBookingService.getBookings.mock.calls.length;

    // Rerender within stale time
    rerender();

    expect(mockBookingService.getBookings.mock.calls.length).toBe(
      firstCallCount
    );
  });

  it("should handle enabled flag", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useBookings({ enabled }),
      {
        wrapper: createQueryWrapper(),
        initialProps: { enabled: false },
      }
    );

    expect(mockBookingService.getBookings).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockBookingService.getBookings).toHaveBeenCalled();
    });
  });
});
```

### 2. Mutation Hook Testing

#### Pattern: Testing Mutations

```typescript
describe("Mutation Hooks", () => {
  it("should create booking successfully", async () => {
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(),
    });

    const newBooking = bookingFactory.build();

    await act(async () => {
      await result.current.mutateAsync(newBooking);
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toMatchObject(newBooking);
  });

  it("should handle mutation errors", async () => {
    mockBookingService.createBooking.mockRejectedValue(
      new Error("Validation failed")
    );

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync(bookingFactory.build());
      } catch (error) {
        expect(error).toMatchObject({ message: "Validation failed" });
      }
    });

    expect(result.current.isError).toBe(true);
  });
});
```

#### Pattern: Testing Optimistic Updates

```typescript
describe("Optimistic Updates", () => {
  it("should update UI optimistically", async () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper({ queryClient }),
    });

    const booking = bookingFactory.build();
    queryClient.setQueryData(["bookings"], [booking]);

    const update = { status: "confirmed" as const };

    act(() => {
      result.current.mutate({ id: booking.id, ...update });
    });

    // Check immediate optimistic update
    const cached = queryClient.getQueryData<Booking[]>(["bookings"]);
    expect(cached?.[0].status).toBe("confirmed");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should rollback on error", async () => {
    const queryClient = new QueryClient();
    mockBookingService.updateBooking.mockRejectedValue(
      new Error("Update failed")
    );

    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper({ queryClient }),
    });

    const booking = bookingFactory.build({ status: "pending" });
    queryClient.setQueryData(["bookings"], [booking]);

    act(() => {
      result.current.mutate({
        id: booking.id,
        status: "confirmed",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Check rollback
    const cached = queryClient.getQueryData<Booking[]>(["bookings"]);
    expect(cached?.[0].status).toBe("pending");
  });
});
```

### 3. Infinite Query Testing

#### Pattern: Testing Infinite Queries

```typescript
describe("Infinite Queries", () => {
  it("should load initial page", async () => {
    const { result } = renderHook(() => useInfiniteBookings(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("should load next page", async () => {
    const { result } = renderHook(() => useInfiniteBookings(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(result.current.data?.pages).toHaveLength(2);
  });
});
```

### 4. Cache Management Testing

#### Pattern: Testing Cache Invalidation

```typescript
describe("Cache Management", () => {
  it("should invalidate queries after mutation", async () => {
    const queryClient = new QueryClient();
    const wrapper = createQueryWrapper({ queryClient });

    // Initial query
    const { result: queryResult } = renderHook(() => useBookings(), {
      wrapper,
    });

    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true);
    });

    const initialCallCount = mockBookingService.getBookings.mock.calls.length;

    // Mutation that invalidates
    const { result: mutationResult } = renderHook(() => useCreateBooking(), {
      wrapper,
    });

    await act(async () => {
      await mutationResult.current.mutateAsync(bookingFactory.build());
    });

    // Should refetch
    await waitFor(() => {
      expect(mockBookingService.getBookings.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });

  it("should handle selective invalidation", async () => {
    const queryClient = new QueryClient();

    // Set up multiple cached queries
    queryClient.setQueryData(["bookings"], []);
    queryClient.setQueryData(["bookings", "123"], bookingFactory.build());
    queryClient.setQueryData(["expenses"], []);

    // Invalidate only booking queries
    await queryClient.invalidateQueries({
      queryKey: ["bookings"],
    });

    expect(queryClient.getQueryState(["bookings"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["bookings", "123"])?.isInvalidated).toBe(
      true
    );
    expect(queryClient.getQueryState(["expenses"])?.isInvalidated).toBe(false);
  });
});
```

### 5. Background Refetching Testing

#### Pattern: Testing Background Refetch

```typescript
describe("Background Refetching", () => {
  it("should refetch on window focus", async () => {
    const { result } = renderHook(
      () => useBookings({ refetchOnWindowFocus: true }),
      { wrapper: createQueryWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const initialCallCount = mockBookingService.getBookings.mock.calls.length;

    // Simulate window focus
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(mockBookingService.getBookings.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });

  it("should refetch at intervals", async () => {
    jest.useFakeTimers();

    const { result } = renderHook(
      () => useBookings({ refetchInterval: 5000 }),
      { wrapper: createQueryWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const initialCallCount = mockBookingService.getBookings.mock.calls.length;

    // Advance time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockBookingService.getBookings.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });

    jest.useRealTimers();
  });
});
```

### 6. Error and Retry Testing

#### Pattern: Testing Retry Logic

```typescript
describe("Error and Retry Handling", () => {
  it("should retry failed queries", async () => {
    let callCount = 0;
    mockBookingService.getBookings.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(bookingFactory.buildList(3));
    });

    const { result } = renderHook(() => useBookings({ retry: 3 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockBookingService.getBookings).toHaveBeenCalledTimes(3);
  });

  it("should use exponential backoff", async () => {
    jest.useFakeTimers();

    mockBookingService.getBookings.mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(
      () =>
        useBookings({
          retry: 2,
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),
        }),
      { wrapper: createQueryWrapper() }
    );

    // First attempt fails immediately
    await waitFor(() => {
      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(1);
    });

    // Second attempt after 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(2);
    });

    // Third attempt after 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(3);
    });

    jest.useRealTimers();
  });
});
```

## Integration Testing Patterns

### 1. Zustand + TanStack Query Integration

#### Pattern: Combined State Management

```typescript
describe("Zustand + TanStack Query Integration", () => {
  it("should sync server state with client store", async () => {
    const store = createBookingStore();
    const queryClient = new QueryClient();

    const { result } = renderHook(
      () => ({
        query: useBookings(),
        store: useBookingStore(),
      }),
      { wrapper: createIntegrationWrapper({ store, queryClient }) }
    );

    // Wait for query to complete
    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Store should be updated with query data
    expect(result.current.store.bookings).toEqual(result.current.query.data);
  });

  it("should handle optimistic updates with both systems", async () => {
    const store = createBookingStore();
    const queryClient = new QueryClient();

    const { result } = renderHook(
      () => ({
        mutation: useCreateBooking(),
        store: useBookingStore(),
      }),
      { wrapper: createIntegrationWrapper({ store, queryClient }) }
    );

    const newBooking = bookingFactory.build();

    act(() => {
      // Add optimistic booking to store
      result.current.store.addOptimisticBooking(newBooking);
      // Trigger mutation
      result.current.mutation.mutate(newBooking);
    });

    // Immediate optimistic update
    expect(result.current.store.optimisticBookings).toContainEqual(newBooking);

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    // Optimistic booking removed, real booking added
    expect(result.current.store.optimisticBookings).toEqual([]);
    expect(result.current.store.bookings).toContainEqual(
      expect.objectContaining({ id: newBooking.id })
    );
  });
});
```

### 2. Optimistic Updates Flow Testing

#### Pattern: Full Optimistic Update Cycle

```typescript
describe("Optimistic Updates Flow", () => {
  it("should handle complete optimistic update cycle", async () => {
    const { result } = renderHook(() => useOptimisticBooking(), {
      wrapper: createQueryWrapper(),
    });

    const booking = bookingFactory.build();
    const update = { status: "confirmed" as const };

    // Track state changes
    const stateChanges: any[] = [];
    result.current.subscribe((state) => {
      stateChanges.push({ ...state });
    });

    await act(async () => {
      await result.current.updateBooking(booking.id, update);
    });

    // Verify state progression
    expect(stateChanges).toEqual([
      expect.objectContaining({
        isOptimistic: true,
        booking: expect.objectContaining(update),
      }),
      expect.objectContaining({
        isOptimistic: false,
        booking: expect.objectContaining(update),
      }),
    ]);
  });

  it("should handle React 19 useOptimistic hook", async () => {
    const { result } = renderHook(() => {
      const [bookings, setBookings] = useState<Booking[]>([]);
      const [optimisticBookings, addOptimisticBooking] = useOptimistic(
        bookings,
        (state, newBooking: Booking) => [...state, newBooking]
      );

      return {
        bookings,
        setBookings,
        optimisticBookings,
        addOptimisticBooking,
      };
    });

    const booking = bookingFactory.build();

    // Add optimistic booking
    act(() => {
      result.current.addOptimisticBooking(booking);
    });

    // Should show in optimistic state
    expect(result.current.optimisticBookings).toContainEqual(booking);
    // Should not be in actual state
    expect(result.current.bookings).toEqual([]);

    // Confirm the booking
    act(() => {
      result.current.setBookings([booking]);
    });

    // Both should now match
    expect(result.current.bookings).toContainEqual(booking);
  });
});
```

### 3. Rollback Scenario Testing

#### Pattern: Testing Rollback Mechanisms

```typescript
describe("Rollback Scenarios", () => {
  it("should rollback on server rejection", async () => {
    const store = createBookingStore();
    const queryClient = new QueryClient();

    // Set initial state
    const originalBooking = bookingFactory.build({ status: "pending" });
    store.setState({ bookings: [originalBooking] });
    queryClient.setQueryData(["bookings"], [originalBooking]);

    // Mock server rejection
    mockBookingService.updateBooking.mockRejectedValue(
      new Error("Booking conflict")
    );

    const { result } = renderHook(() => useUpdateBookingWithRollback(), {
      wrapper: createIntegrationWrapper({ store, queryClient }),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: originalBooking.id,
          status: "confirmed",
        });
      } catch (error) {
        // Expected error
      }
    });

    // Should rollback to original state
    expect(store.getState().bookings[0].status).toBe("pending");
    expect(queryClient.getQueryData(["bookings"])[0].status).toBe("pending");
  });

  it("should handle partial rollback", async () => {
    const store = createBookingStore();

    const bookings = bookingFactory.buildList(3);
    store.setState({ bookings });

    // Simulate partial failure
    mockBookingService.batchUpdate.mockImplementation(async (updates) => {
      const results = await Promise.allSettled(
        updates.map((update, index) =>
          index === 1
            ? Promise.reject(new Error("Update failed"))
            : Promise.resolve(update)
        )
      );
      return results;
    });

    const { result } = renderHook(() => useBatchUpdateWithPartialRollback(), {
      wrapper: createStoreWrapper({ store }),
    });

    const updates = bookings.map((b) => ({
      id: b.id,
      status: "confirmed" as const,
    }));

    await act(async () => {
      await result.current.mutateAsync(updates);
    });

    const finalBookings = store.getState().bookings;
    expect(finalBookings[0].status).toBe("confirmed");
    expect(finalBookings[1].status).toBe(bookings[1].status); // Rolled back
    expect(finalBookings[2].status).toBe("confirmed");
  });
});
```

### 4. Conflict Resolution Testing

#### Pattern: Testing Conflict Resolution

```typescript
describe("Conflict Resolution", () => {
  it("should detect and resolve version conflicts", async () => {
    const store = createBookingStore();

    const booking = bookingFactory.build({
      version: 1,
      status: "pending",
    });
    store.setState({ bookings: [booking] });

    // Simulate concurrent update from another client
    mockBookingService.updateBooking.mockImplementation(async (id, updates) => {
      // Server has newer version
      throw new ConflictError("Version mismatch", {
        serverVersion: 2,
        serverData: { ...booking, version: 2, status: "processing" },
      });
    });

    const { result } = renderHook(() => useBookingWithConflictResolution(), {
      wrapper: createStoreWrapper({ store }),
    });

    await act(async () => {
      await result.current.updateWithConflictResolution(booking.id, {
        status: "confirmed",
      });
    });

    // Should have resolved conflict
    expect(result.current.conflictResolved).toBe(true);
    expect(store.getState().bookings[0].version).toBe(2);
  });

  it("should handle merge strategies", async () => {
    const resolver = createConflictResolver({
      strategy: "merge",
      fields: ["notes", "tags"],
    });

    const local = {
      id: "1",
      notes: "Local note",
      tags: ["local"],
      status: "pending",
    };

    const remote = {
      id: "1",
      notes: "Remote note",
      tags: ["remote"],
      status: "confirmed",
    };

    const merged = resolver.resolve(local, remote);

    expect(merged).toEqual({
      id: "1",
      notes: "Local note\nRemote note", // Merged
      tags: ["local", "remote"], // Combined
      status: "confirmed", // Remote wins for non-merge fields
    });
  });
});
```

### 5. Real-time Updates Testing

#### Pattern: Testing Real-time Synchronization

```typescript
describe("Real-time Updates", () => {
  it("should sync updates across tabs", async () => {
    const store = createBookingStore();

    // Simulate broadcast channel message
    const channel = new BroadcastChannel("booking-updates");

    const { result } = renderHook(() => useRealtimeBookings(), {
      wrapper: createStoreWrapper({ store }),
    });

    const update = {
      type: "BOOKING_UPDATED",
      payload: bookingFactory.build(),
    };

    act(() => {
      channel.postMessage(update);
    });

    await waitFor(() => {
      expect(store.getState().bookings).toContainEqual(update.payload);
    });

    channel.close();
  });

  it("should handle WebSocket updates", async () => {
    const mockSocket = createMockWebSocket();
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useWebSocketBookings(mockSocket), {
      wrapper: createQueryWrapper({ queryClient }),
    });

    // Simulate incoming message
    act(() => {
      mockSocket.simulateMessage({
        type: "booking:created",
        data: bookingFactory.build(),
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(["bookings"]);
      expect(cached).toContainEqual(
        expect.objectContaining({ id: expect.any(String) })
      );
    });
  });
});
```

### 6. Offline Queue Testing

#### Pattern: Testing Offline Queue

```typescript
describe("Offline Queue", () => {
  it("should queue mutations when offline", async () => {
    const store = createOfflineStore();

    // Go offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const { result } = renderHook(() => useOfflineBooking(), {
      wrapper: createStoreWrapper({ store }),
    });

    const booking = bookingFactory.build();

    await act(async () => {
      await result.current.createBooking(booking);
    });

    // Should be queued
    expect(store.getState().offlineQueue).toContainEqual(
      expect.objectContaining({
        type: "CREATE_BOOKING",
        payload: booking,
        timestamp: expect.any(Number),
      })
    );

    // Should show optimistic update
    expect(store.getState().optimisticBookings).toContainEqual(booking);
  });

  it("should process queue when coming online", async () => {
    const store = createOfflineStore();
    const queryClient = new QueryClient();

    // Start offline with queued items
    store.setState({
      offlineQueue: [
        { type: "CREATE_BOOKING", payload: bookingFactory.build(), id: "1" },
        {
          type: "UPDATE_BOOKING",
          payload: { id: "2", status: "confirmed" },
          id: "2",
        },
      ],
    });

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createIntegrationWrapper({ store, queryClient }),
    });

    // Go online
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(store.getState().offlineQueue).toEqual([]);
    });

    // Verify API calls
    expect(mockBookingService.createBooking).toHaveBeenCalledTimes(1);
    expect(mockBookingService.updateBooking).toHaveBeenCalledTimes(1);
  });
});
```

## Phase-Specific Patterns

### Phase 1: Authentication State Management Tests

#### Pattern: Auth State Testing

```typescript
describe("Phase 1: Auth State Management", () => {
  it("should handle login flow with token persistence", async () => {
    const store = createAuthStore();

    const { result } = renderHook(() => useAuth(), {
      wrapper: createStoreWrapper({ store }),
    });

    await act(async () => {
      await result.current.login("user@test.com", "password");
    });

    expect(store.getState()).toMatchObject({
      isAuthenticated: true,
      user: expect.objectContaining({ email: "user@test.com" }),
      token: expect.any(String),
    });

    // Token should be persisted
    expect(localStorage.getItem("auth-token")).toBeTruthy();
  });

  it("should handle session refresh", async () => {
    jest.useFakeTimers();
    const store = createAuthStore();

    // Set initial auth state
    store.setState({
      token: "initial-token",
      tokenExpiry: Date.now() + 3600000, // 1 hour
    });

    const { result } = renderHook(() => useSessionRefresh(), {
      wrapper: createStoreWrapper({ store }),
    });

    // Advance time to near expiry
    act(() => {
      jest.advanceTimersByTime(3300000); // 55 minutes
    });

    await waitFor(() => {
      expect(mockAuthService.refreshToken).toHaveBeenCalled();
    });

    expect(store.getState().token).not.toBe("initial-token");

    jest.useRealTimers();
  });

  it("should clear state on logout", async () => {
    const store = createAuthStore();
    const queryClient = new QueryClient();

    // Set authenticated state
    store.setState({
      isAuthenticated: true,
      user: userFactory.build(),
      token: "auth-token",
    });

    // Set cached queries
    queryClient.setQueryData(["user-data"], { data: "sensitive" });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createIntegrationWrapper({ store, queryClient }),
    });

    act(() => {
      result.current.logout();
    });

    // Auth state cleared
    expect(store.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
      token: null,
    });

    // Local storage cleared
    expect(localStorage.getItem("auth-token")).toBeNull();

    // Query cache cleared
    expect(queryClient.getQueryData(["user-data"])).toBeUndefined();
  });
});
```

### Phase 2: Dashboard Metrics State Tests

#### Pattern: Metrics Aggregation Testing

```typescript
describe("Phase 2: Dashboard Metrics State", () => {
  it("should aggregate metrics from multiple sources", async () => {
    const store = createDashboardStore();

    const { result } = renderHook(() => useDashboardMetrics(), {
      wrapper: createStoreWrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toMatchObject({
      totalBookings: expect.any(Number),
      occupancyRate: expect.any(Number),
      revenue: expect.any(Number),
      averageStayLength: expect.any(Number),
    });
  });

  it("should update metrics in real-time", async () => {
    const store = createDashboardStore();
    const mockSocket = createMockWebSocket();

    const { result } = renderHook(() => useRealtimeDashboard(mockSocket), {
      wrapper: createStoreWrapper({ store }),
    });

    const initialRevenue = result.current.metrics.revenue;

    // Simulate real-time update
    act(() => {
      mockSocket.simulateMessage({
        type: "metrics:update",
        data: { revenue: initialRevenue + 1000 },
      });
    });

    await waitFor(() => {
      expect(result.current.metrics.revenue).toBe(initialRevenue + 1000);
    });
  });

  it("should cache computed metrics", () => {
    const store = createDashboardStore();

    store.setState({
      bookings: bookingFactory.buildList(10),
      lastComputedAt: Date.now() - 1000,
    });

    const selector = store.getState().getComputedMetrics;

    // First call computes
    const metrics1 = selector();

    // Second call returns cached
    const metrics2 = selector();

    expect(metrics1).toBe(metrics2); // Same reference
  });
});
```

### Phase 3: Booking State and Cache Tests

#### Pattern: Complex Booking State Testing

```typescript
describe("Phase 3: Booking State and Cache", () => {
  it("should manage booking availability state", async () => {
    const store = createBookingStore();

    const { result } = renderHook(
      () => useBookingAvailability("2024-01-01", "2024-01-07"),
      { wrapper: createStoreWrapper({ store }) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.availability).toMatchObject({
      available: expect.any(Boolean),
      conflicts: expect.any(Array),
      suggestions: expect.any(Array),
    });
  });

  it("should handle complex booking rules", async () => {
    const validator = createBookingValidator({
      minStay: 2,
      maxStay: 30,
      advanceBooking: 180,
      blackoutDates: ["2024-12-25", "2024-12-31"],
    });

    const booking = bookingFactory.build({
      checkIn: "2024-12-24",
      checkOut: "2024-12-26",
    });

    const result = validator.validate(booking);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: "checkOut",
        message: expect.stringContaining("blackout"),
      })
    );
  });

  it("should optimize calendar state updates", async () => {
    const store = createCalendarStore();

    const { result } = renderHook(() => useCalendarOptimized(), {
      wrapper: createStoreWrapper({ store }),
    });

    const renderSpy = jest.fn();

    // Subscribe to specific month only
    result.current.subscribeToMonth("2024-01", renderSpy);

    // Update different month
    act(() => {
      store.getState().updateBooking("2024-02-15", bookingFactory.build());
    });

    expect(renderSpy).not.toHaveBeenCalled();

    // Update subscribed month
    act(() => {
      store.getState().updateBooking("2024-01-15", bookingFactory.build());
    });

    expect(renderSpy).toHaveBeenCalled();
  });
});
```

### Phase 4: Financial State Aggregation Tests

#### Pattern: Financial Calculations Testing

```typescript
describe("Phase 4: Financial State Aggregation", () => {
  it("should calculate financial totals accurately", async () => {
    const store = createFinancialStore();

    const expenses = expenseFactory.buildList(5, {
      amount: 100,
      status: "approved",
    });

    const bookings = bookingFactory.buildList(3, {
      totalAmount: 500,
      status: "confirmed",
    });

    store.setState({ expenses, bookings });

    const { result } = renderHook(() => useFinancialSummary(), {
      wrapper: createStoreWrapper({ store }),
    });

    expect(result.current.summary).toEqual({
      totalExpenses: 500,
      totalIncome: 1500,
      netProfit: 1000,
      profitMargin: 66.67,
    });
  });

  it("should handle multi-currency calculations", async () => {
    const store = createFinancialStore();

    store.setState({
      expenses: [
        expenseFactory.build({ amount: 100, currency: "USD" }),
        expenseFactory.build({ amount: 100, currency: "EUR" }),
      ],
      exchangeRates: {
        EUR: 1.1, // 1 EUR = 1.1 USD
      },
    });

    const { result } = renderHook(() => useNormalizedFinancials(), {
      wrapper: createStoreWrapper({ store }),
    });

    expect(result.current.totalExpensesUSD).toBe(210); // 100 + (100 * 1.1)
  });

  it("should aggregate by time periods", async () => {
    const store = createFinancialStore();

    const { result } = renderHook(() => useFinancialsByPeriod("monthly"), {
      wrapper: createStoreWrapper({ store }),
    });

    expect(result.current.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          period: "2024-01",
          income: expect.any(Number),
          expenses: expect.any(Number),
          profit: expect.any(Number),
        }),
      ])
    );
  });
});
```

### Phase 5: Performance State Monitoring Tests

#### Pattern: Performance Monitoring Testing

```typescript
describe("Phase 5: Performance State Monitoring", () => {
  it("should track render performance", async () => {
    const store = createPerformanceStore();

    const { result } = renderHook(() => usePerformanceMonitor(), {
      wrapper: createStoreWrapper({ store }),
    });

    // Simulate component render
    act(() => {
      result.current.startMeasure("BookingList");
    });

    // Simulate render completion
    act(() => {
      result.current.endMeasure("BookingList");
    });

    expect(store.getState().measurements).toContainEqual(
      expect.objectContaining({
        component: "BookingList",
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      })
    );
  });

  it("should detect performance regressions", async () => {
    const monitor = createPerformanceMonitor({
      thresholds: {
        BookingList: 100, // ms
        Dashboard: 200,
      },
    });

    const violation = monitor.measure("BookingList", () => {
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 150) {
        // Busy wait
      }
    });

    expect(violation).toMatchObject({
      component: "BookingList",
      threshold: 100,
      actual: expect.any(Number),
      exceeded: true,
    });
  });

  it("should track bundle size impact", async () => {
    const tracker = createBundleSizeTracker();

    // Before adding heavy dependency
    const initialSize = await tracker.measure();

    // Import heavy component
    const HeavyComponent = await import("./HeavyComponent");

    const newSize = await tracker.measure();

    expect(newSize.totalSize).toBeGreaterThan(initialSize.totalSize);
    expect(tracker.getImpact()).toMatchObject({
      increase: expect.any(Number),
      percentage: expect.any(Number),
    });
  });
});
```

## Test Utilities and Helpers

### Query Wrapper Creator

```typescript
export function createQueryWrapper(options?: {
  queryClient?: QueryClient;
  defaultOptions?: DefaultOptions;
}) {
  const queryClient = options?.queryClient || new QueryClient({
    defaultOptions: options?.defaultOptions || {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Store Wrapper Creator

```typescript
export function createStoreWrapper(options: {
  store: any;
  initialState?: any;
}) {
  if (options.initialState) {
    options.store.setState(options.initialState);
  }

  return ({ children }: { children: React.ReactNode }) => (
    <StoreProvider store={options.store}>
      {children}
    </StoreProvider>
  );
}
```

### Integration Wrapper Creator

```typescript
export function createIntegrationWrapper(options: {
  store: any;
  queryClient: QueryClient;
  mockServices?: MockServiceRegistry;
}) {
  const queryClient = options.queryClient;
  const store = options.store;

  // Set up service mocks
  if (options.mockServices) {
    mockServiceRegistry.registerAll(options.mockServices);
  }

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <StoreProvider store={store}>
        {children}
      </StoreProvider>
    </QueryClientProvider>
  );
}
```

### Mock WebSocket Creator

```typescript
export function createMockWebSocket() {
  const listeners: Map<string, Set<Function>> = new Map();

  return {
    on(event: string, handler: Function) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    },

    off(event: string, handler: Function) {
      listeners.get(event)?.delete(handler);
    },

    simulateMessage(data: any) {
      listeners.get("message")?.forEach((handler) => handler(data));
    },

    simulateError(error: Error) {
      listeners.get("error")?.forEach((handler) => handler(error));
    },

    simulateClose() {
      listeners.get("close")?.forEach((handler) => handler());
    },

    close() {
      this.simulateClose();
      listeners.clear();
    },
  };
}
```

### State Change Tracker

```typescript
export function createStateTracker<T>() {
  const changes: T[] = [];
  let unsubscribe: (() => void) | null = null;

  return {
    track(store: any, selector?: (state: any) => T) {
      unsubscribe = store.subscribe((state: any) => {
        changes.push(selector ? selector(state) : state);
      });
    },

    getChanges() {
      return [...changes];
    },

    clear() {
      changes.length = 0;
    },

    stop() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
```

### Test Data Factories Integration

```typescript
// Integrate with existing factories
export const stateTestFactories = {
  booking: bookingFactory,
  expense: expenseFactory,
  user: userFactory,
  payment: paymentFactory,

  // State-specific factories
  authState: Factory.define<AuthState>(() => ({
    isAuthenticated: false,
    user: null,
    token: null,
    tokenExpiry: null,
    isLoading: false,
    error: null,
  })),

  bookingState: Factory.define<BookingState>(() => ({
    bookings: [],
    selectedBooking: null,
    filters: defaultFilters,
    isLoading: false,
    error: null,
    optimisticBookings: [],
  })),

  queryState: Factory.define<QueryState>(() => ({
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
  })),
};
```

## Testing Best Practices

### 1. State Isolation

- Always reset stores between tests
- Clear query cache after each test
- Reset mock service state
- Clean up subscriptions

### 2. Async Testing

- Use `waitFor` for async state updates
- Wrap state changes in `act`
- Handle promise rejections properly
- Use fake timers for time-dependent tests

### 3. Mock Strategy

- Mock at service layer, not HTTP layer
- Use consistent mock data factories
- Provide deterministic responses
- Test both success and failure paths

### 4. Performance Testing

- Monitor re-render counts
- Test selector memoization
- Verify subscription efficiency
- Check for memory leaks

### 5. Integration Testing

- Test complete user flows
- Verify state synchronization
- Test error recovery
- Validate optimistic updates

## References

- [TDD_SINGLE_SOURCE_OF_TRUTH.md](./TDD_SINGLE_SOURCE_OF_TRUTH.md)
- [Mock Service Architecture](../implementation/Mock_API_Architecture.md)
- [Test Data Factories](../test/factories/index.ts)
- [Environment Configuration](../config/environment.ts)

## Conclusion

These patterns provide comprehensive coverage for testing state management with
Zustand and TanStack Query. They ensure reliable, maintainable tests that
validate both individual components and integrated systems, supporting the TDD
approach throughout all development phases.
