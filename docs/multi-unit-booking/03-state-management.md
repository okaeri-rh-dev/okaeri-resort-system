# Phase 3: State Management

**Phase Duration:** October 21-25, 2025 (Week 3 - 5 days)
**Lead Agent:** `zustand-tanstack-resort-architect`
**Status:** Not Started
**Dependencies:** Phase 2 (Backend API) must be complete

---

## Phase Overview

### Objectives

Design and implement comprehensive state management for multi-unit bookings using Zustand stores with Immer middleware and TanStack Query hooks, supporting optimistic updates, offline capabilities, and conflict resolution.

### Success Criteria

- [ ] Type-safe Zustand store implementation (TypeScript strict mode)
- [ ] Optimistic updates work correctly with automatic rollback on errors
- [ ] Offline queue processes operations when connection restored
- [ ] Conflict resolution handles concurrent edits gracefully
- [ ] 95% test coverage for state management logic
- [ ] State synchronization between units and pricing works seamlessly
- [ ] Real-time subscriptions functional via Supabase
- [ ] Migration utilities for backwards compatibility

### Key Deliverables

1. Multi-unit booking Zustand store
2. TanStack Query hooks for CRUD operations
3. Optimistic update patterns with React 19 useOptimistic
4. Offline queue management system
5. Conflict resolution strategies
6. State synchronization utilities
7. Migration helpers for backwards compatibility
8. Comprehensive unit and integration tests

---

## Agent Assignments

### Lead: `zustand-tanstack-resort-architect`

**Primary Responsibilities:**

- Design Zustand store architecture with Immer middleware
- Implement TanStack Query hooks for all CRUD operations
- Create optimistic update patterns using React 19 features
- Design and implement offline support with queue management
- Implement conflict resolution strategies
- Create state synchronization between units and pricing
- Design caching strategies for performance

**Deliverables:**

- `src/stores/useMultiUnitBookingStore.ts`
- `src/hooks/useMultiUnitBookingQueries.ts`
- `src/hooks/useOptimisticMultiUnit.ts`
- `src/hooks/useSyncUnitPricing.ts`
- `src/hooks/useMultiUnitRealtime.ts`
- Unit and integration tests

### Supporting: `typescript-react-quality-expert`

**Responsibilities:**

- Ensure type safety across all state management
- Review TypeScript interfaces and type definitions
- Validate code quality and patterns
- Ensure consistent coding standards

**Deliverables:**

- `src/types/multi-unit-booking.ts`
- Type definition review report
- Code quality review

### Supporting: `cloudflare-resort-api-architect`

**Responsibilities:**

- Ensure proper API integration
- Validate query/mutation implementations
- Review error handling patterns

---

## Store Architecture

### 1. Core Zustand Store Structure

**File:** `src/stores/useMultiUnitBookingStore.ts`

```typescript
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Draft } from "immer";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BookingUnit {
  // Unit identification
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string;

  // Unit capacity
  max_occupancy: number;
  base_occupancy: number;

  // Pricing
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;

  // Per-unit booking details
  guest_assignment?: {
    guest_ids: string[];
    num_guests: number;
    special_requests?: string;
  };

  // Per-unit pricing breakdown
  pricing: {
    nights: number;
    base_total: number;
    weekend_surcharge: number;
    extra_person_fee: number;
    unit_total: number;
  };

  // Availability tracking
  availability: {
    is_available: boolean;
    checking: boolean;
    last_checked?: string;
    conflicts?: number;
  };
}

interface MultiUnitBooking {
  booking_id: string;
  booking_reference: string;

  // Units
  booking_units: BookingUnit[];
  unit_count: number;
  is_multi_unit: boolean;

  // Primary guest
  primary_guest: {
    guest_id?: string | null;
    guest_name: string;
    contact_number: string;
    email: string;
  };

  // Booking dates
  check_in: string;
  check_out: string;

  // Totals
  total_guests: number;
  base_amount: number;
  total_surcharges: number;
  discount_amount: number;
  total_amount: number;

  // Status
  booking_status: string | null;
  payment_status: string | null;
  payment_method?: string | null;
  payment_proof_url?: string | null;

  // Notes
  special_requests?: string | null;
  internal_notes?: string | null;

  // Metadata
  created_at: string | null;
  updated_at: string | null;
}

interface OptimisticEntry {
  booking: MultiUnitBooking;
  timestamp: number;
  operation: "create" | "update" | "delete";
}

interface OfflineOperation {
  id: string;
  operation: "create" | "update" | "delete";
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// ============================================
// STORE INTERFACE
// ============================================

interface MultiUnitBookingStore {
  // ========== STATE ==========

  // Bookings collection
  bookings: Map<string, MultiUnitBooking>;
  selectedBooking: MultiUnitBooking | null;

  // Draft booking state (during creation)
  draftBooking: Partial<MultiUnitBooking> | null;
  selectedUnits: BookingUnit[];

  // Pricing cache
  unitPricingCache: Map<string, BookingUnit["pricing"]>;

  // Optimistic updates
  optimisticQueue: Map<string, OptimisticEntry>;
  conflictResolutionStrategy: "last-write-wins" | "server-wins" | "user-prompt";

  // Offline support
  offlineQueue: OfflineOperation[];
  isOnline: boolean;

  // UI state
  isLoading: boolean;
  error: Error | null;

  // ========== UNIT MANAGEMENT ACTIONS ==========

  addUnit: (unit: BookingUnit) => void;
  removeUnit: (unitId: string) => void;
  updateUnit: (unitId: string, updates: Partial<BookingUnit>) => void;
  assignGuestsToUnit: (unitId: string, guestIds: string[], numGuests: number) => void;
  reorderUnits: (fromIndex: number, toIndex: number) => void;

  // ========== PRICING ACTIONS ==========

  calculateUnitPricing: (
    unit: BookingUnit,
    checkIn: string,
    checkOut: string,
    numGuests: number
  ) => BookingUnit["pricing"];

  recalculateTotalPricing: () => void;
  applyBulkDiscount: (discountPercent: number) => void;
  clearDiscount: () => void;

  // ========== AVAILABILITY ACTIONS ==========

  checkUnitAvailability: (unitId: string, checkIn: string, checkOut: string) => Promise<boolean>;

  checkAllUnitsAvailability: () => Promise<Map<string, boolean>>;

  // ========== OPTIMISTIC UPDATE ACTIONS ==========

  addOptimisticBooking: (booking: MultiUnitBooking) => void;
  updateOptimisticBooking: (bookingId: string, updates: Partial<MultiUnitBooking>) => void;
  removeOptimisticBooking: (bookingId: string) => void;
  resolveOptimisticConflict: (bookingId: string, serverData: MultiUnitBooking) => void;

  // ========== OFFLINE SUPPORT ACTIONS ==========

  addToOfflineQueue: (operation: Omit<OfflineOperation, "id" | "timestamp" | "retryCount">) => void;
  processOfflineQueue: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  clearOfflineQueue: () => void;

  // ========== STATE MANAGEMENT ACTIONS ==========

  setSelectedBooking: (booking: MultiUnitBooking | null) => void;
  clearDraftBooking: () => void;
  saveDraftBooking: () => void;
  loadDraftBooking: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  // ========== COMPUTED VALUES ==========

  getTotalAmount: () => number;
  getTotalGuests: () => number;
  getUnitCount: () => number;
  canAddMoreUnits: (maxUnits?: number) => boolean;
  hasUnavailableUnits: () => boolean;
  getUnavailableUnits: () => BookingUnit[];
}

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
          optimisticQueue: new Map(),
          conflictResolutionStrategy: "user-prompt",
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
                  booking.check_in,
                  booking.check_out,
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

                // Recalculate pricing if guest assignment changed
                if (updates.guest_assignment) {
                  get().recalculateTotalPricing();
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

                // Trigger pricing recalculation
                get().recalculateTotalPricing();
              }
            }),

          reorderUnits: (fromIndex, toIndex) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              const units = [...state.selectedUnits];
              const [removed] = units.splice(fromIndex, 1);
              units.splice(toIndex, 0, removed);
              state.selectedUnits = units;
            }),

          // ========== PRICING CALCULATIONS ==========

          calculateUnitPricing: (unit, checkIn, checkOut, numGuests) => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = Math.ceil(
              (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            let baseTotal = 0;
            let weekendSurcharge = 0;

            // Calculate per-night pricing
            for (let i = 0; i < nights; i++) {
              const currentDate = new Date(checkInDate);
              currentDate.setDate(currentDate.getDate() + i);
              const dayOfWeek = currentDate.getDay();
              const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

              if (isWeekend && unit.weekend_rate > unit.base_rate) {
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
                  booking.check_in,
                  booking.check_out,
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
              const subtotal = get().getTotalAmount();
              const discountAmount = subtotal * (discountPercent / 100);

              if (state.draftBooking) {
                state.draftBooking.discount_amount = discountAmount;
              }
              if (state.selectedBooking) {
                state.selectedBooking.discount_amount = discountAmount;
              }

              get().recalculateTotalPricing();
            }),

          clearDiscount: () =>
            set((state: Draft<MultiUnitBookingStore>) => {
              if (state.draftBooking) {
                state.draftBooking.discount_amount = 0;
              }
              if (state.selectedBooking) {
                state.selectedBooking.discount_amount = 0;
              }

              get().recalculateTotalPricing();
            }),

          // ========== AVAILABILITY CHECKING ==========

          checkUnitAvailability: async (unitId, checkIn, checkOut) => {
            set((state: Draft<MultiUnitBookingStore>) => {
              const unit = state.selectedUnits.find((u) => u.unit_id === unitId);
              if (unit) {
                unit.availability.checking = true;
              }
            });

            try {
              // API call to check availability
              const response = await fetch(
                `/api/availability/multi-unit?unit_ids=${unitId}&check_in=${checkIn}&check_out=${checkOut}`
              );

              if (!response.ok) throw new Error("Availability check failed");

              const data = await response.json();
              const result = data.data.results[0];

              set((state: Draft<MultiUnitBookingStore>) => {
                const unit = state.selectedUnits.find((u) => u.unit_id === unitId);
                if (unit) {
                  unit.availability = {
                    is_available: result.is_available,
                    checking: false,
                    last_checked: new Date().toISOString(),
                    conflicts: result.conflicting_bookings,
                  };
                }
              });

              return result.is_available;
            } catch (error) {
              set((state: Draft<MultiUnitBookingStore>) => {
                const unit = state.selectedUnits.find((u) => u.unit_id === unitId);
                if (unit) {
                  unit.availability.checking = false;
                }
                state.error = error as Error;
              });

              return false;
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

              const data = await response.json();

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
                };

                state.optimisticQueue.set(bookingId, entry);
                state.bookings.set(bookingId, updated);
              }
            }),

          removeOptimisticBooking: (bookingId) =>
            set((state: Draft<MultiUnitBookingStore>) => {
              state.optimisticQueue.delete(bookingId);
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
              state.offlineQueue.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                retryCount: 0,
                maxRetries: MAX_OFFLINE_RETRIES,
                ...operation,
              });
            }),

          processOfflineQueue: async () => {
            const queue = get().offlineQueue;
            if (queue.length === 0 || !get().isOnline) return;

            for (const item of queue) {
              try {
                // Process each queued operation
                // This would call the actual API
                console.log("Processing offline operation:", item);

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
                    if (queueItem.retryCount >= queueItem.maxRetries) {
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
```

**Key Design Decisions:**

1. **Immer Middleware**: Enables immutable updates with mutable syntax
2. **Subscriptions**: `subscribeWithSelector` for fine-grained reactivity
3. **Persistence**: Draft booking saved to sessionStorage
4. **Optimistic Updates**: Automatic TTL-based cleanup
5. **Offline Support**: Queue with retry logic
6. **Conflict Resolution**: Configurable strategies

---

## TanStack Query Hooks

**File:** `src/hooks/useMultiUnitBookingQueries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch multi-unit bookings with optimistic updates merged
 */
export const useMultiUnitBookings = (filters?: any) => {
  const optimisticQueue = useMultiUnitBookingStore((state) => state.optimisticQueue);

  return useQuery({
    queryKey: ["multi-unit-bookings", filters],
    queryFn: async () => {
      const response = await fetch("/api/bookings/multi-unit");
      if (!response.ok) throw new Error("Failed to fetch bookings");

      const data = await response.json();

      // Merge optimistic updates
      const mergedBookings = data.data.map((booking: any) => {
        const optimistic = optimisticQueue.get(booking.booking_id);
        return optimistic ? { ...booking, ...optimistic.booking } : booking;
      });

      return mergedBookings;
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
};

/**
 * Check availability for multiple units
 */
export const useMultiUnitAvailability = (
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean } = {}
) => {
  return useQuery({
    queryKey: ["multi-unit-availability", unitIds, checkIn, checkOut],
    queryFn: async () => {
      const params = new URLSearchParams({
        unit_ids: unitIds.join(","),
        check_in: checkIn,
        check_out: checkOut,
      });

      const response = await fetch(`/api/availability/multi-unit?${params}`);
      if (!response.ok) throw new Error("Availability check failed");

      const data = await response.json();
      return data.data.results;
    },
    enabled: options.enabled !== false && unitIds.length > 0 && !!checkIn && !!checkOut,
    staleTime: 300000, // 5 minutes
  });
};

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create multi-unit booking with optimistic updates
 */
export const useCreateMultiUnitBooking = () => {
  const queryClient = useQueryClient();
  const { addOptimisticBooking, removeOptimisticBooking, addToOfflineQueue, isOnline } =
    useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (bookingData: any) => {
      if (!isOnline) {
        addToOfflineQueue({ operation: "create", data: bookingData });
        return bookingData;
      }

      const response = await fetch("/api/bookings/multi-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) throw new Error("Failed to create booking");

      const data = await response.json();
      return data.data;
    },
    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings"] });

      const optimisticBooking = {
        booking_id: `temp-${Date.now()}`,
        booking_reference: `BK-${Date.now()}`,
        ...newBooking,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addOptimisticBooking(optimisticBooking);

      return { optimisticBooking };
    },
    onError: (err, variables, context) => {
      if (context?.optimisticBooking) {
        removeOptimisticBooking(context.optimisticBooking.booking_id);
      }
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimisticBooking) {
        removeOptimisticBooking(context.optimisticBooking.booking_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["unit-availability"] });
    },
  });
};

// ... (Additional mutation hooks for add/remove unit, etc.)
```

---

## Testing Requirements

### Unit Tests

**File:** `src/stores/__tests__/useMultiUnitBookingStore.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiUnitBookingStore } from "../useMultiUnitBookingStore";

describe("useMultiUnitBookingStore", () => {
  beforeEach(() => {
    const { result } = renderHook(() => useMultiUnitBookingStore());
    act(() => {
      result.current.clearDraftBooking();
    });
  });

  describe("Unit Management", () => {
    it("should add a unit to selected units", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const mockUnit = {
        unit_id: "unit-1",
        unit_name: "Deluxe Cabin",
        // ... other properties
      };

      act(() => {
        result.current.addUnit(mockUnit);
      });

      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.selectedUnits[0].unit_id).toBe("unit-1");
    });

    it("should prevent adding duplicate units", () => {
      // ... test
    });

    it("should prevent adding more than max units", () => {
      // ... test
    });

    it("should remove a unit from selected units", () => {
      // ... test
    });

    it("should prevent removing the last unit", () => {
      // ... test
    });
  });

  describe("Pricing Calculations", () => {
    it("should calculate unit pricing correctly", () => {
      // ... test with weekend surcharges, extra persons
    });

    it("should recalculate total pricing when units change", () => {
      // ... test
    });

    it("should apply bulk discount correctly", () => {
      // ... test
    });
  });

  describe("Optimistic Updates", () => {
    it("should add optimistic booking", () => {
      // ... test
    });

    it("should remove optimistic booking", () => {
      // ... test
    });

    it("should resolve conflicts with server-wins strategy", () => {
      // ... test
    });
  });

  describe("Offline Support", () => {
    it("should add operation to offline queue when offline", () => {
      // ... test
    });

    it("should process offline queue when coming online", () => {
      // ... test
    });

    it("should retry failed operations", () => {
      // ... test
    });

    it("should remove operation after max retries", () => {
      // ... test
    });
  });
});
```

### Coverage Target: ≥95%

---

## Acceptance Criteria

### Phase Completion Checklist

- [ ] Zustand store implemented with all actions
- [ ] TanStack Query hooks for all CRUD operations
- [ ] Optimistic updates working with rollback
- [ ] Offline queue processes successfully
- [ ] Conflict resolution strategies implemented
- [ ] State synchronization between units and pricing
- [ ] Real-time subscriptions via Supabase working
- [ ] Migration utilities for backwards compatibility
- [ ] ≥95% test coverage achieved
- [ ] Type safety validated (no `any` types)
- [ ] Performance benchmarks met
- [ ] Documentation complete

### Sign-Off Requirements

- [ ] `zustand-tanstack-resort-architect` - Implementation complete
- [ ] `typescript-react-quality-expert` - Type safety approved
- [ ] `cloudflare-resort-api-architect` - API integration verified
- [ ] `code-quality-reviewer` - Code quality approved

---

## Next Phase Dependencies

**Phase 4 (UI Components) depends on:**

- [ ] useMultiUnitBookingStore available and tested
- [ ] TanStack Query hooks functional
- [ ] Optimistic update patterns working
- [ ] Type definitions complete

---

## References

- Zustand Documentation: https://zustand-demo.pmnd.rs/
- Immer Middleware: https://immerjs.github.io/immer/
- TanStack Query: https://tanstack.com/query/latest
- React 19 useOptimistic: https://react.dev/reference/react/useOptimistic
