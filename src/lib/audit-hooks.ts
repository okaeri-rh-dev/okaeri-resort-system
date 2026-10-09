// src/lib/audit-hooks.ts

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { logger } from "@/lib/logger";
import { toManilaDateString } from "@/lib/timezone";
import type {
  AuditLog,
  AuditLogFilters,
  AuditLogQueryResult,
  AuditLogStats,
} from "@/types/audit.types";

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
  recent: (limit: number) => [...auditKeys.lists(), "recent", limit] as const,
  userActivity: (email: string, limit: number) => [...auditKeys.user(email), limit] as const,
};

/** The 50 newest audit rows for one record, for detail-page loaders. A failure shows an empty history, not an error page. */
export const recentRecordAuditLogsQuery = (tableName: string, recordId: string) =>
  queryOptions({
    queryKey: [...auditKeys.record(tableName, recordId), "recent"],
    queryFn: async () => {
      try {
        return await db.auditLogs.recentByRecord(tableName, recordId);
      } catch (error) {
        logger.error(`Failed to fetch audit logs for ${tableName}/${recordId}`, error);
        return [];
      }
    },
    staleTime: 60000,
  });

// ============================================
// QUERY HOOKS
// ============================================

const auditLogsQuery = (filters?: AuditLogFilters) =>
  queryOptions<AuditLogQueryResult, Error>({
    queryKey: auditKeys.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => db.auditLogs.all(filters as any), // Type cast needed due to Supabase query builder limitations
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
    retry: AUDIT_CACHE_CONFIG.RETRY,
    refetchOnWindowFocus: AUDIT_CACHE_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });

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
  return useQuery(auditLogsQuery(filters));
}

const auditStatsQuery = (filters?: AuditLogFilters) =>
  queryOptions<AuditLogStats, Error>({
    queryKey: auditKeys.stats(filters),
    queryFn: () => db.auditLogs.stats(filters),
    staleTime: AUDIT_CACHE_CONFIG.STALE_TIME,
    gcTime: AUDIT_CACHE_CONFIG.CACHE_TIME,
  });

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
  return useQuery(auditStatsQuery(filters));
}

// ============================================
// MUTATION HOOKS
// ============================================

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
      const csv = convertLogsToCSV(result.data as AuditLog[]); // Type assertion for data array

      // Download CSV file
      downloadCSV(csv, filename || `audit-logs-${toManilaDateString(new Date())}.csv`);
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
    log.description || "",
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
