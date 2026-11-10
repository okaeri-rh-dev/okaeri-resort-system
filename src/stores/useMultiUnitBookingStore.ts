/**
 * Multi-Unit Booking Zustand Store (Phase 3)
 *
 * Draft state for the staff multi-unit booking form: selected units,
 * guest assignments and pricing.
 *
 * @module useMultiUnitBookingStore
 */

import { enableMapSet, type Draft } from "immer";
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { priceCabin } from "@/lib/pricing/cabin-pricing";
import type { MultiUnitBookingStore } from "@/types";

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

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

          selectedBooking: null,
          draftBooking: null,
          selectedUnits: [],
          unitPricingCache: new Map(),
          isLoading: false,
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
              // Priority: 1. Passed dates, 2. Draft/selected booking dates
              const booking = state.draftBooking || state.selectedBooking;
              const effectiveCheckIn = checkIn || booking?.check_in;
              const effectiveCheckOut = checkOut || booking?.check_out;

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

                const pricing = get().calculateUnitPricing(
                  unit,
                  checkInStr,
                  checkOutStr,
                  unit.guest_assignment?.num_guests || unit.base_occupancy
                );
                unit.pricing = pricing;
                state.unitPricingCache.set(unit.unit_id, pricing);
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
              state.unitPricingCache.delete(unitId);
              state.error = null;
            }),

          updateUnit: (unitId, updates) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const unitIndex = state.selectedUnits.findIndex((u) => u.unit_id === unitId);
              if (unitIndex !== -1) {
                Object.assign(state.selectedUnits[unitIndex], updates);

                // Inline pricing recalculation if guest assignment changed
                if (updates.guest_assignment) {
                  const booking = state.draftBooking || state.selectedBooking;
                  const checkIn = booking?.check_in;
                  const checkOut = booking?.check_out;
                  if (checkIn && checkOut) {
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
                      state.unitPricingCache.set(unit.unit_id, pricing);
                    });

                    const subtotal = baseAmount + totalSurcharges;
                    const discountAmount = state.draftBooking?.discount_amount || 0;
                    const totalAmount = subtotal - discountAmount;

                    if (state.draftBooking) {
                      state.draftBooking.base_amount = baseAmount;
                      state.draftBooking.total_surcharges = totalSurcharges;
                      state.draftBooking.total_amount = totalAmount;
                    }
                    if (state.selectedBooking) {
                      state.selectedBooking.base_amount = baseAmount;
                      state.selectedBooking.total_surcharges = totalSurcharges;
                      state.selectedBooking.total_amount = totalAmount;
                    }
                  }
                }
              }
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
                const booking = state.draftBooking || state.selectedBooking;
                const checkIn = booking?.check_in;
                const checkOut = booking?.check_out;
                if (checkIn && checkOut) {
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
                    state.unitPricingCache.set(unit.unit_id, pricing);
                  });

                  const subtotal = baseAmount + totalSurcharges;
                  const discountAmount = state.draftBooking?.discount_amount || 0;
                  const totalAmount = subtotal - discountAmount;

                  if (state.draftBooking) {
                    state.draftBooking.base_amount = baseAmount;
                    state.draftBooking.total_surcharges = totalSurcharges;
                    state.draftBooking.total_amount = totalAmount;
                  }
                  if (state.selectedBooking) {
                    state.selectedBooking.base_amount = baseAmount;
                    state.selectedBooking.total_surcharges = totalSurcharges;
                    state.selectedBooking.total_amount = totalAmount;
                  }
                }
              }
            }),

          reorderUnits: (fromIndex, toIndex) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const units = [...state.selectedUnits];
              const [removed] = units.splice(fromIndex, 1);
              units.splice(toIndex, 0, removed);
              state.selectedUnits = units;
            }),

          selectUnit: (_unitId) =>
            set((_state: Draft<MultiUnitBookingStore>) => {
              // Update selectedUnits to mark the selected unit
              // Note: BookingUnit doesn't have isSelected - this is a no-op for now
              // Could be extended to track selection in a separate state if needed
            }),

          // ========== PRICING CALCULATIONS ==========

          calculateUnitPricing: (unit, checkIn, checkOut, numGuests) =>
            priceCabin(unit, checkIn, checkOut, numGuests),

          recalculateTotalPricing: (checkIn?, checkOut?) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              // Priority: 1. Passed dates, 2. Draft/selected booking dates
              const booking = state.draftBooking || state.selectedBooking;
              const effectiveCheckIn = checkIn || booking?.check_in;
              const effectiveCheckOut = checkOut || booking?.check_out;

              if (!effectiveCheckIn || !effectiveCheckOut) return;

              // Convert Date objects to ISO strings for calculateUnitPricing
              const checkInStr =
                effectiveCheckIn instanceof Date
                  ? effectiveCheckIn.toISOString()
                  : effectiveCheckIn;
              const checkOutStr =
                effectiveCheckOut instanceof Date
                  ? effectiveCheckOut.toISOString()
                  : effectiveCheckOut;

              let baseAmount = 0;
              let totalSurcharges = 0;

              state.selectedUnits.forEach((unit) => {
                const pricing = get().calculateUnitPricing(
                  unit,
                  checkInStr,
                  checkOutStr,
                  unit.guest_assignment?.num_guests || unit.base_occupancy
                );

                unit.pricing = pricing;
                baseAmount += pricing.base_total;
                totalSurcharges += pricing.weekend_surcharge + pricing.extra_person_fee;
                state.unitPricingCache.set(unit.unit_id, pricing);
              });

              const subtotal = baseAmount + totalSurcharges;
              const discountAmount = state.draftBooking?.discount_amount || 0;
              const totalAmount = subtotal - discountAmount;

              if (state.draftBooking) {
                state.draftBooking.base_amount = baseAmount;
                state.draftBooking.total_surcharges = totalSurcharges;
                state.draftBooking.total_amount = totalAmount;
              }
              if (state.selectedBooking) {
                state.selectedBooking.base_amount = baseAmount;
                state.selectedBooking.total_surcharges = totalSurcharges;
                state.selectedBooking.total_amount = totalAmount;
              }
            }),

          applyBulkDiscount: (discountPercent) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              // Calculate discount
              const subtotal = get().getTotalAmount();
              const discountAmount = subtotal * (discountPercent / 100);

              if (state.draftBooking) {
                state.draftBooking.discount_amount = discountAmount;
              }
              if (state.selectedBooking) {
                state.selectedBooking.discount_amount = discountAmount;
              }

              // Inline pricing recalculation
              const booking = state.draftBooking || state.selectedBooking;
              const checkIn = booking?.check_in;
              const checkOut = booking?.check_out;
              if (checkIn && checkOut) {
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
                  state.unitPricingCache.set(unit.unit_id, pricing);
                });

                const newSubtotal = baseAmount + totalSurcharges;
                const totalAmount = newSubtotal - discountAmount;

                if (state.draftBooking) {
                  state.draftBooking.base_amount = baseAmount;
                  state.draftBooking.total_surcharges = totalSurcharges;
                  state.draftBooking.total_amount = totalAmount;
                }
                if (state.selectedBooking) {
                  state.selectedBooking.base_amount = baseAmount;
                  state.selectedBooking.total_surcharges = totalSurcharges;
                  state.selectedBooking.total_amount = totalAmount;
                }
              }
            }),

          clearDiscount: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              if (state.draftBooking) {
                state.draftBooking.discount_amount = 0;
              }
              if (state.selectedBooking) {
                state.selectedBooking.discount_amount = 0;
              }

              // Inline pricing recalculation
              const booking = state.draftBooking || state.selectedBooking;
              const checkIn = booking?.check_in;
              const checkOut = booking?.check_out;
              if (checkIn && checkOut) {
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
                  state.unitPricingCache.set(unit.unit_id, pricing);
                });

                const subtotal = baseAmount + totalSurcharges;
                const totalAmount = subtotal; // No discount

                if (state.draftBooking) {
                  state.draftBooking.base_amount = baseAmount;
                  state.draftBooking.total_surcharges = totalSurcharges;
                  state.draftBooking.total_amount = totalAmount;
                }
                if (state.selectedBooking) {
                  state.selectedBooking.base_amount = baseAmount;
                  state.selectedBooking.total_surcharges = totalSurcharges;
                  state.selectedBooking.total_amount = totalAmount;
                }
              }
            }),

          // ========== STATE MANAGEMENT ==========

          setSelectedBooking: (booking) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.selectedBooking = booking;
              if (booking) {
                state.selectedUnits = booking.booking_units || [];
              }
            }),

          setDraftBooking: (booking) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.draftBooking = booking;
            }),

          clearDraftBooking: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.draftBooking = null;
              state.selectedUnits = [];
              state.unitPricingCache.clear();
              state.error = null;
            }),

          saveDraftBooking: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              if (state.selectedUnits.length > 0) {
                state.draftBooking = {
                  booking_units: state.selectedUnits,
                  total_amount: get().getTotalAmount(),
                  total_guests: get().getTotalGuests(),
                  unit_count: state.selectedUnits.length,
                  is_multi_unit: state.selectedUnits.length > 1,
                };
              }
            }),

          loadDraftBooking: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              if (state.draftBooking) {
                state.selectedUnits = state.draftBooking.booking_units || [];
              }
            }),

          setLoading: (loading) => set({ isLoading: loading }),

          setError: (error) => set({ error }),

          reset: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.selectedBooking = null;
              state.draftBooking = null;
              state.selectedUnits = [];
              state.unitPricingCache.clear();
              state.isLoading = false;
              state.error = null;
            }),

          // ========== COMPUTED VALUES ==========

          getTotalAmount: () => {
            return get().selectedUnits.reduce(
              (sum, unit) => sum + (unit.pricing?.unit_total || 0),
              0
            );
          },

          getTotalGuests: () => {
            return get().selectedUnits.reduce(
              (sum, unit) => sum + (unit.guest_assignment?.num_guests || 0),
              0
            );
          },

          getUnitCount: () => {
            return get().selectedUnits.length;
          },

          canAddMoreUnits: (maxUnits = MAX_UNITS_PER_BOOKING) => {
            return get().selectedUnits.length < maxUnits;
          },

          hasUnavailableUnits: () => {
            return get().selectedUnits.some((unit) => unit.availability.is_available === false);
          },

          getUnavailableUnits: () => {
            return get().selectedUnits.filter((unit) => unit.availability.is_available === false);
          },
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
