// src/hooks/entity/useEntityNavigation.ts

import { useNavigate } from "@tanstack/react-router";

import type { EntityType } from "@/types/entity-detail.types";

/**
 * Type-safe programmatic navigation helper for entities
 *
 * Provides three navigation methods:
 * - navigateToDetail: Go to entity detail page
 * - navigateToEdit: Go to entity edit page
 * - navigateToList: Go to entity list page
 *
 * @example
 * ```typescript
 * const { navigateToDetail, navigateToEdit, navigateToList } = useEntityNavigation()
 *
 * // Navigate to guest detail
 * navigateToDetail('guest', guestId)
 *
 * // Navigate to booking edit with tab
 * navigateToDetail('booking', bookingId, { tab: 'payments' })
 *
 * // Navigate to units list
 * navigateToList('unit')
 * ```
 */
export function useEntityNavigation() {
  const navigate = useNavigate();

  return {
    /**
     * Navigate to entity detail page
     */
    navigateToDetail: <T extends EntityType>(
      entityType: T,
      entityId: string,
      search?: Record<string, unknown>
    ) => {
      const routes: Record<EntityType, any> = {
        booking: { to: "/bookings/$bookingId", params: { bookingId: entityId } },
        unit: { to: "/units/$unitId", params: { unitId: entityId } },
        guest: { to: "/guests/$guestId", params: { guestId: entityId } },
        payment: { to: "/payments/$paymentId", params: { paymentId: entityId } },
        expense: { to: "/expenses/$expenseId", params: { expenseId: entityId } },
      };

      const route = routes[entityType];
      navigate({ ...route, search });
    },

    /**
     * Navigate to entity edit page
     */
    navigateToEdit: <T extends EntityType>(entityType: T, entityId: string) => {
      const routes: Record<EntityType, any> = {
        booking: { to: "/bookings/$bookingId/edit", params: { bookingId: entityId } },
        unit: { to: "/units/$unitId/edit", params: { unitId: entityId } },
        guest: { to: "/guests/$guestId/edit", params: { guestId: entityId } },
        payment: { to: "/payments/$paymentId/edit", params: { paymentId: entityId } },
        expense: { to: "/expenses/$expenseId/edit", params: { expenseId: entityId } },
      };

      const route = routes[entityType];
      navigate(route);
    },

    /**
     * Navigate to entity list page
     */
    navigateToList: (entityType: EntityType) => {
      const routes: Record<EntityType, string> = {
        booking: "/bookings",
        unit: "/units",
        guest: "/guests",
        payment: "/payments",
        expense: "/expenses",
      };

      navigate({ to: routes[entityType] });
    },
  };
}
