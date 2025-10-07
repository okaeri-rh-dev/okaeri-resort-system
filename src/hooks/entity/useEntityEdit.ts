// src/hooks/entity/useEntityEdit.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityType } from "@/types/entity-detail.types";
import { db } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/audit-logger";
import { AuditCategory, AuditSeverity } from "@/types/audit.types";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

/**
 * Options for useEntityEdit hook
 */
type UseEntityEditOptions<TData> = {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
};

/**
 * Mapping of entity types to audit categories
 */
const ENTITY_TO_AUDIT_CATEGORY: Record<EntityType, AuditCategory> = {
  booking: AuditCategory.BOOKING,
  unit: AuditCategory.UNIT,
  guest: AuditCategory.GUEST,
  payment: AuditCategory.PAYMENT,
  expense: AuditCategory.EXPENSE,
};

/**
 * Generic hook for updating entities with optimistic updates and audit logging
 *
 * Follows the pattern from useBookingStore with:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on error
 * - Audit trail logging for all mutations
 * - Toast notifications
 *
 * @param entityType - The type of entity to edit
 * @param entityId - The UUID of the entity
 * @param options - Success/error callbacks
 *
 * @example
 * ```typescript
 * const updateBooking = useEntityEdit('booking', bookingId, {
 *   onSuccess: () => navigate({ to: '/bookings/$bookingId', params: { bookingId } })
 * })
 *
 * const handleSubmit = (data: BookingFormData) => {
 *   updateBooking.mutate(data)
 * }
 * ```
 */
export function useEntityEdit<T extends EntityType, TData = any>(
  entityType: T,
  entityId: string,
  options?: UseEntityEditOptions<TData>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: TData) => {
      // Get current data for audit trail
      const previousData = queryClient.getQueryData(queryKeys.entity(entityType, entityId));

      // Type-safe update based on entity type
      const { data, error } = await (async () => {
        switch (entityType) {
          case "booking":
            return db.bookings.update(entityId, updateData as any);
          case "unit":
            return db.units.update(entityId, updateData as any);
          case "guest":
            return db.guests.update(entityId, updateData as any);
          case "payment":
            return db.payments.update(entityId, updateData as any);
          case "expense":
            return db.expenses.update(entityId, updateData as any);
          default:
            throw new Error(`Unknown entity type: ${entityType}`);
        }
      })();

      if (error) {
        throw new Error(error.message);
      }

      // Log audit event (fire-and-forget, don't block)
      logAuditEvent({
        tableName: `${entityType}s`, // Convert to plural table name
        recordId: entityId,
        description: `${entityType} updated`,
        category: ENTITY_TO_AUDIT_CATEGORY[entityType],
        severity: AuditSeverity.INFO,
        metadata: {
          action: "updated",
          before: previousData,
          after: data,
        },
      }).catch((err) => {
        console.error(`[Audit] Failed to log ${entityType} update:`, err);
      });

      return data;
    },

    // Optimistic update - instant UI feedback
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.entity(entityType, entityId) });

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData(queryKeys.entity(entityType, entityId));

      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.entity(entityType, entityId), (old: any) => ({
        ...old,
        ...newData,
      }));

      // Return context with snapshot for rollback
      return { previousData };
    },

    // Rollback on error
    onError: (error, _variables, context) => {
      // Restore previous data from snapshot
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.entity(entityType, entityId), context.previousData);
      }

      // Show error toast
      toast.error(`Failed to update ${entityType}`, {
        description: error.message,
      });

      // Call custom error handler
      options?.onError?.(error as Error);
    },

    // Refetch on success to ensure consistency
    onSuccess: (data: any) => {
      // Invalidate individual entity cache
      queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityType, entityId) });

      // Invalidate list caches
      queryClient.invalidateQueries({ queryKey: queryKeys.entities(entityType) });

      // Show success toast
      toast.success(`${entityType} updated successfully`);

      // Call custom success handler
      options?.onSuccess?.(data);
    },
  });
}
