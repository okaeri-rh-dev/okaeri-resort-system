// Core type definitions for Okaeri Resort System

import type { BookingStatus, PaymentStatus } from "./booking-status";

// ============================================
// UNIT TYPES
// ============================================
export type UnitType = "Standard" | "Deluxe" | "Suite" | "Villa";
/** A cabin's state on one night, derived from blocks and bookings (ADR 0005). */
export type CabinState = "Blocked" | "Booked" | "Free";

export interface CabinNight {
  state: CabinState;
  /** The block reasons when Blocked, else null. */
  blockReason: string | null;
}

export interface Unit {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string; // Database returns string, use UnitType for validation
  base_occupancy: number;
  max_occupancy: number;
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  amenities: string[] | null;
  cleaning_fee?: number | null;
  description?: string | null;
  images?: string[] | null;
  policies?: string[] | null;
  created_at: string | null; // Database can return null
  updated_at: string | null; // Database can return null
}

// ============================================
// GUEST TYPES
// ============================================
export interface Guest {
  guest_id: string;
  guest_name: string;
  email: string | null;
  phone_number: string | null;
  total_bookings: number | null;
  total_spent: number | null;
  created_at: string | null; // Database can return null
  updated_at: string | null; // Database can return null
  anonymized_at?: string | null;
}

// ============================================
// BOOKING TYPES
// ============================================
export {
  BOOKING_STATUSES,
  type BookingStatus,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "./booking-status";
export { APP_ROLE_NAMES } from "./app-role";
export type PaymentMethod = "Cash" | "GCash" | "BankTransfer" | "Card" | "Other";
export type PaymentRecordStatus = "Active" | "Deleted" | "Refunded";

// Database booking unit junction table record
export interface BookingUnitRecord {
  booking_unit_id: string;
  booking_id: string;
  unit_id: string;
  unit_price: number;
  weekend_surcharge: number | null;
  extra_person_charge: number | null;
  subtotal: number;
  assigned_guests: number | null;
  unit_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Relation to unit
  unit?: Unit;
}

export interface Booking {
  booking_id: string;
  booking_reference: string;
  guest_id?: string | null;
  guest_name: string;
  contact_number: string | null;
  email: string | null;
  num_guests: number;
  check_in: string; // Date as ISO string
  check_out: string; // Date as ISO string
  total_amount: number;
  booking_status: BookingStatus | null;
  payment_status: string | null; // Database uses nullable strings, not enums
  payment_method?: string | null;
  payment_proof_url?: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  anonymized_at?: string | null;
  is_multi_unit?: boolean | null;
  is_walk_in?: boolean;
  unit_count?: number | null;
  pricing_metadata?: {
    hasSeasonalRates?: boolean;
    seasonNames?: string[];
    nights?: number;
    subtotal?: number;
    extraPersonTotal?: number;
    total?: number;
    downpayment?: number;
    balance?: number;
    nightlyBreakdown?: Array<{
      date: string;
      rate: number;
      season?: string;
      multiplier?: number;
    }>;
  } | null;
  created_at: string | null;
  updated_at: string | null;
  // Relations (NEW: junction table pattern)
  booking_units?: BookingUnitRecord[];
  guest?: Guest | null;
  // Deprecated: Direct unit relation removed (use booking_units instead)
  // unit?: Unit;
}

// ============================================
// ACCOUNT TYPES
// ============================================
export type AccountType = "Bank" | "E-Wallet" | "Cash";

export interface Account {
  account_id: string;
  account_name: string;
  account_code: string;
  account_type: AccountType;
  description?: string | null;
  initial_balance: number;
  is_active: boolean;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// PAYMENT METHOD CONFIG TYPES
// ============================================
export type PaymentMethodType = "e-wallet" | "bank-transfer" | "cash" | "other";

export interface PaymentMethodConfig {
  id: string;
  method_type: PaymentMethodType;
  provider_name: string;
  display_name: string;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  qr_code_url: string | null;
  qr_code_storage_path: string | null;
  icon_name: string;
  display_order: number;
  instructions: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// EXPENSE CATEGORY CONFIG TYPES
// ============================================
export interface ExpenseCategoryConfig {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountWithBalance extends Account {
  total_payments: number;
  total_expenses: number;
  transfers_in: number;
  transfers_out: number;
  current_balance: number;
}

export interface AccountTransfer {
  transfer_id: string;
  transfer_reference: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  notes?: string | null;
  created_at: string | null;
  // Relations
  from_account?: Account;
  to_account?: Account;
}

// ============================================
// PAYMENT TYPES
// ============================================
export interface Payment {
  payment_id: string;
  booking_id: string | null;
  account_id?: string | null; // Financial account that received this payment
  amount: number;
  payment_method?: string | null;
  payment_date: string | null;
  proof_url?: string | null;
  notes?: string | null;
  status?: PaymentRecordStatus; // Soft-delete status: Active, Deleted, Refunded
  created_at: string | null;
  // Relations
  booking?: Booking;
  account?: Account;
}

// ============================================
// EXPENSE TYPES
// ============================================
export interface Expense {
  expense_id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string; // This maps to expense_date in our schema
  account_id?: string | null; // Financial account used to pay this expense
  receipt_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  account?: Account;
}

// ============================================
// FORM INPUT TYPES
// ============================================
export interface BookingFormData {
  // Note: For single-unit bookings, use unit_id. For multi-unit, use unit_ids array.
  unit_id?: string; // Single-unit booking (legacy)
  unit_ids?: string[]; // Multi-unit booking
  guest_name: string;
  contact_number: string;
  email: string;
  num_guests: number;
  check_in: Date | string;
  check_out: Date | string;
  special_requests?: string;
  payment_method?: PaymentMethod;
  is_walk_in?: boolean;
}

// ============================================
// FILTER TYPES
// ============================================
export interface BookingFilters {
  status?: BookingStatus;
  payment_status?: PaymentStatus;
  unit_id?: string;
  guest_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  /**
   * Filter by walk-in flag.
   * `true` = only walk-ins, `false` = only non-walk-ins, `undefined` = both.
   */
  is_walk_in?: boolean;
}

export interface UnitFilters {
  type?: UnitType;
  min_rate?: number;
  max_rate?: number;
  min_occupancy?: number;
}

// ============================================
// TABLE COLUMN TYPES (For TanStack Table)
// ============================================
export interface TableState {
  sorting: unknown[];
  columnFilters: unknown[];
  columnVisibility: Record<string, boolean>;
  rowSelection: Record<string, boolean>;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

// ============================================
// MULTI-UNIT BOOKING TYPES (Phase 3)
// ============================================
export * from "./multi-unit-booking";
