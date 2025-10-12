/**
 * Multi-Unit Booking Zustand Store (Phase 3)
 *
 * Comprehensive state management for multi-unit bookings with:
 * - Optimistic updates with automatic rollback
 * - Offline queue processing
 * - Conflict resolution
 * - Real-time pricing calculation
 * - Unit availability tracking
 *
 * @module useMultiUnitBookingStore
 */

import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import type { Draft } from "immer";
import type { MultiUnitBookingStore, OptimisticEntry } from "@/types";
import { dateDifference, isWeekend } from "@/utils/date-helpers";

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

// ============================================
// CONSTANTS
// ============================================

const MAX_UNITS_PER_BOOKING = 10;
const OPTIMISTIC_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_OPTIMISTIC_ENTRIES = 100;
const MAX_OFFLINE_RETRIES = 3;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useMultiUnitBookingStore = create<MultiUnitBookingStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          // ========== INITIAL STATE ==========

          bookings: new Map(),
          selectedBooking: null,
          draftBooking: null,
          selectedUnits: [],
          unitPricingCache: new Map(),
          availabilityCache: new Map(),
          optimisticQueue: new Map(),
          conflictResolutionStrategy: "last-write-wins",
          offlineQueue: [],
          isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
          isLoading: false,
          error: null,

          // ========== UNIT MANAGEMENT ==========

          addUnit: (unit) =>
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

              // Auto-calculate pricing if dates are set
              const booking = state.draftBooking || state.selectedBooking;
              if (booking?.check_in && booking?.check_out) {
                const pricing = get().calculateUnitPricing(
                  unit,
                  booking.check_in!,
                  booking.check_out!,
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
                  if (booking?.check_in && booking?.check_out) {
                    let baseAmount = 0;
                    let totalSurcharges = 0;

                    state.selectedUnits.forEach((unit) => {
                      const pricing = get().calculateUnitPricing(
                        unit,
                        booking.check_in!,
                        booking.check_out!,
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
                if (booking?.check_in && booking?.check_out) {
                  let baseAmount = 0;
                  let totalSurcharges = 0;

                  state.selectedUnits.forEach((unit) => {
                    const pricing = get().calculateUnitPricing(
                      unit,
                      booking.check_in!,
                      booking.check_out!,
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

          calculateUnitPricing: (unit, checkIn, checkOut, numGuests) => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = dateDifference(checkInDate, checkOutDate, "days");

            let baseTotal = 0;
            let weekendSurcharge = 0;

            // Calculate per-night pricing
            for (let i = 0; i < nights; i++) {
              const currentDate = new Date(checkInDate);
              currentDate.setDate(currentDate.getDate() + i);
              const isWeekendNight = isWeekend(currentDate);

              if (isWeekendNight && unit.weekend_rate > unit.base_rate) {
                baseTotal += unit.weekend_rate;
                weekendSurcharge += unit.weekend_rate - unit.base_rate;
              } else {
                baseTotal += unit.base_rate;
              }
            }

            // Calculate extra person fee
            const extraPersons = Math.max(0, numGuests - unit.base_occupancy);
            const extraPersonFee = extraPersons * unit.extra_person_rate * nights;

            return {
              nights,
              base_total: baseTotal,
              weekend_surcharge: weekendSurcharge,
              extra_person_fee: extraPersonFee,
              unit_total: baseTotal + extraPersonFee,
            };
          },

          recalculateTotalPricing: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const booking = state.draftBooking || state.selectedBooking;
              if (!booking?.check_in || !booking?.check_out) return;

              let baseAmount = 0;
              let totalSurcharges = 0;

              state.selectedUnits.forEach((unit) => {
                const pricing = get().calculateUnitPricing(
                  unit,
                  booking.check_in!,
                  booking.check_out!,
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
              if (booking?.check_in && booking?.check_out) {
                let baseAmount = 0;
                let totalSurcharges = 0;

                state.selectedUnits.forEach((unit) => {
                  const pricing = get().calculateUnitPricing(
                    unit,
                    booking.check_in!,
                    booking.check_out!,
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
              if (booking?.check_in && booking?.check_out) {
                let baseAmount = 0;
                let totalSurcharges = 0;

                state.selectedUnits.forEach((unit) => {
                  const pricing = get().calculateUnitPricing(
                    unit,
                    booking.check_in!,
                    booking.check_out!,
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

          // ========== AVAILABILITY CHECKING ==========

          checkUnitAvailability: async (unitId, checkIn, checkOut, checkFn?) => {
            // Check cache first
            const cacheKey = `${unitId}-${checkIn}-${checkOut}`;
            const cached = get().availabilityCache.get(cacheKey);

            if (cached && Date.now() - new Date(cached.last_checked || 0).getTime() < 60000) {
              return cached.is_available;
            }

            set((state: Draft<MultiUnitBookingStore>) => {
              state.availabilityCache.set(cacheKey, {
                is_available: false,
                checking: true,
                last_checked: new Date().toISOString(),
              });
            });

            try {
              const isAvailable = checkFn
                ? await checkFn()
                : await (async () => {
                    const response = await fetch(
                      `/api/availability/multi-unit?unit_ids=${unitId}&check_in=${checkIn}&check_out=${checkOut}`
                    );
                    if (!response.ok) throw new Error("Availability check failed");
                    const data = (await response.json()) as {
                      data: { results: Array<{ is_available: boolean }> };
                    };
                    return data.data.results[0].is_available;
                  })();

              set((state: Draft<MultiUnitBookingStore>) => {
                state.availabilityCache.set(cacheKey, {
                  is_available: isAvailable,
                  checking: false,
                  last_checked: new Date().toISOString(),
                });
              });

              return isAvailable;
            } catch (error) {
              set((state: Draft<MultiUnitBookingStore>) => {
                state.availabilityCache.set(cacheKey, {
                  is_available: false,
                  checking: false,
                  last_checked: new Date().toISOString(),
                });
                state.error = error as Error;
              });

              return false;
            }
          },

          checkMultiUnitAvailability: async (unitIds, checkIn, checkOut, checkFn?) => {
            const results: Array<{ unit_id: string; is_available: boolean }> = [];

            try {
              const data = checkFn
                ? await checkFn()
                : await (async () => {
                    const response = await fetch(
                      `/api/availability/multi-unit?unit_ids=${unitIds.join(",")}&check_in=${checkIn}&check_out=${checkOut}`
                    );
                    if (!response.ok) throw new Error("Availability check failed");
                    const json = (await response.json()) as { data: { results: any[] } };
                    return json.data.results;
                  })();

              data.forEach((result: any) => {
                const cacheKey = `${result.unit_id}-${checkIn}-${checkOut}`;
                set((state: Draft<MultiUnitBookingStore>) => {
                  state.availabilityCache.set(cacheKey, {
                    is_available: result.is_available,
                    checking: false,
                    last_checked: new Date().toISOString(),
                  });
                });
                results.push(result);
              });
            } catch (error) {
              set({ error: error as Error });
            }

            return results;
          },

          clearAvailabilityCache: (unitId?) => {
            if (unitId) {
              set((state: Draft<MultiUnitBookingStore>) => {
                const keysToDelete: string[] = [];
                state.availabilityCache.forEach((_, key) => {
                  if (key.startsWith(unitId)) {
                    keysToDelete.push(key);
                  }
                });
                keysToDelete.forEach((key) => state.availabilityCache.delete(key));
              });
            } else {
              set((state: Draft<MultiUnitBookingStore>) => {
                state.availabilityCache.clear();
              });
            }
          },

          checkAllUnitsAvailability: async () => {
            const booking = get().draftBooking || get().selectedBooking;
            if (!booking?.check_in || !booking?.check_out) {
              return new Map();
            }

            const results = new Map<string, boolean>();
            const unitIds = get().selectedUnits.map((u) => u.unit_id);

            try {
              const response = await fetch(
                `/api/availability/multi-unit?unit_ids=${unitIds.join(",")}&check_in=${booking.check_in}&check_out=${booking.check_out}`
              );

              if (!response.ok) throw new Error("Availability check failed");

              const data = (await response.json()) as { data: { results: any[] } };

              data.data.results.forEach((result: any) => {
                results.set(result.unit_id, result.is_available);

                set((state: Draft<MultiUnitBookingStore>) => {
                  const unit = state.selectedUnits.find((u) => u.unit_id === result.unit_id);
                  if (unit) {
                    unit.availability = {
                      is_available: result.is_available,
                      checking: false,
                      last_checked: new Date().toISOString(),
                      conflicts: result.conflicting_bookings,
                    };
                  }
                });
              });
            } catch (error) {
              set({ error: error as Error });
            }

            return results;
          },

          // ========== OPTIMISTIC UPDATES ==========

          addOptimisticBooking: (booking) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const entry: OptimisticEntry = {
                booking,
                timestamp: Date.now(),
                operation: "create",
                status: "pending",
              };

              state.optimisticQueue.set(booking.booking_id, entry);
              state.bookings.set(booking.booking_id, booking);

              // Enforce size limit
              if (state.optimisticQueue.size > MAX_OPTIMISTIC_ENTRIES) {
                const sortedEntries = Array.from(state.optimisticQueue.entries()).sort(
                  (a, b) => a[1].timestamp - b[1].timestamp
                );

                const toRemove = sortedEntries.slice(
                  0,
                  state.optimisticQueue.size - MAX_OPTIMISTIC_ENTRIES
                );
                toRemove.forEach(([id]) => state.optimisticQueue.delete(id));
              }
            }),

          updateOptimisticBooking: (bookingId, updates) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const existing = state.bookings.get(bookingId);
              if (existing) {
                const updated = { ...existing, ...updates };
                const entry: OptimisticEntry = {
                  booking: updated,
                  timestamp: Date.now(),
                  operation: "update",
                  status: "pending",
                };

                state.optimisticQueue.set(bookingId, entry);
                state.bookings.set(bookingId, updated);
              }
            }),

          removeOptimisticBooking: (bookingId) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.optimisticQueue.delete(bookingId);
            }),

          clearOptimisticEntry: (bookingId) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.optimisticQueue.delete(bookingId);
            }),

          clearExpiredOptimistic: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const now = Date.now();
              const toRemove: string[] = [];

              state.optimisticQueue.forEach((entry, id) => {
                if (now - entry.timestamp > OPTIMISTIC_TTL) {
                  toRemove.push(id);
                }
              });

              toRemove.forEach((id) => state.optimisticQueue.delete(id));
            }),

          syncFromRealtime: (booking) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const optimisticEntry = state.optimisticQueue.get(booking.booking_id);

              if (optimisticEntry) {
                // Conflict resolution
                const strategy = state.conflictResolutionStrategy;

                if (strategy === "last-write-wins") {
                  // Compare timestamps
                  const localTime = new Date(optimisticEntry.booking.updated_at || 0).getTime();
                  const serverTime = new Date(booking.updated_at || 0).getTime();

                  if (serverTime > localTime) {
                    state.selectedBooking = booking;
                    state.bookings.set(booking.booking_id, booking);
                  }
                } else if (strategy === "server-wins") {
                  state.selectedBooking = booking;
                  state.bookings.set(booking.booking_id, booking);
                }

                state.optimisticQueue.delete(booking.booking_id);
              } else {
                // No conflict
                state.selectedBooking = booking;
                state.bookings.set(booking.booking_id, booking);
              }
            }),

          resolveOptimisticConflict: (bookingId, serverData) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const optimisticEntry = state.optimisticQueue.get(bookingId);

              if (!optimisticEntry) {
                // No conflict, use server data
                state.bookings.set(bookingId, serverData);
                return;
              }

              switch (state.conflictResolutionStrategy) {
                case "last-write-wins":
                  // Keep optimistic update
                  break;

                case "server-wins":
                  // Use server data
                  state.bookings.set(bookingId, serverData);
                  break;

                case "user-prompt":
                  // Store both for UI to handle
                  console.log("Conflict detected:", {
                    optimistic: optimisticEntry.booking,
                    server: serverData,
                  });
                  break;
              }

              state.optimisticQueue.delete(bookingId);
            }),

          // ========== OFFLINE SUPPORT ==========

          addToOfflineQueue: (operation) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const { maxRetries = MAX_OFFLINE_RETRIES, ...rest } = operation;
              state.offlineQueue.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                retryCount: 0,
                maxRetries,
                ...rest,
              });
            }),

          processOfflineQueue: async (processFn?) => {
            const queue = get().offlineQueue;
            if (queue.length === 0 || !get().isOnline) return;

            for (const item of queue) {
              try {
                if (processFn) {
                  await processFn(item);
                } else {
                  console.log("Processing offline operation:", item);
                }

                // Remove from queue on success
                set((state: Draft<MultiUnitBookingStore>) => {
                  state.offlineQueue = state.offlineQueue.filter((q) => q.id !== item.id);
                });
              } catch (error) {
                // Increment retry count
                set((state: Draft<MultiUnitBookingStore>) => {
                  const queueItem = state.offlineQueue.find((q) => q.id === item.id);
                  if (queueItem) {
                    queueItem.retryCount++;

                    // Remove if too many retries
                    if (queueItem.retryCount >= (queueItem.maxRetries ?? MAX_OFFLINE_RETRIES)) {
                      state.offlineQueue = state.offlineQueue.filter((q) => q.id !== item.id);
                      console.error("Max retries exceeded for offline operation:", item);
                    }
                  }
                });
              }
            }
          },

          setOnlineStatus: (isOnline) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.isOnline = isOnline;

              if (isOnline) {
                // Process offline queue when coming online
                get().processOfflineQueue();
              }
            }),

          clearOfflineQueue: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.offlineQueue = [];
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

          setConflictResolutionStrategy: (strategy) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.conflictResolutionStrategy = strategy;
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
              state.bookings = new Map();
              state.selectedBooking = null;
              state.draftBooking = null;
              state.selectedUnits = [];
              state.unitPricingCache.clear();
              state.availabilityCache.clear();
              state.optimisticQueue.clear();
              state.offlineQueue = [];
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
            conflictResolutionStrategy: state.conflictResolutionStrategy,
            offlineQueue: state.offlineQueue,
          }),
        }
      ),
      {
        name: "MultiUnitBookingStore",
      }
    )
  )
);

// ============================================
// NETWORK STATUS LISTENER
// ============================================

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    useMultiUnitBookingStore.getState().setOnlineStatus(true);
  });

  window.addEventListener("offline", () => {
    useMultiUnitBookingStore.getState().setOnlineStatus(false);
  });
}

// ============================================
// AUTOMATIC CLEANUP
// ============================================

// Cleanup expired optimistic entries every minute
if (typeof window !== "undefined") {
  setInterval(() => {
    const store = useMultiUnitBookingStore.getState();
    const now = Date.now();

    store.optimisticQueue.forEach((entry, id) => {
      if (now - entry.timestamp > OPTIMISTIC_TTL) {
        store.removeOptimisticBooking(id);
      }
    });
  }, 60 * 1000);
}
