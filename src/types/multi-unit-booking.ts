/**
 * Type definitions for Multi-Unit Booking System (Phase 3)
 *
 * Supports booking multiple units in a single transaction with unified payment,
 * optimistic updates, offline capabilities, and conflict resolution.
 *
 * @module MultiUnitBookingTypes
 */

// ============================================
// BOOKING UNIT TYPES
// ============================================

export interface BookingUnit {
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

// ============================================
// MULTI-UNIT BOOKING TYPES
// ============================================

export interface MultiUnitBooking {
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

// ============================================
// ADMIN BOOKING CREATION TYPES
// ============================================

/**
 * Unit assignment for admin booking creation
 * Simplified structure for the admin multi-unit booking form
 */
export interface AdminBookingUnitCreate {
  unit_id: string;
  num_guests: number;
  guest_assignment?: {
    guest_ids?: string[];
    num_guests: number;
    special_requests?: string;
  };
  unit_notes?: string;
}

/**
 * Admin multi-unit booking creation request
 * Used by the admin panel to create bookings with multiple units
 */
export interface AdminMultiUnitBookingCreate {
  primary_guest: {
    guest_name: string;
    email: string;
    contact_number: string;
  };
  check_in: string;
  check_out: string;
  units: AdminBookingUnitCreate[];
  payment?: {
    method: string;
    amount: number;
    proof_url?: string;
  };
  special_requests?: string;
  internal_notes?: string;
  is_walk_in?: boolean;
  source?: string;
  idempotency_key?: string;
}

// ============================================
// OPTIMISTIC UPDATE TYPES
// ============================================

export interface OptimisticEntry {
  booking: MultiUnitBooking;
  timestamp: number;
  operation: "create" | "update" | "delete";
  status?: "pending" | "success" | "error";
}

// ============================================
// OFFLINE SUPPORT TYPES
// ============================================

export interface OfflineOperation {
  id: string;
  operation: "create" | "update" | "delete";
  data: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries?: number;
}

// ============================================
// STORE STATE TYPES
// ============================================

export type ConflictResolutionStrategy = "last-write-wins" | "server-wins" | "user-prompt";

export interface AvailabilityStatus {
  is_available: boolean;
  checking: boolean;
  last_checked?: string;
  conflicts?: number;
}

export interface MultiUnitBookingState {
  // Bookings collection
  bookings: Map<string, MultiUnitBooking>;
  selectedBooking: MultiUnitBooking | null;

  // Draft booking state (during creation)
  draftBooking: Partial<MultiUnitBooking> | null;
  selectedUnits: BookingUnit[];

  // Pricing cache
  unitPricingCache: Map<string, BookingUnit["pricing"]>;

  // Availability cache
  availabilityCache: Map<string, AvailabilityStatus>;

  // Optimistic updates
  optimisticQueue: Map<string, OptimisticEntry>;
  conflictResolutionStrategy: ConflictResolutionStrategy;

  // Offline support
  offlineQueue: OfflineOperation[];
  isOnline: boolean;

  // UI state
  isLoading: boolean;
  error: Error | null;
}

// ============================================
// STORE ACTION TYPES
// ============================================

export interface MultiUnitBookingActions {
  // ========== UNIT MANAGEMENT ACTIONS ==========

  addUnit: (unit: BookingUnit, checkIn?: string | Date, checkOut?: string | Date) => void;
  removeUnit: (unitId: string) => void;
  updateUnit: (unitId: string, updates: Partial<BookingUnit>) => void;
  assignGuestsToUnit: (unitId: string, guestIds: string[], numGuests: number) => void;
  reorderUnits: (fromIndex: number, toIndex: number) => void;
  selectUnit: (unitId: string) => void;

  // ========== PRICING ACTIONS ==========

  calculateUnitPricing: (
    unit: BookingUnit,
    checkIn: string,
    checkOut: string,
    numGuests: number
  ) => BookingUnit["pricing"];

  recalculateTotalPricing: (checkIn?: string | Date, checkOut?: string | Date) => void;
  applyBulkDiscount: (discountPercent: number) => void;
  clearDiscount: () => void;

  // ========== AVAILABILITY ACTIONS ==========

  checkUnitAvailability: (
    unitId: string,
    checkIn: string,
    checkOut: string,
    checkFn?: () => Promise<boolean>
  ) => Promise<boolean>;

  checkMultiUnitAvailability: (
    unitIds: string[],
    checkIn: string,
    checkOut: string,
    checkFn?: () => Promise<unknown>
  ) => Promise<Array<{ unit_id: string; is_available: boolean }>>;

  clearAvailabilityCache: (unitId?: string) => void;

  checkAllUnitsAvailability: () => Promise<Map<string, boolean>>;

  // ========== OPTIMISTIC UPDATE ACTIONS ==========

  addOptimisticBooking: (booking: MultiUnitBooking) => void;
  updateOptimisticBooking: (bookingId: string, updates: Partial<MultiUnitBooking>) => void;
  removeOptimisticBooking: (bookingId: string) => void;
  clearOptimisticEntry: (bookingId: string) => void;
  clearExpiredOptimistic: () => void;
  syncFromRealtime: (booking: MultiUnitBooking) => void;
  resolveOptimisticConflict: (bookingId: string, serverData: MultiUnitBooking) => void;

  // ========== OFFLINE SUPPORT ACTIONS ==========

  addToOfflineQueue: (operation: Omit<OfflineOperation, "id" | "timestamp" | "retryCount">) => void;
  processOfflineQueue: (processFn?: (item: OfflineOperation) => Promise<unknown>) => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  clearOfflineQueue: () => void;

  // ========== STATE MANAGEMENT ACTIONS ==========

  setSelectedBooking: (booking: MultiUnitBooking | null) => void;
  setDraftBooking: (booking: Partial<MultiUnitBooking> | null) => void;
  clearDraftBooking: () => void;
  saveDraftBooking: () => void;
  loadDraftBooking: () => void;
  setConflictResolutionStrategy: (strategy: ConflictResolutionStrategy) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;

  // ========== COMPUTED VALUES ==========

  getTotalAmount: () => number;
  getTotalGuests: () => number;
  getUnitCount: () => number;
  canAddMoreUnits: (maxUnits?: number) => boolean;
  hasUnavailableUnits: () => boolean;
  getUnavailableUnits: () => BookingUnit[];
}

// ============================================
// COMBINED STORE TYPE
// ============================================

export type MultiUnitBookingStore = MultiUnitBookingState & MultiUnitBookingActions;

// Generic API response wrapper
export interface ApiResponse<T> {
  success?: boolean;
  data: T;
  error?: string;
  message?: string;
}

export type MultiUnitBookingApiResponse = ApiResponse<MultiUnitBooking>;
