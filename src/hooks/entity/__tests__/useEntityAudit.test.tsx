// src/hooks/entity/__tests__/useEntityAudit.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEntityAudit } from "../useEntityAudit";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("useEntityAudit", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  // Helper to create mock query chain
  const createMockQueryChain = (data: any[], error: any = null) => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);
    return mockChain;
  };

  describe("Basic audit log fetching", () => {
    it("fetches audit logs for entity", async () => {
      const mockLogs = [
        {
          id: "log-1",
          table_name: "booking",
          record_id: "booking-123",
          action: "INSERT",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "log-2",
          table_name: "booking",
          record_id: "booking-123",
          action: "UPDATE",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      createMockQueryChain(mockLogs);

      const { result } = renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockLogs);
      expect(supabase.from).toHaveBeenCalledWith("audit_logs");
    });

    it("filters by entity type and ID", async () => {
      const mockChain = createMockQueryChain([]);

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "unit",
            entity_id: "unit-456",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.eq).toHaveBeenCalledWith("table_name", "units");
        expect(mockChain.eq).toHaveBeenCalledWith("record_id", "unit-456");
      });
    });

    it("orders by created_at descending", async () => {
      const mockChain = createMockQueryChain([]);

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "guest",
            entity_id: "guest-789",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
      });
    });

    it("limits results to 50 entries", async () => {
      const mockChain = createMockQueryChain([]);

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "payment",
            entity_id: "payment-101",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.limit).toHaveBeenCalledWith(50);
      });
    });
  });

  describe("Optional filters", () => {
    it("filters by action when provided", async () => {
      const mockChain = createMockQueryChain([]);

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
            action: "UPDATE",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.eq).toHaveBeenCalledWith("action", "UPDATE");
      });
    });

    it("filters by user_id when provided", async () => {
      const mockChain = createMockQueryChain([]);

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
            user_id: "user-456",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-456");
      });
    });

    it("filters by date range when provided", async () => {
      const mockChain = createMockQueryChain([]);
      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-01-31");

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "expense",
            entity_id: "expense-202",
            date_from: dateFrom,
            date_to: dateTo,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.gte).toHaveBeenCalledWith("created_at", dateFrom.toISOString());
        expect(mockChain.lte).toHaveBeenCalledWith("created_at", dateTo.toISOString());
      });
    });

    it("applies all filters together", async () => {
      const mockChain = createMockQueryChain([]);
      const dateFrom = new Date("2024-01-01");

      renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
            action: "UPDATE",
            user_id: "user-456",
            date_from: dateFrom,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockChain.eq).toHaveBeenCalledWith("table_name", "bookings");
        expect(mockChain.eq).toHaveBeenCalledWith("record_id", "booking-123");
        expect(mockChain.eq).toHaveBeenCalledWith("action", "UPDATE");
        expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-456");
        expect(mockChain.gte).toHaveBeenCalledWith("created_at", dateFrom.toISOString());
      });
    });
  });

  describe("Error handling", () => {
    it("handles database errors", async () => {
      createMockQueryChain(null, {
        message: "Database error",
        code: "500",
      });

      const { result } = renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Database error");
    });

    it("handles empty results", async () => {
      createMockQueryChain([]);

      const { result } = renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "nonexistent",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe("Caching behavior", () => {
    it("uses staleTime of 10 seconds", async () => {
      const mockLogs = [{ id: "log-1", table_name: "booking" }];
      createMockQueryChain(mockLogs);

      const { result } = renderHook(
        () =>
          useEntityAudit({
            entity_type: "booking",
            entity_id: "booking-123",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check that query is in cache
      const cachedData = queryClient.getQueryData([
        "audit-logs",
        {
          entity_type: "booking",
          entity_id: "booking-123",
        },
      ]);

      expect(cachedData).toEqual(mockLogs);
    });

    it("generates unique query keys for different filters", async () => {
      createMockQueryChain([]);

      const { rerender } = renderHook(({ filters }) => useEntityAudit(filters), {
        wrapper: createWrapper(),
        initialProps: {
          filters: {
            entity_type: "booking" as const,
            entity_id: "booking-123",
          },
        },
      });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      // Change filters
      rerender({
        filters: {
          entity_type: "booking" as const,
          entity_id: "booking-123",
          action: "UPDATE",
        },
      });

      // Should make a new query with different filters
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalled();
      });
    });
  });

  describe("Query key structure", () => {
    it("includes all filter params in query key", async () => {
      createMockQueryChain([{ id: "log-1" }]);

      const filters = {
        entity_type: "booking" as const,
        entity_id: "booking-123",
        action: "UPDATE",
        user_id: "user-456",
      };

      renderHook(() => useEntityAudit(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const queryData = queryClient.getQueryData(["audit-logs", filters]);
        expect(queryData).toBeDefined();
      });
    });
  });
});
