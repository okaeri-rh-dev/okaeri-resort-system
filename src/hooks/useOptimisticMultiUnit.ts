/**
 * React 19 useOptimistic Wrapper Hooks for Multi-Unit Bookings (Phase 3)
 *
 * Provides optimistic UI update patterns using React 19's experimental useOptimistic hook
 * for instant feedback while API calls are in flight.
 *
 * @module useOptimisticMultiUnit
 */

import { useOptimistic, useTransition } from "react";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type { BookingUnit, MultiUnitBooking } from "@/types";

// ============================================
// OPTIMISTIC BOOKING CREATION
// ============================================

/**
 * Optimistic multi-unit booking creation
 *
 * Provides instant UI feedback while the booking is being created on the server
 */
export function useOptimisticBookingCreation() {
  const { addOptimisticBooking, removeOptimisticBooking } = useMultiUnitBookingStore();
  const [isPending, startTransition] = useTransition();

  const createOptimistically = async (
    bookingData: Partial<MultiUnitBooking>,
    mutationFn: (data: Partial<MultiUnitBooking>) => Promise<MultiUnitBooking>
  ) => {
    const optimisticBooking: MultiUnitBooking = {
      booking_id: `temp-${Date.now()}`,
      booking_reference: `BK-PENDING`,
      ...bookingData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as MultiUnitBooking;

    // Add optimistic booking immediately
    startTransition(() => {
      addOptimisticBooking(optimisticBooking);
    });

    try {
      // Call actual API
      const result = await mutationFn(bookingData);

      // Remove optimistic entry on success
      startTransition(() => {
        removeOptimisticBooking(optimisticBooking.booking_id);
      });

      return result;
    } catch (error) {
      // Rollback optimistic update on error
      startTransition(() => {
        removeOptimisticBooking(optimisticBooking.booking_id);
      });

      throw error;
    }
  };

  return {
    createOptimistically,
    isPending,
  };
}

// ============================================
// OPTIMISTIC UNIT ADDITION
// ============================================

type AddUnitAction = { type: "add"; unit: BookingUnit };
type RemoveUnitAction = { type: "remove"; unitId: string };
type UnitAction = AddUnitAction | RemoveUnitAction;

/**
 * Optimistic unit addition/removal from booking
 */
export function useOptimisticUnitManagement(initialUnits: BookingUnit[] = []) {
  const [optimisticUnits, setOptimisticUnits] = useOptimistic<BookingUnit[], UnitAction>(
    initialUnits,
    (state, action) => {
      switch (action.type) {
        case "add":
          // Prevent duplicates
          if (state.some((u) => u.unit_id === action.unit.unit_id)) {
            return state;
          }
          return [...state, action.unit];

        case "remove":
          // Prevent removing last unit
          if (state.length <= 1) {
            return state;
          }
          return state.filter((u) => u.unit_id !== action.unitId);

        default:
          return state;
      }
    }
  );

  const addUnitOptimistically = (unit: BookingUnit) => {
    setOptimisticUnits({ type: "add", unit });
  };

  const removeUnitOptimistically = (unitId: string) => {
    setOptimisticUnits({ type: "remove", unitId });
  };

  return {
    optimisticUnits,
    addUnitOptimistically,
    removeUnitOptimistically,
  };
}

// ============================================
// OPTIMISTIC BOOKING STATUS UPDATE
// ============================================

type StatusUpdateAction = { type: "update"; status: string };

/**
 * Optimistic booking status updates
 */
export function useOptimisticStatus(initialStatus: string | null) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<string | null, StatusUpdateAction>(
    initialStatus,
    (_state, action) => {
      return action.status;
    }
  );

  const updateStatusOptimistically = (status: string) => {
    setOptimisticStatus({ type: "update", status });
  };

  return {
    optimisticStatus,
    updateStatusOptimistically,
  };
}

// ============================================
// OPTIMISTIC PAYMENT STATUS UPDATE
// ============================================

/**
 * Optimistic payment status updates
 */
export function useOptimisticPaymentStatus(initialPaymentStatus: string | null) {
  const [optimisticPaymentStatus, setOptimisticPaymentStatus] = useOptimistic<
    string | null,
    StatusUpdateAction
  >(initialPaymentStatus, (_state, action) => {
    return action.status;
  });

  const updatePaymentStatusOptimistically = (status: string) => {
    setOptimisticPaymentStatus({ type: "update", status });
  };

  return {
    optimisticPaymentStatus,
    updatePaymentStatusOptimistically,
  };
}

// ============================================
// OPTIMISTIC TOTAL AMOUNT UPDATE
// ============================================

type AmountUpdateAction = { type: "update"; amount: number };

/**
 * Optimistic total amount updates (e.g., when adding/removing units)
 */
export function useOptimisticTotalAmount(initialAmount: number) {
  const [optimisticAmount, setOptimisticAmount] = useOptimistic<number, AmountUpdateAction>(
    initialAmount,
    (_state, action) => {
      return action.amount;
    }
  );

  const updateAmountOptimistically = (amount: number) => {
    setOptimisticAmount({ type: "update", amount });
  };

  return {
    optimisticAmount,
    updateAmountOptimistically,
  };
}

// ============================================
// COMBINED OPTIMISTIC BOOKING HOOK
// ============================================

/**
 * Combined hook for managing all optimistic states for a multi-unit booking
 */
export function useOptimisticBooking(initialBooking: MultiUnitBooking | null) {
  const { optimisticUnits, addUnitOptimistically, removeUnitOptimistically } =
    useOptimisticUnitManagement(initialBooking?.booking_units || []);

  const { optimisticStatus, updateStatusOptimistically } = useOptimisticStatus(
    initialBooking?.booking_status || null
  );

  const { optimisticPaymentStatus, updatePaymentStatusOptimistically } = useOptimisticPaymentStatus(
    initialBooking?.payment_status || null
  );

  const { optimisticAmount, updateAmountOptimistically } = useOptimisticTotalAmount(
    initialBooking?.total_amount || 0
  );

  const [isPending, startTransition] = useTransition();

  return {
    optimisticUnits,
    optimisticStatus,
    optimisticPaymentStatus,
    optimisticAmount,
    isPending,
    addUnitOptimistically,
    removeUnitOptimistically,
    updateStatusOptimistically,
    updatePaymentStatusOptimistically,
    updateAmountOptimistically,
    startTransition,
  };
}

// ============================================
// OPTIMISTIC GUEST ASSIGNMENT
// ============================================

type GuestAssignmentAction = {
  type: "assign";
  unitId: string;
  guestIds: string[];
  numGuests: number;
};

/**
 * Optimistic guest assignment to units
 */
export function useOptimisticGuestAssignment(initialUnits: BookingUnit[]) {
  const [optimisticUnits, setOptimisticUnits] = useOptimistic<BookingUnit[], GuestAssignmentAction>(
    initialUnits,
    (state, action) => {
      return state.map((unit) =>
        unit.unit_id === action.unitId
          ? {
              ...unit,
              guest_assignment: {
                guest_ids: action.guestIds,
                num_guests: action.numGuests,
                special_requests: unit.guest_assignment?.special_requests,
              },
            }
          : unit
      );
    }
  );

  const assignGuestsOptimistically = (unitId: string, guestIds: string[], numGuests: number) => {
    setOptimisticUnits({ type: "assign", unitId, guestIds, numGuests });
  };

  return {
    optimisticUnits,
    assignGuestsOptimistically,
  };
}

// ============================================
// OPTIMISTIC DISCOUNT APPLICATION
// ============================================

type DiscountAction = { type: "apply" | "clear"; amount?: number };

/**
 * Optimistic discount application
 */
export function useOptimisticDiscount(initialDiscount: number) {
  const [optimisticDiscount, setOptimisticDiscount] = useOptimistic<number, DiscountAction>(
    initialDiscount,
    (state, action) => {
      switch (action.type) {
        case "apply":
          return action.amount || 0;
        case "clear":
          return 0;
        default:
          return state;
      }
    }
  );

  const applyDiscountOptimistically = (amount: number) => {
    setOptimisticDiscount({ type: "apply", amount });
  };

  const clearDiscountOptimistically = () => {
    setOptimisticDiscount({ type: "clear" });
  };

  return {
    optimisticDiscount,
    applyDiscountOptimistically,
    clearDiscountOptimistically,
  };
}
