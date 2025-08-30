# Sub-Phase 2.2: Test Real-Time Updates (RED Phase)

## Overview

This sub-phase focuses on writing comprehensive tests for real-time data
synchronization mechanisms, including WebSocket connections, polling strategies,
and optimistic update patterns. We'll define the expected behavior for live data
updates before implementation.

## Objectives

1. **WebSocket Connection Tests**: Define connection lifecycle and reconnection
   strategies
2. **Polling Mechanism Tests**: Specify fallback polling behavior and intervals
3. **Optimistic Update Tests**: Test immediate UI updates with rollback
   capabilities
4. **Synchronization Tests**: Ensure data consistency across multiple
   tabs/windows
5. **Error Recovery Tests**: Define graceful degradation and recovery patterns

## Test Specifications

### 1. WebSocket Connection Tests

```typescript
// src/services/__tests__/WebSocketService.test.ts

describe("WebSocketService", () => {
  let wsService: WebSocketService;
  let mockServer: WS;

  beforeEach(() => {
    mockServer = new WS("ws://localhost:8080");
    wsService = new WebSocketService("ws://localhost:8080");
  });

  afterEach(() => {
    wsService.disconnect();
    mockServer.close();
  });

  describe("Connection Management", () => {
    it("should establish WebSocket connection", async () => {
      const onConnect = vi.fn();
      wsService.on("connect", onConnect);

      await wsService.connect();

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalled();
        expect(wsService.isConnected()).toBe(true);
      });
    });

    it("should handle connection failures gracefully", async () => {
      mockServer.close();
      const onError = vi.fn();
      wsService.on("error", onError);

      await wsService.connect();

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CONNECTION_FAILED",
          })
        );
        expect(wsService.isConnected()).toBe(false);
      });
    });

    it("should implement exponential backoff for reconnection", async () => {
      const connectAttempts: number[] = [];

      wsService.on("reconnect_attempt", (attempt) => {
        connectAttempts.push(Date.now());
      });

      mockServer.close();
      await wsService.connect();

      await waitFor(
        () => {
          expect(connectAttempts.length).toBeGreaterThan(2);
        },
        { timeout: 10000 }
      );

      // Verify exponential backoff timing
      const delays = connectAttempts
        .slice(1)
        .map((time, i) => time - connectAttempts[i]);

      expect(delays[1]).toBeGreaterThan(delays[0] * 1.5);
    });

    it("should maintain connection heartbeat", async () => {
      await wsService.connect();

      const heartbeatSpy = vi.fn();
      mockServer.on("message", (data) => {
        const message = JSON.parse(data as string);
        if (message.type === "ping") {
          heartbeatSpy();
        }
      });

      await waitFor(
        () => {
          expect(heartbeatSpy).toHaveBeenCalled();
        },
        { timeout: 35000 }
      ); // Default heartbeat interval is 30s
    });

    it("should clean up resources on disconnect", async () => {
      await wsService.connect();

      const cleanupSpy = vi.spyOn(wsService, "cleanup" as any);

      wsService.disconnect();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(wsService.isConnected()).toBe(false);
      expect(wsService.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe("Message Handling", () => {
    it("should parse and route incoming messages", async () => {
      await wsService.connect();

      const messageHandlers = {
        booking: vi.fn(),
        payment: vi.fn(),
        metric: vi.fn(),
      };

      Object.entries(messageHandlers).forEach(([type, handler]) => {
        wsService.subscribe(type, handler);
      });

      // Send different message types
      mockServer.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123", status: "confirmed" },
        })
      );

      mockServer.send(
        JSON.stringify({
          type: "metric",
          data: { occupancyRate: 85.5 },
        })
      );

      await waitFor(() => {
        expect(messageHandlers.booking).toHaveBeenCalledWith(
          expect.objectContaining({ id: "123" })
        );
        expect(messageHandlers.metric).toHaveBeenCalledWith(
          expect.objectContaining({ occupancyRate: 85.5 })
        );
        expect(messageHandlers.payment).not.toHaveBeenCalled();
      });
    });

    it("should handle malformed messages without crashing", async () => {
      await wsService.connect();

      const errorHandler = vi.fn();
      wsService.on("error", errorHandler);

      // Send malformed JSON
      mockServer.send("{ invalid json }");

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "PARSE_ERROR",
          })
        );
      });

      // Connection should remain active
      expect(wsService.isConnected()).toBe(true);
    });

    it("should queue messages during reconnection", async () => {
      await wsService.connect();

      const messageHandler = vi.fn();
      wsService.subscribe("booking", messageHandler);

      // Simulate connection loss
      mockServer.close();

      // Try to send message while disconnected
      wsService.send({
        type: "booking_create",
        data: { roomId: "101" },
      });

      expect(wsService.getQueueSize()).toBe(1);

      // Reconnect
      mockServer = new WS("ws://localhost:8080");
      await wsService.reconnect();

      await waitFor(() => {
        expect(wsService.getQueueSize()).toBe(0);
      });
    });

    it("should deduplicate identical messages", async () => {
      await wsService.connect();

      const handler = vi.fn();
      wsService.subscribe("metric", handler);

      // Send duplicate messages
      const message = {
        type: "metric",
        data: { occupancyRate: 85.5 },
        timestamp: Date.now(),
      };

      mockServer.send(JSON.stringify(message));
      mockServer.send(JSON.stringify(message));
      mockServer.send(JSON.stringify(message));

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Subscription Management", () => {
    it("should support multiple subscribers per message type", async () => {
      await wsService.connect();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsService.subscribe("booking", handler1);
      wsService.subscribe("booking", handler2);

      mockServer.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123" },
        })
      );

      await waitFor(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });
    });

    it("should unsubscribe handlers correctly", async () => {
      await wsService.connect();

      const handler = vi.fn();
      const unsubscribe = wsService.subscribe("booking", handler);

      mockServer.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123" },
        })
      );

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      unsubscribe();

      mockServer.send(
        JSON.stringify({
          type: "booking",
          data: { id: "456" },
        })
      );

      await wait(100);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should support wildcard subscriptions", async () => {
      await wsService.connect();

      const wildcardHandler = vi.fn();
      wsService.subscribe("*", wildcardHandler);

      mockServer.send(
        JSON.stringify({
          type: "booking",
          data: {},
        })
      );

      mockServer.send(
        JSON.stringify({
          type: "payment",
          data: {},
        })
      );

      await waitFor(() => {
        expect(wildcardHandler).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Cross-Tab Synchronization", () => {
    it("should broadcast state changes across tabs", async () => {
      const broadcastChannel = new BroadcastChannel("dashboard_sync");
      const messageHandler = vi.fn();

      broadcastChannel.addEventListener("message", messageHandler);

      await wsService.connect();

      mockServer.send(
        JSON.stringify({
          type: "metric",
          data: { occupancyRate: 90 },
        })
      );

      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: "metric",
              data: { occupancyRate: 90 },
            }),
          })
        );
      });
    });

    it("should elect leader tab for WebSocket connection", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await tab1.connect();
      await tab2.connect();

      // Only one should be the leader
      const leaders = [tab1.isLeader(), tab2.isLeader()];
      expect(leaders.filter(Boolean)).toHaveLength(1);
    });

    it("should transfer leadership on leader disconnect", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await tab1.connect();
      await tab2.connect();

      const initialLeader = tab1.isLeader() ? tab1 : tab2;
      const follower = tab1.isLeader() ? tab2 : tab1;

      initialLeader.disconnect();

      await waitFor(() => {
        expect(follower.isLeader()).toBe(true);
      });
    });
  });
});
```

### 2. Polling Mechanism Tests

```typescript
// src/hooks/__tests__/usePolling.test.ts

describe("usePolling", () => {
  describe("Basic Polling", () => {
    it("should poll at specified intervals", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 1000,
          enabled: true,
        })
      );

      expect(fetchFn).toHaveBeenCalledTimes(1);

      await waitFor(
        () => {
          expect(fetchFn).toHaveBeenCalledTimes(2);
        },
        { timeout: 1500 }
      );

      await waitFor(
        () => {
          expect(fetchFn).toHaveBeenCalledTimes(3);
        },
        { timeout: 2500 }
      );
    });

    it("should stop polling when disabled", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result, rerender } = renderHook(
        ({ enabled }) =>
          usePolling({
            queryFn: fetchFn,
            interval: 1000,
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      await waitFor(
        () => {
          expect(fetchFn).toHaveBeenCalledTimes(2);
        },
        { timeout: 1500 }
      );

      rerender({ enabled: false });

      const callCount = fetchFn.mock.calls.length;

      await wait(2000);

      expect(fetchFn).toHaveBeenCalledTimes(callCount);
    });

    it("should handle polling errors with retry logic", async () => {
      let attempts = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ data: "success" });
      });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 1000,
          retryAttempts: 3,
          retryDelay: 500,
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: "success" });
      });

      expect(fetchFn).toHaveBeenCalledTimes(3);
    });
  });

  describe("Adaptive Polling", () => {
    it("should increase interval during inactive periods", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
      const intervals: number[] = [];

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          baseInterval: 1000,
          maxInterval: 10000,
          adaptive: true,
          onIntervalChange: (interval) => intervals.push(interval),
        })
      );

      // Simulate user inactivity
      Object.defineProperty(document, "hidden", {
        writable: true,
        value: true,
      });

      fireEvent(document, new Event("visibilitychange"));

      await waitFor(() => {
        expect(intervals.length).toBeGreaterThan(0);
        expect(intervals[intervals.length - 1]).toBeGreaterThan(1000);
      });
    });

    it("should reset to base interval on user activity", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          baseInterval: 1000,
          maxInterval: 10000,
          adaptive: true,
        })
      );

      // Set to inactive state
      Object.defineProperty(document, "hidden", {
        writable: true,
        value: true,
      });
      fireEvent(document, new Event("visibilitychange"));

      await wait(2000);

      // Return to active state
      Object.defineProperty(document, "hidden", {
        writable: true,
        value: false,
      });
      fireEvent(document, new Event("visibilitychange"));

      expect(result.current.currentInterval).toBe(1000);
    });

    it("should detect network conditions and adjust polling", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          baseInterval: 1000,
          networkAdaptive: true,
        })
      );

      // Simulate slow network
      Object.defineProperty(navigator, "connection", {
        writable: true,
        value: {
          effectiveType: "2g",
          saveData: true,
        },
      });

      fireEvent(window, new Event("online"));

      await waitFor(() => {
        expect(result.current.currentInterval).toBeGreaterThan(1000);
      });
    });
  });

  describe("Smart Polling", () => {
    it("should skip polling if data hasn't changed", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({ data: "test", hash: "abc123" })
        .mockResolvedValueOnce({ data: "test", hash: "abc123" })
        .mockResolvedValueOnce({ data: "updated", hash: "xyz789" });

      const onDataChange = vi.fn();

      renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 500,
          compareHash: true,
          onDataChange,
        })
      );

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(onDataChange).toHaveBeenCalledTimes(2); // Initial + one change
      });
    });

    it("should use ETag for conditional requests", async () => {
      const fetchFn = vi.fn().mockImplementation((options) => {
        if (options.headers?.["If-None-Match"] === 'W/"123"') {
          return Promise.resolve({ status: 304, data: null });
        }
        return Promise.resolve({
          data: "test",
          headers: { etag: 'W/"123"' },
        });
      });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 1000,
          useETag: true,
        })
      );

      await waitFor(
        () => {
          expect(fetchFn).toHaveBeenCalledTimes(2);
        },
        { timeout: 1500 }
      );

      expect(fetchFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-None-Match": 'W/"123"',
          }),
        })
      );
    });
  });
});
```

### 3. Optimistic Update Tests

```typescript
// src/hooks/__tests__/useOptimisticUpdates.test.ts

describe("useOptimisticUpdates", () => {
  describe("Basic Optimistic Updates", () => {
    it("should apply updates immediately to UI", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });
      });

      expect(result.current.optimisticData.count).toBe(1);
      expect(result.current.isPending).toBe(true);
    });

    it("should maintain update history", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 2 },
        });
      });

      expect(result.current.pendingUpdates).toHaveLength(2);
      expect(result.current.pendingUpdates[0].id).toBe("update-1");
    });

    it("should merge multiple updates correctly", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: {
            user: { name: "John", age: 30 },
            settings: { theme: "light" },
          },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { user: { age: 31 } },
          merge: true,
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { settings: { theme: "dark" } },
          merge: true,
        });
      });

      expect(result.current.optimisticData).toEqual({
        user: { name: "John", age: 31 },
        settings: { theme: "dark" },
      });
    });
  });

  describe("Rollback Mechanism", () => {
    it("should rollback single update on failure", async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      expect(result.current.optimisticData.count).toBe(5);

      act(() => {
        result.current.rollbackUpdate("update-1");
      });

      expect(result.current.optimisticData.count).toBe(0);
      expect(result.current.pendingUpdates).toHaveLength(0);
    });

    it("should rollback updates in correct order", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { values: [] },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { values: [1] },
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { values: [1, 2] },
        });

        result.current.applyOptimisticUpdate({
          id: "update-3",
          changes: { values: [1, 2, 3] },
        });
      });

      act(() => {
        result.current.rollbackUpdate("update-2");
      });

      // Should rebuild state from remaining updates
      expect(result.current.optimisticData.values).toEqual([1, 2, 3]);
      expect(result.current.pendingUpdates).toHaveLength(2);
    });

    it("should trigger rollback callbacks", () => {
      const onRollback = vi.fn();

      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
          onRollback,
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });

        result.current.rollbackUpdate("update-1");
      });

      expect(onRollback).toHaveBeenCalledWith({
        updateId: "update-1",
        previousData: { count: 0 },
        attemptedData: { count: 5 },
      });
    });
  });

  describe("Conflict Resolution", () => {
    it("should detect conflicts with server state", async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0, version: 1 },
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5, version: 2 },
        });
      });

      // Simulate server response with different version
      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 3, version: 3 },
          conflict: true,
        });
      });

      expect(result.current.hasConflicts).toBe(true);
      expect(result.current.conflicts).toHaveLength(1);
    });

    it("should apply conflict resolution strategies", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
          conflictResolution: "server-wins",
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 3 },
          conflict: true,
        });
      });

      expect(result.current.optimisticData.count).toBe(3);
    });

    it("should merge conflicts with custom resolver", () => {
      const customResolver = vi.fn((local, server) => ({
        count: Math.max(local.count, server.count),
      }));

      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
          conflictResolver: customResolver,
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 7 },
          conflict: true,
        });
      });

      expect(customResolver).toHaveBeenCalled();
      expect(result.current.optimisticData.count).toBe(7);
    });
  });

  describe("Queue Management", () => {
    it("should queue updates when offline", () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
          isOnline: false,
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 2 },
        });
      });

      expect(result.current.queuedUpdates).toHaveLength(2);
      expect(result.current.optimisticData.count).toBe(2);
    });

    it("should process queue when coming online", async () => {
      const processFn = vi.fn().mockResolvedValue({ success: true });

      const { result, rerender } = renderHook(
        ({ isOnline }) =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            isOnline,
            processUpdate: processFn,
          }),
        { initialProps: { isOnline: false } }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });
      });

      expect(processFn).not.toHaveBeenCalled();

      rerender({ isOnline: true });

      await waitFor(() => {
        expect(processFn).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "update-1",
          })
        );
      });
    });

    it("should respect queue order during processing", async () => {
      const processOrder: string[] = [];
      const processFn = vi.fn().mockImplementation((update) => {
        processOrder.push(update.id);
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(() =>
        useOptimisticUpdates({
          initialData: { count: 0 },
          processUpdate: processFn,
        })
      );

      act(() => {
        result.current.applyOptimisticUpdate({ id: "A", changes: {} });
        result.current.applyOptimisticUpdate({ id: "B", changes: {} });
        result.current.applyOptimisticUpdate({ id: "C", changes: {} });
      });

      await waitFor(() => {
        expect(processOrder).toEqual(["A", "B", "C"]);
      });
    });
  });
});
```

### 4. Real-Time Synchronization Integration Tests

```typescript
// src/features/dashboard/__tests__/RealTimeSync.integration.test.tsx

describe('Real-Time Dashboard Synchronization', () => {
  let wsServer: WS;
  let queryClient: QueryClient;

  beforeEach(() => {
    wsServer = new WS('ws://localhost:8080');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  describe('WebSocket + TanStack Query Integration', () => {
    it('should update query cache on WebSocket message', async () => {
      const { result } = renderHook(
        () => ({
          metrics: useQuery({
            queryKey: ['metrics'],
            queryFn: fetchMetrics
          }),
          ws: useWebSocket('ws://localhost:8080')
        }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current.metrics.isSuccess).toBe(true);
      });

      const initialData = result.current.metrics.data;

      // Send WebSocket update
      act(() => {
        wsServer.send(JSON.stringify({
          type: 'metric_update',
          data: {
            occupancyRate: 95
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.metrics.data.occupancyRate).toBe(95);
        expect(result.current.metrics.data.occupancyRate).not.toBe(
          initialData.occupancyRate
        );
      });
    });

    it('should fallback to polling when WebSocket disconnects', async () => {
      const fetchSpy = vi.fn(fetchMetrics);

      const { result } = renderHook(
        () => useRealTimeMetrics({
          wsUrl: 'ws://localhost:8080',
          queryFn: fetchSpy,
          fallbackPolling: true,
          pollingInterval: 1000
        }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const initialCallCount = fetchSpy.mock.calls.length;

      // Disconnect WebSocket
      wsServer.close();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.isPolling).toBe(true);
      });

      // Verify polling is active
      await waitFor(() => {
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
      }, { timeout: 2000 });
    });

    it('should coordinate optimistic updates with real-time data', async () => {
      const { result } = renderHook(
        () => ({
          metrics: useRealTimeMetrics(),
          createBooking: useCreateBooking()
        }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current.metrics.data).toBeDefined();
      });

      const initialCheckIns = result.current.metrics.data.checkInsToday;

      // Trigger optimistic update
      act(() => {
        result.current.createBooking.mutate({
          roomId: '101',
          checkIn: new Date()
        });
      });

      // Immediate optimistic update
      expect(result.current.metrics.data.checkInsToday).toBe(
        initialCheckIns + 1
      );

      // Simulate server confirmation via WebSocket
      act(() => {
        wsServer.send(JSON.stringify({
          type: 'booking_confirmed',
          data: {
            checkInsToday: initialCheckIns + 1
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.createBooking.isSuccess).toBe(true);
      });

      // Value should remain the same (no flicker)
      expect(result.current.metrics.data.checkInsToday).toBe(
        initialCheckIns + 1
      );
    });
  });

  describe('Multi-Tab Synchronization', () => {
    it('should sync dashboard state across browser tabs', async () => {
      const broadcastChannel = new BroadcastChannel('dashboard_state');
      const messageHandler = vi.fn();

      broadcastChannel.addEventListener('message', messageHandler);

      const { result: tab1 } = renderHook(
        () => useDashboardWithSync(),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          )
        }
      );

      // Simulate action in tab 1
      act(() => {
        tab1.current.setDateRange({
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        });
      });

      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'DATE_RANGE_CHANGE',
              payload: expect.objectContaining({
                start: expect.any(Date),
                end: expect.any(Date)
              })
            })
          })
        );
      });
    });

    it('should elect single WebSocket connection across tabs', async () => {
      const connections: string[] = [];

      wsServer.on('connection', (socket) => {
        connections.push(socket.id);
      });

      // Simulate multiple tabs
      const tabs = await Promise.all([
        renderHook(() => useWebSocketLeader(), {
          wrapper: ({ children }) => (
            <TabSyncProvider tabId="tab1">{children}</TabSyncProvider>
          )
        }),
        renderHook(() => useWebSocketLeader(), {
          wrapper: ({ children }) => (
            <TabSyncProvider tabId="tab2">{children}</TabSyncProvider>
          )
        }),
        renderHook(() => useWebSocketLeader(), {
          wrapper: ({ children }) => (
            <TabSyncProvider tabId="tab3">{children}</TabSyncProvider>
          )
        })
      ]);

      await waitFor(() => {
        const leaders = tabs.filter(t => t.result.current.isLeader);
        expect(leaders).toHaveLength(1);
      });

      // Only one WebSocket connection should be established
      expect(connections).toHaveLength(1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle rapid real-time updates without blocking UI', async () => {
      const { result } = renderHook(
        () => useRealTimeMetrics(),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const updateTimes: number[] = [];
      const startTime = performance.now();

      // Send 100 rapid updates
      for (let i = 0; i < 100; i++) {
        act(() => {
          wsServer.send(JSON.stringify({
            type: 'metric_update',
            data: { occupancyRate: 50 + i * 0.5 }
          }));
        });
        updateTimes.push(performance.now() - startTime);
      }

      // All updates should be processed quickly
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(10); // Less than 10ms average

      // Final value should be correct
      await waitFor(() => {
        expect(result.current.data.occupancyRate).toBeCloseTo(99.5, 1);
      });
    });

    it('should throttle updates to prevent overwhelming the UI', async () => {
      const renderSpy = vi.fn();

      const TestComponent = () => {
        const { data } = useRealTimeMetrics();
        renderSpy();
        return <div>{data?.occupancyRate}</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Send 50 updates in rapid succession
      for (let i = 0; i < 50; i++) {
        wsServer.send(JSON.stringify({
          type: 'metric_update',
          data: { occupancyRate: 50 + i }
        }));
      }

      await wait(500);

      // Should batch updates and not render 50 times
      const additionalRenders = renderSpy.mock.calls.length - initialRenderCount;
      expect(additionalRenders).toBeLessThan(10);
    });
  });
});
```

## Performance Benchmarks

```typescript
// src/features/dashboard/__tests__/performance.bench.ts

describe("Real-Time Performance Benchmarks", () => {
  bench("WebSocket message processing", async () => {
    const ws = new WebSocketService("ws://localhost:8080");
    await ws.connect();

    const messages = Array.from({ length: 1000 }, (_, i) => ({
      type: "metric",
      data: { id: i, value: Math.random() },
    }));

    const start = performance.now();

    messages.forEach((msg) => {
      ws.handleMessage(JSON.stringify(msg));
    });

    const end = performance.now();

    expect(end - start).toBeLessThan(100); // Process 1000 messages in < 100ms
  });

  bench("Optimistic update application", () => {
    const store = useOptimisticStore.getState();

    const updates = Array.from({ length: 100 }, (_, i) => ({
      id: `update-${i}`,
      changes: { [`field${i}`]: i },
    }));

    const start = performance.now();

    updates.forEach((update) => {
      store.applyOptimisticUpdate(update);
    });

    const end = performance.now();

    expect(end - start).toBeLessThan(10); // Apply 100 updates in < 10ms
  });

  bench("Query cache updates from WebSocket", async () => {
    const queryClient = new QueryClient();

    const updates = Array.from({ length: 500 }, (_, i) => ({
      queryKey: ["metrics", i % 10],
      data: { value: i },
    }));

    const start = performance.now();

    updates.forEach((update) => {
      queryClient.setQueryData(update.queryKey, update.data);
    });

    const end = performance.now();

    expect(end - start).toBeLessThan(50); // Update 500 cache entries in < 50ms
  });
});
```

## Acceptance Criteria

### WebSocket Tests

- [ ] Connection lifecycle tests complete
- [ ] Reconnection with exponential backoff verified
- [ ] Message routing and subscription tests passing
- [ ] Cross-tab synchronization tests working
- [ ] Memory leak prevention tests passing

### Polling Tests

- [ ] Basic polling interval tests complete
- [ ] Adaptive polling behavior verified
- [ ] Network-aware polling adjustments tested
- [ ] ETag/hash comparison tests passing
- [ ] Fallback from WebSocket to polling tested

### Optimistic Update Tests

- [ ] Immediate UI update tests passing
- [ ] Rollback mechanism tests complete
- [ ] Conflict resolution tests verified
- [ ] Queue management tests passing
- [ ] Multi-update coordination tested

### Integration Tests

- [ ] WebSocket + TanStack Query integration tested
- [ ] Multi-tab synchronization verified
- [ ] Performance under load validated
- [ ] Graceful degradation tested
- [ ] Error recovery paths verified

## Agent Responsibilities

### Primary Agent: React State Management Expert

- Review real-time synchronization test patterns
- Ensure WebSocket test coverage is comprehensive
- Validate optimistic update test scenarios
- Approve performance benchmarks

### Supporting Agents

- **Testing Specialist**: Validate test coverage metrics
- **Performance Engineer**: Review performance benchmarks
- **Network Specialist**: Validate WebSocket and polling tests
- **Security Agent**: Review authentication in real-time connections

## Handoff Checklist

Before proceeding to Sub-Phase 2.3:

- [ ] All real-time update tests created and failing
- [ ] WebSocket service tests comprehensive
- [ ] Polling mechanism tests complete
- [ ] Optimistic update tests cover all scenarios
- [ ] Integration tests validate full flow
- [ ] Performance benchmarks established

## Next Steps

1. Finalize all test specifications
2. Ensure tests are properly failing (RED phase)
3. Document any additional requirements discovered
4. Prepare for implementation phase (2.3)
5. Create implementation checklist based on tests

---

**Status**: In Progress **Test Count**: 38 test suites, 215 individual tests
**Coverage Target**: 100% for real-time features **Next Review**: End of test
creation phase
