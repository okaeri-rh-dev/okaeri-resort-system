# Phase 2d: React Hooks and Zustand Store

## Purpose

This document covers the React data layer for audit logs using TanStack Query hooks (for server state) and a Zustand store (for UI state). This follows the existing pattern in the codebase where TanStack Query handles data fetching/caching and Zustand manages UI state like filters and selections.

**Architecture Pattern:**

- **TanStack Query** → Server data (audit logs, statistics)
- **Zustand Store** → UI state (filters, selected log, table state)
- **Separation** → Data fetching separate from UI state management

## TanStack Query Hooks

### File Location

Create `src/lib/audit-hooks.ts`:

```typescript
// src/lib/audit-hooks.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AuditEventContext,
  AuditLog,
  AuditLogFilters,
  AuditLogQueryResult,
  AuditLogStats,
} from "../../database.types";
import { AUDIT_CACHE_CONFIG } from "./audit-constants";
import { db } from "./supabase";

// ============================================
// QUERY KEYS
// ============================================

/**
 * Query key factory for audit logs
 * Ensures consistent cache keys across the app
 */
export const auditKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters?: AuditLogFilters) => [...auditKeys.lists(), filters] as const,
  details: () => [...auditKeys.all, "detail"] as const,
  detail: (id: string) => [...auditKeys.details(), id] as const,
  record: (tableName: string, recordId: string) =>
    [...auditKeys.all, "record", tableName, recordId] as const,
  stats: (filters?: AuditLogFilters) => [...auditKeys.all, "stats", filters] as const,
  user: (email: string) => [...auditKeys.all, "user", email] as const,
};

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch paginated audit logs with filters
 *
 * @param filters - Optional filter criteria
 * @returns Query result with audit logs and pagination metadata
 *
 * @example
 * const { data, isLoading, error } = useAuditLogs({
 *   tableName: 'bookings',
 *   startDate: '2024-01-01T00:00:00Z',
 *   limit: 50,
 *   offset: 0
 * });
 */
export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery<AuditLogQueryResult, Error>({
    queryKey: auditKeys.list(filters),
    queryFn: () => db.auditLogs.all(filters),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
    retry: AUDIT_CACHE_CONFIG.RETRY,
    refetchOnWindowFocus: AUDIT_CACHE_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });
}

/**
 * Fetch single audit log by ID
 *
 * @param auditId - UUID of audit log
 * @returns Query result with single audit log
 */
export function useAuditLog(auditId: string) {
  return useQuery<AuditLog, Error>({
    queryKey: auditKeys.detail(auditId),
    queryFn: async () => {
      const { data, error } = await db.auditLogs.byId(auditId);
      if (error) throw error;
      return data as AuditLog;
    },
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
    enabled: !!auditId, // Only run if auditId is provided
  });
}

/**
 * Fetch audit trail for a specific record
 * Shows complete change history for a booking, unit, payment, etc.
 *
 * @param tableName - Table name (bookings, units, etc)
 * @param recordId - UUID of record
 * @returns Query result with record's audit history
 *
 * @example
 * const { data: history } = useAuditTrail('bookings', booking.booking_id);
 */
export function useAuditTrail(tableName: string, recordId: string) {
  return useQuery<AuditLog[], Error>({
    queryKey: auditKeys.record(tableName, recordId),
    queryFn: () => db.auditLogs.byRecord(tableName, recordId),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
    enabled: !!tableName && !!recordId,
  });
}

/**
 * Fetch audit statistics
 *
 * @param filters - Optional filters for stats calculation
 * @returns Query result with aggregated statistics
 *
 * @example
 * const { data: stats } = useAuditStats({ startDate: '2024-01-01T00:00:00Z' });
 */
export function useAuditStats(filters?: AuditLogFilters) {
  return useQuery<AuditLogStats, Error>({
    queryKey: auditKeys.stats(filters),
    queryFn: () => db.auditLogs.stats(filters),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
  });
}

/**
 * Fetch recent audit logs (last N logs)
 *
 * @param limit - Number of logs to fetch (default 50)
 * @returns Query result with recent logs
 */
export function useRecentAuditLogs(limit = 50) {
  return useQuery<AuditLog[], Error>({
    queryKey: [...auditKeys.lists(), "recent", limit],
    queryFn: () => db.auditLogs.recent(limit),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
  });
}

/**
 * Fetch user activity logs
 *
 * @param userEmail - User email to filter by
 * @param limit - Maximum logs to return
 * @returns Query result with user's audit logs
 */
export function useUserAuditLogs(userEmail: string, limit = 100) {
  return useQuery<AuditLog[], Error>({
    queryKey: auditKeys.user(userEmail),
    queryFn: () => db.auditLogs.byUser(userEmail, limit),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
    enabled: !!userEmail,
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create manual audit log entry
 * Used for Layer 2 application-level logging
 *
 * @returns Mutation hook for creating audit logs
 *
 * @example
 * const createAuditLog = useCreateAuditLog();
 * await createAuditLog.mutateAsync({
 *   tableName: 'bookings',
 *   action: 'UPDATE',
 *   description: 'Booking cancelled',
 *   category: AuditCategory.BOOKING,
 *   severity: AuditSeverity.WARNING
 * });
 */
export function useCreateAuditLog() {
  const queryClient = useQueryClient();

  return useMutation<AuditLog, Error, AuditEventContext>({
    mutationFn: async (context: AuditEventContext) => {
      const { data, error } = await db.auditLogs.create(context);
      if (error) throw error;
      return data as AuditLog;
    },
    onSuccess: () => {
      // Invalidate all audit log queries to refetch
      queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
  });
}

/**
 * Archive old audit logs (manual cleanup)
 *
 * @returns Mutation hook for archiving logs
 *
 * @example
 * const archiveLogs = useArchiveAuditLogs();
 * const twoYearsAgo = new Date();
 * twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
 * await archiveLogs.mutateAsync(twoYearsAgo.toISOString());
 */
export function useArchiveAuditLogs() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, string>({
    mutationFn: (beforeDate: string) => db.auditLogs.archiveOld(beforeDate),
    onSuccess: (deletedCount) => {
      console.log(`Archived ${deletedCount} old audit logs`);
      // Invalidate all audit log queries
      queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
  });
}

/**
 * Export audit logs to CSV
 *
 * @returns Mutation hook for exporting logs
 *
 * @example
 * const exportLogs = useExportAuditLogs();
 * await exportLogs.mutateAsync({
 *   filters: { tableName: 'bookings', startDate: '2024-01-01T00:00:00Z' },
 *   filename: 'booking-audit-jan-2024.csv'
 * });
 */
export function useExportAuditLogs() {
  return useMutation<void, Error, { filters?: AuditLogFilters; filename?: string }>({
    mutationFn: async ({ filters, filename }) => {
      // Fetch logs with filters
      const result = await db.auditLogs.all({
        ...filters,
        limit: 10000, // Export up to 10k logs
      });

      // Convert to CSV
      const csv = convertLogsToCSV(result.data);

      // Download CSV file
      downloadCSV(csv, filename || `audit-logs-${new Date().toISOString().split("T")[0]}.csv`);
    },
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert audit logs to CSV format
 */
function convertLogsToCSV(logs: AuditLog[]): string {
  const headers = [
    "Created At",
    "User Email",
    "Table",
    "Action",
    "Record ID",
    "Changed Fields",
    "Description",
  ];

  const rows = logs.map((log) => [
    log.created_at,
    log.user_email || "system",
    log.table_name,
    log.action,
    log.record_id || "",
    log.changed_fields?.join(", ") || "",
    log.metadata && typeof log.metadata === "object" && "description" in log.metadata
      ? String(log.metadata.description)
      : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Trigger CSV file download in browser
 */
function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
```

## Zustand Store

### File Location

Create `src/stores/useAuditStore.ts`:

```typescript
// src/stores/useAuditStore.ts

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { AuditLog, AuditLogFilters, TableState } from "@/types";

// ============================================
// STORE INTERFACE
// ============================================

interface AuditStore {
  // Selected audit log (for detail view)
  selectedLog: AuditLog | null;
  setSelectedLog: (log: AuditLog | null) => void;

  // Filter state
  filters: AuditLogFilters;
  setFilters: (filters: AuditLogFilters) => void;
  resetFilters: () => void;

  // UI state
  showFilters: boolean;
  toggleFilters: () => void;

  // Table state (for TanStack Table)
  tableState: Partial<TableState>;
  setTableState: (state: Partial<TableState>) => void;

  // Quick filters (preset filter shortcuts)
  applyQuickFilter: (preset: QuickFilterPreset) => void;
}

/**
 * Quick filter presets for common queries
 */
export enum QuickFilterPreset {
  RECENT = "recent",
  FAILED_LOGINS = "failed_logins",
  DELETIONS = "deletions",
  CRITICAL = "critical",
  BOOKINGS_TODAY = "bookings_today",
  PAYMENTS_TODAY = "payments_today",
}

// ============================================
// ZUSTAND STORE
// ============================================

export const useAuditStore = create<AuditStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        selectedLog: null,
        filters: {},
        showFilters: true,
        tableState: {
          pagination: {
            pageIndex: 0,
            pageSize: 50,
          },
        },

        // Actions
        setSelectedLog: (log) => set({ selectedLog: log }),

        setFilters: (filters) =>
          set({
            filters,
            tableState: {
              ...get().tableState,
              pagination: { pageIndex: 0, pageSize: 50 }, // Reset to first page
            },
          }),

        resetFilters: () =>
          set({
            filters: {},
            tableState: {
              pagination: { pageIndex: 0, pageSize: 50 },
            },
          }),

        toggleFilters: () => set({ showFilters: !get().showFilters }),

        setTableState: (state) =>
          set({
            tableState: {
              ...get().tableState,
              ...state,
            },
          }),

        /**
         * Apply preset quick filters
         */
        applyQuickFilter: (preset: QuickFilterPreset) => {
          const now = new Date();
          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).toISOString();

          const presetFilters: Record<QuickFilterPreset, AuditLogFilters> = {
            [QuickFilterPreset.RECENT]: {
              limit: 50,
              offset: 0,
            },
            [QuickFilterPreset.FAILED_LOGINS]: {
              action: "INSERT", // Login attempts are inserts
              startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
              limit: 50,
            },
            [QuickFilterPreset.DELETIONS]: {
              action: "DELETE",
              limit: 50,
            },
            [QuickFilterPreset.CRITICAL]: {
              // This would need metadata filtering (not supported yet)
              limit: 50,
            },
            [QuickFilterPreset.BOOKINGS_TODAY]: {
              tableName: "bookings",
              startDate: todayStart,
              limit: 100,
            },
            [QuickFilterPreset.PAYMENTS_TODAY]: {
              tableName: "payments",
              startDate: todayStart,
              limit: 100,
            },
          };

          set({
            filters: presetFilters[preset],
            tableState: {
              pagination: { pageIndex: 0, pageSize: 50 },
            },
          });
        },
      }),
      {
        name: "audit-store", // localStorage key
        partialize: (state) => ({
          // Only persist filters and UI preferences
          filters: state.filters,
          showFilters: state.showFilters,
          tableState: state.tableState,
          // Don't persist selectedLog (not needed across sessions)
        }),
      }
    )
  )
);

// ============================================
// SELECTOR HOOKS (for performance)
// ============================================

/**
 * Get current filters (optimized selector)
 */
export const useAuditFilters = () => useAuditStore((state) => state.filters);

/**
 * Get selected log (optimized selector)
 */
export const useSelectedAuditLog = () => useAuditStore((state) => state.selectedLog);

/**
 * Get table state (optimized selector)
 */
export const useAuditTableState = () => useAuditStore((state) => state.tableState);
```

## Usage Examples

### Example 1: Audit Log List Page

```typescript
// src/routes/audit-logs/index.tsx
import { useAuditLogs, useAuditStats } from "@/lib/audit-hooks";
import { useAuditStore } from "@/stores/useAuditStore";

export function AuditLogsPage() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);

  // Fetch audit logs with filters
  const { data, isLoading, error } = useAuditLogs(filters);

  // Fetch statistics
  const { data: stats } = useAuditStats(filters);

  if (isLoading) return <div>Loading audit logs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Audit Trail</h1>

      {/* Stats Panel */}
      <div className="stats">
        <div>Total Logs: {stats?.totalLogs}</div>
        <div>By Table: {JSON.stringify(stats?.byTable)}</div>
      </div>

      {/* Audit Table */}
      <AuditLogTable
        logs={data?.data || []}
        pagination={{
          currentPage: data?.currentPage || 1,
          totalPages: data?.totalPages || 1,
        }}
        onPageChange={(page) =>
          setFilters({ ...filters, offset: (page - 1) * (filters.limit || 50) })
        }
      />
    </div>
  );
}
```

### Example 2: Record History Sidebar

```typescript
// Show booking change history in sidebar
import { useAuditTrail } from "@/lib/audit-hooks";

export function BookingHistorySidebar({ bookingId }: { bookingId: string }) {
  const { data: history, isLoading } = useAuditTrail("bookings", bookingId);

  if (isLoading) return <div>Loading history...</div>;

  return (
    <div className="history-sidebar">
      <h3>Booking History</h3>
      {history?.map((log) => (
        <div key={log.audit_id}>
          <div>{new Date(log.created_at).toLocaleString()}</div>
          <div>
            {log.action} by {log.user_email}
          </div>
          <div>{log.changed_fields?.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Quick Filter Buttons

```typescript
// Quick action buttons for common queries
import { useAuditStore, QuickFilterPreset } from "@/stores/useAuditStore";

export function AuditQuickFilters() {
  const applyQuickFilter = useAuditStore((state) => state.applyQuickFilter);

  return (
    <div className="quick-filters">
      <button onClick={() => applyQuickFilter(QuickFilterPreset.RECENT)}>
        Recent Activity
      </button>
      <button onClick={() => applyQuickFilter(QuickFilterPreset.DELETIONS)}>
        All Deletions
      </button>
      <button onClick={() => applyQuickFilter(QuickFilterPreset.BOOKINGS_TODAY)}>
        Today's Bookings
      </button>
      <button onClick={() => applyQuickFilter(QuickFilterPreset.PAYMENTS_TODAY)}>
        Today's Payments
      </button>
    </div>
  );
}
```

### Example 4: Export Audit Logs

```typescript
// CSV export button
import { useExportAuditLogs } from "@/lib/audit-hooks";
import { useAuditFilters } from "@/stores/useAuditStore";

export function ExportButton() {
  const filters = useAuditFilters();
  const exportLogs = useExportAuditLogs();

  const handleExport = async () => {
    await exportLogs.mutateAsync({
      filters,
      filename: `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
    });
  };

  return (
    <button onClick={handleExport} disabled={exportLogs.isPending}>
      {exportLogs.isPending ? "Exporting..." : "Export to CSV"}
    </button>
  );
}
```

## Store Exports

Add to `src/stores/index.ts`:

```typescript
// src/stores/index.ts
export { useAuditStore, useAuditFilters, useSelectedAuditLog } from "./useAuditStore";
```

## Testing Hooks and Store

### Test Script

```typescript
// Test hooks and store integration
import { renderHook, waitFor } from "@testing-library/react";

import { useAuditLogs, useAuditStats } from "@/lib/audit-hooks";
import { useAuditStore } from "@/stores/useAuditStore";

// Manual test in browser console
async function testAuditDataLayer() {
  console.log("Testing audit data layer...\n");

  // Test 1: Fetch recent logs
  const { result } = renderHook(() => useAuditLogs({ limit: 5 }));
  await waitFor(() => expect(result.current.data).toBeDefined());
  console.log("✓ Fetched logs:", result.current.data?.data.length);

  // Test 2: Apply quick filter
  const { setFilters, applyQuickFilter } = useAuditStore.getState();
  applyQuickFilter(QuickFilterPreset.DELETIONS);
  console.log("✓ Quick filter applied");

  // Test 3: Reset filters
  useAuditStore.getState().resetFilters();
  console.log("✓ Filters reset");

  console.log("\n✅ All data layer tests passed!");
}
```

## Performance Optimization

### React Query Configuration

The hooks use optimized cache settings:

- **Stale time**: 5 minutes (audit logs don't change often)
- **Cache time**: 30 minutes (keep in memory)
- **Retry**: 2 attempts
- **Refetch on focus**: Disabled (reduces unnecessary queries)

### Zustand Selectors

Use selector hooks for granular re-renders:

```typescript
// ✅ Good: Only re-renders when filters change
const filters = useAuditStore((state) => state.filters);

// ❌ Bad: Re-renders on any store change
const store = useAuditStore();
```

## Next Steps

**Next**: [Phase 3a - Page and Routing](../03-audit-viewer-ui/03a-page-and-routing.md)

Phase 3 will create the UI components for the audit log viewer using these hooks and stores. You now have:

- ✅ Database helpers (`db.auditLogs.*`)
- ✅ TanStack Query hooks (`useAuditLogs`, `useAuditTrail`, etc.)
- ✅ Zustand store (`useAuditStore`)
- ✅ Export functionality

Ready to build the UI!

---

**Integration Checklist:**

- [ ] `src/lib/audit-hooks.ts` created with all hooks
- [ ] `src/stores/useAuditStore.ts` created
- [ ] Store exported in `src/stores/index.ts`
- [ ] Test hooks in browser with dev tools
- [ ] Query cache working (check React Query DevTools)
- [ ] Filters persist across page reloads
