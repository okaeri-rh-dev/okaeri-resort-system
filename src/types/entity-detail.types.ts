// src/types/entity-detail.types.ts

import type { Database } from "@/types/database.types";

// ============================================
// CORE ENTITY TYPES
// ============================================

/**
 * Union type for all entity types in the system
 * Used for type-safe generic functions and components
 */
export type EntityType = "booking" | "unit" | "guest" | "payment" | "expense";

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * Extract row types from Supabase schema for type safety
 */
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

// ============================================
// DETAIL PAGE TYPES WITH RELATIONS
// ============================================

/**
 * Booking detail page data with related entities
 */
export type BookingDetail = Booking & {
  unit: Unit | null;
  guest: Guest | null;
  payments: Payment[];
};

/**
 * Unit detail page data with bookings
 */
export type UnitDetail = Unit & {
  bookings: Booking[];
  current_booking: Booking | null;
};

/**
 * Guest detail page data with booking history and statistics
 */
export type GuestDetail = Guest & {
  bookings: Booking[];
  total_spent: number;
  total_bookings: number;
};

/**
 * Payment detail page data with booking relation
 */
export type PaymentDetail = Payment & {
  booking: Booking | null;
};

/**
 * Expense detail page data with optional unit relation
 */
export type ExpenseDetail = Expense & {
  unit: Unit | null;
  created_by_user: { id: string; name: string } | null;
};

/**
 * Generic detail type that maps entity types to their detail representations
 * Enables type-safe generic functions
 */
export type EntityDetail<T extends EntityType> = T extends "booking"
  ? BookingDetail
  : T extends "unit"
    ? UnitDetail
    : T extends "guest"
      ? GuestDetail
      : T extends "payment"
        ? PaymentDetail
        : T extends "expense"
          ? ExpenseDetail
          : never;

// ============================================
// ROUTE PARAMETER TYPES
// ============================================

/**
 * Type-safe route parameter mapping
 * Maps entity type to its parameter name (e.g., "booking" → { bookingId: string })
 */
export type EntityRouteParams<T extends EntityType> = {
  [K in `${T}Id`]: string;
};

// ============================================
// FORM DATA TYPES
// ============================================

/**
 * Booking edit/create form data
 */
export type BookingFormData = {
  guest_name: string;
  email: string;
  contact_number: string;
  check_in: Date;
  check_out: Date;
  unit_id: string;
  num_guests: number;
  payment_method: "Cash" | "GCash" | "BankTransfer" | "Card";
  payment_amount?: number;
  special_requests?: string;
};

/**
 * Unit edit/create form data
 */
export type UnitFormData = {
  unit_name: string;
  unit_code: string;
  unit_type: string;
  max_occupancy: number;
  base_rate: number;
  weekend_rate?: number;
  extra_person_rate?: number;
  cleaning_fee?: number;
  amenities?: string[];
};

/**
 * Guest edit/create form data
 */
export type GuestFormData = {
  guest_name: string;
  email?: string | null;
  contact_number?: string | null;
  address?: string;
  notes?: string;
};

/**
 * Payment edit/create form data
 */
export type PaymentFormData = {
  payment_amount: number;
  payment_method: "Cash" | "GCash" | "BankTransfer" | "Card";
  payment_proof_url?: string;
  notes?: string;
};

/**
 * Expense edit/create form data
 */
export type ExpenseFormData = {
  description: string;
  amount: number;
  expense_date: Date;
  category: string;
  receipt_url?: string;
  unit_id?: string;
  notes?: string;
};

// ============================================
// AUDIT TRAIL TYPES
// ============================================

/**
 * Filters for audit log queries
 */
export type AuditFilters = {
  entity_type: EntityType;
  entity_id: string;
  action?: string;
  user_id?: string;
  date_from?: Date;
  date_to?: Date;
};

// ============================================
// STATE MANAGEMENT TYPES
// ============================================

/**
 * Loading states for async operations
 */
export type LoadingState = "idle" | "loading" | "success" | "error";

/**
 * Generic entity detail state
 */
export type EntityDetailState<T> = {
  data: T | null;
  status: LoadingState;
  error: Error | null;
};
