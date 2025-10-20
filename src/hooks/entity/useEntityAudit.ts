// src/hooks/entity/useEntityAudit.ts

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { AuditFilters } from "@/types/entity-detail.types";

/**
 * Generic hook for fetching audit logs filtered by entity
 *
 * Queries the audit_logs table with flexible filtering:
 * - By entity type and ID (required)
 * - By action, user, date range (optional)
 *
 * @param filters - Audit log filters
 *
 * @example
 * ```typescript
 * // Basic usage - all logs for a booking
 * const { data: auditLogs } = useEntityAudit({
 *   entity_type: 'booking',
 *   entity_id: bookingId
 * })
 *
 * // Advanced filtering
 * const { data: logs } = useEntityAudit({
 *   entity_type: 'payment',
 *   entity_id: paymentId,
 *   action: 'payment.verified',
 *   date_from: startDate,
 *   date_to: endDate
 * })
 * ```
 */
export function useEntityAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: queryKeys.audit(filters),
    queryFn: async () => {
      // Start with base query filtered by entity
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", `${filters.entity_type}s`) // Convert to plural table name
        .eq("record_id", filters.entity_id)
        .order("created_at", { ascending: false });

      // Apply optional filters
      if (filters.action) {
        query = query.eq("action", filters.action);
      }

      if (filters.user_id) {
        query = query.eq("user_id", filters.user_id);
      }

      if (filters.date_from) {
        query = query.gte("created_at", filters.date_from.toISOString());
      }

      if (filters.date_to) {
        query = query.lte("created_at", filters.date_to.toISOString());
      }

      // Limit to 50 most recent entries
      const { data, error } = await query.limit(50);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    staleTime: 10_000, // 10 seconds - audit logs don't change frequently
  });
}
