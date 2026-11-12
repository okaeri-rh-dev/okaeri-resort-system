/**
 * Multi-Unit Booking Zustand Store (Phase 3)
 *
 * Draft state for the staff multi-unit booking form: selected units,
 * guest assignments and pricing.
 *
 * @module useMultiUnitBookingStore
 */

import type { Draft } from "immer";
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { priceCabin } from "@/lib/pricing/cabin-pricing";
import type { MultiUnitBookingStore } from "@/types";

// ============================================
// CONSTANTS
// ============================================

const MAX_UNITS_PER_BOOKING = 10;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useMultiUnitBookingStore = create<MultiUnitBookingStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          // ========== INITIAL STATE ==========

          draftBooking: null,
          selectedUnits: [],
          error: null,

          // ========== UNIT MANAGEMENT ==========

          addUnit: (unit, checkIn?, checkOut?) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              // Prevent duplicates
              const exists = state.selectedUnits.some((u) => u.unit_id === unit.unit_id);
              if (exists) {
                state.error = new Error("Unit already added to booking");
                return;
              }

              // Check max units limit
              if (state.selectedUnits.length >= MAX_UNITS_PER_BOOKING) {
                state.error = new Error(`Maximum ${MAX_UNITS_PER_BOOKING} units per booking`);
                return;
              }

              // Add unit
              state.selectedUnits.push(unit);

              // Auto-calculate pricing if dates are available
              // Priority: 1. Passed dates, 2. Draft booking dates
              const effectiveCheckIn = checkIn || state.draftBooking?.check_in;
              const effectiveCheckOut = checkOut || state.draftBooking?.check_out;

              if (effectiveCheckIn && effectiveCheckOut) {
                // Convert Date objects to ISO strings for calculateUnitPricing
                const checkInStr =
                  effectiveCheckIn instanceof Date
                    ? effectiveCheckIn.toISOString()
                    : effectiveCheckIn;
                const checkOutStr =
                  effectiveCheckOut instanceof Date
                    ? effectiveCheckOut.toISOString()
                    : effectiveCheckOut;

                unit.pricing = get().calculateUnitPricing(
                  unit,
                  checkInStr,
                  checkOutStr,
                  unit.guest_assignment?.num_guests || unit.base_occupancy
                );
              }

              state.error = null;
            }),

          removeUnit: (unitId) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              // Prevent removing last unit
              if (state.selectedUnits.length <= 1) {
                state.error = new Error("Cannot remove the last unit from booking");
                return;
              }

              // Remove unit
              state.selectedUnits = state.selectedUnits.filter((u) => u.unit_id !== unitId);
              state.error = null;
            }),

          assignGuestsToUnit: (unitId, guestIds, numGuests) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const unit = state.selectedUnits.find((u) => u.unit_id === unitId);
              if (unit) {
                unit.guest_assignment = {
                  guest_ids: guestIds,
                  num_guests: numGuests,
                  special_requests: unit.guest_assignment?.special_requests,
                };

                // Inline pricing recalculation
                const draft = state.draftBooking;
                const checkIn = draft?.check_in;
                const checkOut = draft?.check_out;
                if (draft && checkIn && checkOut) {
                  let baseAmount = 0;
                  let totalSurcharges = 0;

                  state.selectedUnits.forEach((unit) => {
                    const pricing = get().calculateUnitPricing(
                      unit,
                      checkIn,
                      checkOut,
                      unit.guest_assignment?.num_guests || unit.base_occupancy
                    );

                    unit.pricing = pricing;
                    baseAmount += pricing.base_total;
                    totalSurcharges += pricing.weekend_surcharge + pricing.extra_person_fee;
                  });

                  draft.base_amount = baseAmount;
                  draft.total_surcharges = totalSurcharges;
                  draft.total_amount = baseAmount + totalSurcharges - (draft.discount_amount || 0);
                }
              }
            }),

          // ========== PRICING CALCULATIONS ==========

          calculateUnitPricing: (unit, checkIn, checkOut, numGuests) =>
            priceCabin(unit, checkIn, checkOut, numGuests),

          // ========== STATE MANAGEMENT ==========

          clearDraftBooking: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.draftBooking = null;
              state.selectedUnits = [];
              state.error = null;
            }),
        })),
        {
          name: "multi-unit-booking-store",
          partialize: (state) => ({
            draftBooking: state.draftBooking,
          }),
        }
      ),
      {
        name: "MultiUnitBookingStore",
      }
    )
  )
);
