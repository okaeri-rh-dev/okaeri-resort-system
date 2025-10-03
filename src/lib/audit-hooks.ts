// src/lib/audit-hooks.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "./supabase";
import type {
  AuditLog,
  AuditLogFilters,
  AuditLogQueryResult,
  AuditLogStats,
  AuditEventContext,
} from "../../database.types";
import { AUDIT_CACHE_CONFIG } from "./audit-constants";

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
    queryFn: () => db.auditLogs.all(filters as any), // Type cast needed due to Supabase query builder limitations
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

  return useMutation<{ count: number; error?: string }, Error, string>({
    mutationFn: (beforeDate: string) => db.auditLogs.archiveOld(beforeDate),
    onSuccess: (result) => {
      console.log(`Archived ${result.count} old audit logs`);
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
      } as any); // Type cast needed due to Supabase query builder limitations

      // Convert to CSV
      const csv = convertLogsToCSV(result.data as AuditLog[]); // Type assertion for data array

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
