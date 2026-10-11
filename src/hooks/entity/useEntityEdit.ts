// src/hooks/entity/useEntityEdit.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAccounts } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";
import type { Expense, Guest, Unit } from "@/types";
import type { EntityType } from "@/types/entity-detail.types";

// Payments and bookings save through their modules (src/lib/payments, src/lib/bookings)
type EditableEntityType = Exclude<EntityType, "payment" | "booking">;

/**
 * Mapped type for entity update data
 */
type EntityUpdateData<T extends EditableEntityType> = T extends "unit"
  ? Partial<Unit>
  : T extends "guest"
    ? Partial<Guest>
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
 * const updateGuest = useEntityEdit('guest', guestId, {
 *   onSuccess: () => navigate({ to: '/guests/$guestId', params: { guestId } })
 * })
 *
 * const handleSubmit = (data: GuestFormData) => {
 *   updateGuest.mutate(data)
 * }
 * ```
 */
export function useEntityEdit<T extends EditableEntityType>(
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
          case "unit":
            return db.units.update(entityId, updateData as Partial<Unit>);
          case "guest":
            return db.guests.update(entityId, updateData as Partial<Guest>);
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

      if (entityType === "expense") invalidateAccounts();

      // Show success toast
      toast.success(`${entityType} updated successfully`);

      // Call custom success handler
      options?.onSuccess?.(data as EntityUpdateData<T>);
    },
  });
}
