// src/hooks/entity/useEntityDetail.ts

import { useQuery } from "@tanstack/react-query";
import type { EntityType, EntityDetail } from "@/types/entity-detail.types";
import { db } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

/**
 * Options for useEntityDetail hook
 */
type UseEntityDetailOptions = {
  enabled?: boolean;
  staleTime?: number;
};

/**
 * Generic hook for fetching entity details with type safety
 *
 * Automatically selects the correct database query based on entity type
 * and returns properly typed data with relations included.
 *
 * @param entityType - The type of entity to fetch
 * @param entityId - The UUID of the entity
 * @param options - Query options (enabled, staleTime)
 *
 * @example
 * ```typescript
 * // Fetch booking with unit and guest relations
 * const { data: booking, isLoading } = useEntityDetail('booking', bookingId)
 *
 * // Conditionally fetch
 * const { data: unit } = useEntityDetail('unit', unitId, {
 *   enabled: !!unitId,
 *   staleTime: 60_000, // Cache for 1 minute
 * })
 * ```
 */
export function useEntityDetail<T extends EntityType>(
  entityType: T,
  entityId: string | undefined,
  options?: UseEntityDetailOptions
) {
  return useQuery({
    queryKey: queryKeys.entity(entityType, entityId || ""),
    queryFn: async () => {
      if (!entityId) {
        throw new Error("Entity ID is required");
      }

      // Type-safe database fetching based on entity type
      const { data, error } = await (async () => {
        switch (entityType) {
          case "booking":
            return db.bookings.byId(entityId);
          case "unit":
            return db.units.byId(entityId);
          case "guest":
            return db.guests.byId(entityId);
          case "payment":
            return db.payments.byId(entityId);
          case "expense":
            return db.expenses.byId(entityId);
          default:
            throw new Error(`Unknown entity type: ${entityType}`);
        }
      })();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(`${entityType} not found`);
      }

      return data as EntityDetail<T>;
    },
    enabled: !!entityId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000, // Default: 30 seconds
  });
}
