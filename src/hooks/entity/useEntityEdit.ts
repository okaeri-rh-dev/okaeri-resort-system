// src/hooks/entity/useEntityEdit.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";
import type { Booking, Expense, Guest, Payment, Unit } from "@/types";
import type { EntityType } from "@/types/entity-detail.types";

/**
 * Mapped type for entity update data
 */
type EntityUpdateData<T extends EntityType> = T extends "booking"
  ? Partial<Booking>
  : T extends "unit"
    ? Partial<Unit>
    : T extends "guest"
      ? Partial<Guest>
      : T extends "payment"
        ? Partial<Payment>
        : T extends "expense"
          ? Partial<Expense>
          : never;

/**
 * Options for useEntityEdit hook
 */
type UseEntityEditOptions<TData> = {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
};

/**
 * Generic hook for updating entities with optimistic updates
 *
 * Follows the pattern from useBookingStore with:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on error
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
export function useEntityEdit<T extends EntityType>(
  entityType: T,
  entityId: string,
  options?: UseEntityEditOptions<EntityUpdateData<T>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: EntityUpdateData<T>) => {
      // Type-safe update based on entity type
      const { data, error } = await (async () => {
        switch (entityType) {
          case "booking":
            return db.bookings.update(entityId, updateData as Partial<Booking>);
          case "unit":
            return db.units.update(entityId, updateData as Partial<Unit>);
          case "guest":
            return db.guests.update(entityId, updateData as Partial<Guest>);
          case "payment":
            return db.payments.update(entityId, updateData as Partial<Payment>);
          case "expense": {
            // The app type calls expense_date `date`; null description is not accepted by the DB
            const { description, date, ...rest } = updateData as Partial<Expense>;
            return db.expenses.update(entityId, {
              ...rest,
              ...(description !== null && { description }),
              ...(date !== undefined && { expense_date: date }),
            });
          }
          default:
            throw new Error(`Unknown entity type: ${entityType}`);
        }
      })();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },

    // Optimistic update - instant UI feedback
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.entity(entityType, entityId) });

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData(queryKeys.entity(entityType, entityId));

      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.entity(entityType, entityId), (old: unknown) => ({
        ...(old as Record<string, unknown>),
        ...(newData as Record<string, unknown>),
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
      options?.onError?.(error);
    },

    // Refetch on success to ensure consistency
    onSuccess: (data) => {
      // Invalidate individual entity cache
      queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityType, entityId) });

      // Invalidate list caches
      queryClient.invalidateQueries({ queryKey: queryKeys.entities(entityType) });

      // Show success toast
      toast.success(`${entityType} updated successfully`);

      // Call custom success handler
      options?.onSuccess?.(data as EntityUpdateData<T>);
    },
  });
}
