/**
 * Multi-Unit Booking Zustand Store
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

const MAX_UNITS_PER_BOOKING = 10;

export const useMultiUnitBookingStore = create<MultiUnitBookingStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          draftBooking: null,
          selectedUnits: [],
          error: null,

          addUnit: (unit, checkIn?, checkOut?) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const exists = state.selectedUnits.some((u) => u.unit_id === unit.unit_id);
              if (exists) {
                state.error = new Error("Unit already added to booking");
                return;
              }

              if (state.selectedUnits.length >= MAX_UNITS_PER_BOOKING) {
                state.error = new Error(`Maximum ${MAX_UNITS_PER_BOOKING} units per booking`);
                return;
              }

              state.selectedUnits.push(unit);

              // Priority: 1. Passed dates, 2. Draft booking dates
              const effectiveCheckIn = checkIn || state.draftBooking?.check_in;
              const effectiveCheckOut = checkOut || state.draftBooking?.check_out;

              if (effectiveCheckIn && effectiveCheckOut) {
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
              if (state.selectedUnits.length <= 1) {
                state.error = new Error("Cannot remove the last unit from booking");
                return;
              }

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

                const draft = state.draftBooking;
                const checkIn = draft?.check_in;
                const checkOut = draft?.check_out;
                if (draft && checkIn && checkOut) {
                  let baseAmount = 0;
                  let totalSurcharges = 0;

                  state.selectedUnits.forEach((selected) => {
                    const pricing = get().calculateUnitPricing(
                      selected,
                      checkIn,
                      checkOut,
                      selected.guest_assignment?.num_guests || selected.base_occupancy
                    );

                    selected.pricing = pricing;
                    baseAmount += pricing.base_total;
                    totalSurcharges += pricing.weekend_surcharge + pricing.extra_person_fee;
                  });

                  draft.base_amount = baseAmount;
                  draft.total_surcharges = totalSurcharges;
                  draft.total_amount = baseAmount + totalSurcharges - (draft.discount_amount || 0);
                }
              }
            }),

          calculateUnitPricing: (unit, checkIn, checkOut, numGuests) =>
            priceCabin(unit, checkIn, checkOut, numGuests),

          setDraftBooking: (booking) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.draftBooking = booking;
            }),

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
