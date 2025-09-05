import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Use existing test utilities
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";

// Import the implemented services and hooks
import { usePolling } from "../../hooks/usePolling";
import { PollingService } from "../../services/PollingService";
import type { PollingConfig, PollingState } from "../../types/polling";

describe("PollingService and usePolling Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Basic Polling (5 tests)", () => {
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

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(3);
      });
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

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });

      rerender({ enabled: false });

      const callCount = fetchFn.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(2000);
      });

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

      // Wait for retries
      for (let i = 0; i < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(500);
        });
        await waitFor(() => {});
      }

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: "success" });
      });

      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should support immediate execution", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 5000,
          immediate: true,
        })
      );

      // Should execute immediately without waiting
      expect(fetchFn).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });
    });

    it("should cleanup on unmount", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
      const cleanupSpy = vi.fn();

      const { result, unmount } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 1000,
          onCleanup: cleanupSpy,
        })
      );

      expect(fetchFn).toHaveBeenCalledTimes(1);

      unmount();

      expect(cleanupSpy).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should not poll after unmount
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Adaptive Polling (5 tests)", () => {
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

      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

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
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await waitFor(() => {
        expect(result.current.currentInterval).toBeGreaterThan(1000);
      });

      // Return to active state
      Object.defineProperty(document, "hidden", {
        writable: true,
        value: false,
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

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

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.currentInterval).toBeGreaterThan(1000);
      });

      // Simulate fast network
      Object.defineProperty(navigator, "connection", {
        writable: true,
        value: {
          effectiveType: "4g",
          saveData: false,
        },
      });

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.currentInterval).toBe(1000);
      });
    });

    it("should implement exponential backoff on consecutive errors", async () => {
      const intervals: number[] = [];
      const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          baseInterval: 1000,
          adaptive: true,
          onIntervalChange: (interval) => intervals.push(interval),
        })
      );

      // First error
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Second error - interval should increase
      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Third error - interval should increase more
      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(3);
      });

      // Verify exponential backoff
      expect(intervals[1]).toBeGreaterThan(intervals[0]);
      expect(intervals[2]).toBeGreaterThan(intervals[1]);
    });

    it("should respect user preferences for data saving", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          baseInterval: 1000,
          respectDataSaver: true,
        })
      );

      // Enable data saver mode
      Object.defineProperty(navigator, "connection", {
        writable: true,
        value: {
          saveData: true,
        },
      });

      await waitFor(() => {
        // Should increase interval or pause when data saver is on
        expect(result.current.isPaused || result.current.currentInterval > 1000).toBe(true);
      });
    });
  });

  describe("Smart Polling (5 tests)", () => {
    it("should skip polling if data has not changed", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({ data: "test", hash: "abc123" })
        .mockResolvedValueOnce({ data: "test", hash: "abc123" })
        .mockResolvedValueOnce({ data: "updated", hash: "xyz789" });

      const onDataChange = vi.fn();

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 500,
          compareHash: true,
          onDataChange,
        })
      );

      // Initial fetch
      expect(onDataChange).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
        // Data unchanged, so onDataChange not called again
        expect(onDataChange).toHaveBeenCalledTimes(1);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(3);
        // Data changed, so onDataChange called
        expect(onDataChange).toHaveBeenCalledTimes(2);
      });
    });

    it("should use ETag for conditional requests", async () => {
      const fetchFn = vi.fn().mockImplementation((options) => {
        if (options?.headers?.["If-None-Match"] === 'W/"123"') {
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

      // First fetch gets data and ETag
      await waitFor(() => {
        expect(result.current.data).toEqual({
          data: "test",
          headers: { etag: 'W/"123"' },
        });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Second fetch should include ETag
      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });

      expect(fetchFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-None-Match": 'W/"123"',
          }),
        })
      );
    });

    it("should support custom comparison functions", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({ value: 100, timestamp: Date.now() })
        .mockResolvedValueOnce({ value: 100, timestamp: Date.now() + 1000 })
        .mockResolvedValueOnce({ value: 101, timestamp: Date.now() + 2000 });

      const onDataChange = vi.fn();
      const customCompare = (prev: any, next: any) => prev.value === next.value;

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 500,
          compareFunction: customCompare,
          onDataChange,
        })
      );

      expect(onDataChange).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        // Same value, different timestamp - should not trigger change
        expect(onDataChange).toHaveBeenCalledTimes(1);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        // Different value - should trigger change
        expect(onDataChange).toHaveBeenCalledTimes(2);
      });
    });

    it("should implement jitter to prevent thundering herd", async () => {
      const fetchTimes: number[] = [];
      const fetchFn = vi.fn().mockImplementation(() => {
        fetchTimes.push(Date.now());
        return Promise.resolve({ data: "test" });
      });

      // Create multiple polling instances
      const hooks = Array.from({ length: 5 }, () =>
        renderHook(() =>
          usePolling({
            queryFn: fetchFn,
            interval: 1000,
            jitter: true,
          })
        )
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(10); // 5 initial + 5 after interval
      });

      // Check that fetch times are spread out (jittered)
      const secondFetchTimes = fetchTimes.slice(5);
      const uniqueTimes = new Set(secondFetchTimes);

      // With jitter, not all requests should happen at exactly the same time
      expect(uniqueTimes.size).toBeGreaterThan(1);

      // Cleanup
      hooks.forEach((hook) => hook.unmount());
    });

    it("should fallback from WebSocket to polling", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
      const wsUrl = "ws://localhost:8080";

      const { result } = renderHook(() =>
        usePolling({
          queryFn: fetchFn,
          interval: 1000,
          enabled: false, // Initially disabled
          websocketUrl: wsUrl,
          fallbackEnabled: true,
        })
      );

      // Initially, polling should be disabled
      expect(fetchFn).not.toHaveBeenCalled();
      expect(result.current.isPolling).toBe(false);

      // Simulate WebSocket disconnection
      act(() => {
        window.dispatchEvent(
          new CustomEvent("websocket:disconnected", {
            detail: { url: wsUrl },
          })
        );
      });

      // Polling should automatically start as fallback
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
        expect(fetchFn).toHaveBeenCalled();
      });

      // Simulate WebSocket reconnection
      act(() => {
        window.dispatchEvent(
          new CustomEvent("websocket:connected", {
            detail: { url: wsUrl },
          })
        );
      });

      // Polling should stop
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });
  });
});
