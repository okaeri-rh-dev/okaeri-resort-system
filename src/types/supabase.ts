// Supabase Response Type Definitions
// This file provides comprehensive type definitions for all Supabase API responses
// to ensure type safety and eliminate the use of 'any' types throughout the application

import type { Database } from "@/types/database.types";

import type { BookingStatus, PaymentMethod, PaymentStatus, UnitStatus, UnitType } from "./index";

// Additional enum types not in index.ts
export type BlackoutType = "Maintenance" | "Renovation" | "Seasonal" | "Manual";
export type ExpenseCategory =
  | "Utilities"
  | "Maintenance & Repairs"
  | "Supplies & Inventory"
  | "Staff & Payroll"
  | "Marketing & Advertising"
  | "Food & Beverage"
  | "Cleaning & Laundry"
  | "Insurance & Permits"
  | "Professional Services"
  | "Other";

// ============================================
// ERROR TYPES
// ============================================
export interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  status?: number;
}

// ============================================
// AUTH TYPES
// ============================================
export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  aud: string;
  role?: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at?: string;
  app_metadata: {
    provider?: string;
    providers?: string[];
    [key: string]: unknown;
  };
  user_metadata: {
    [key: string]: unknown;
  };
  identities?: Array<{
    identity_id?: string;
    id: string;
    user_id: string;
    identity_data?: Record<string, unknown>;
    provider: string;
    last_sign_in_at?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

// ============================================
// UNIT AVAILABILITY TYPES
// ============================================
export interface UnitAvailabilityResponse {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: UnitType;
  base_occupancy: number;
  max_occupancy: number;
  base_rate: number;
  weekend_rate?: number;
  extra_person_rate: number;
  unit_status: UnitStatus;
  amenities?: string[] | null;
  cleaning_fee?: number | null;
  description?: string | null;
  images?: string[] | null;
  policies?: string[] | null;
  is_available: boolean;
  next_available_date?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// CALENDAR TYPES
// ============================================
export interface CalendarDayResponse {
  calendar_date: string;
  status: "available" | "booked" | "blackout";
  booking_id?: string;
  guest_name?: string;
  booking_reference?: string;
  unit_id?: string;
}

// ============================================
// BLACKOUT TYPES
// ============================================
export interface BlackoutResponse {
  blackout_id: string;
  unit_id: string;
  blackout_type: BlackoutType;
  start_date: string;
  end_date: string;
  reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// BOOKING TYPES
// ============================================
export interface BookingResponse {
  // Extends Database["public"]["Tables"]["bookings"]["Row"]
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  email: string;
  contact_number: string;
  unit_id: string;
  num_guests: number;
  check_in: string;
  check_out: string;
  total_amount: number;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
  unit?: Database["public"]["Tables"]["units"]["Row"];
  guest?: Database["public"]["Tables"]["guests"]["Row"];
  payments?: Database["public"]["Tables"]["payments"]["Row"][];
}

// ============================================
// PAYMENT TYPES
// ============================================
export interface PaymentResponse {
  // Extends Database["public"]["Tables"]["payments"]["Row"]
  payment_id: string;
  booking_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_date: string;
  proof_url?: string | null;
  receipt_url?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  booking?: BookingResponse;
}

export interface PaymentStatusUpdate {
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  updated_at?: string;
}

// ============================================
// GUEST TYPES
// ============================================
export interface GuestResponse {
  // Extends Database["public"]["Tables"]["guests"]["Row"]
  guest_id: string;
  guest_name: string;
  email: string | null;
  contact_number?: string | null;
  address?: string | null;
  nationality?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  total_bookings?: number | null;
  total_spent?: number | null;
  created_at: string;
  updated_at?: string | null;
  bookings?: BookingResponse[];
}

// ============================================
// EXPENSE TYPES
// ============================================
export interface ExpenseResponse {
  // Extends Database["public"]["Tables"]["expenses"]["Row"]
  expense_id: string;
  expense_category: ExpenseCategory;
  expense_name: string;
  amount: number;
  expense_date: string;
  notes?: string | null;
  receipt_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by_user?: AuthUser;
}

// ============================================
// QUERY UTILITY TYPES
// ============================================
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortingParams {
  column: string;
  order: "asc" | "desc";
}

export interface FilterParams {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is";
  value: string | number | boolean | null | string[] | number[];
}

export interface QueryParams extends PaginationParams {
  sorting?: SortingParams[];
  filters?: FilterParams[];
}

// ============================================
// RESPONSE WRAPPER TYPES
// ============================================
export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
  count?: number;
  status?: number;
  statusText?: string;
}

export interface SupabaseListResponse<T> {
  data: T[] | null;
  error: SupabaseError | null;
  count?: number;
}

// ============================================
// MUTATION TYPES
// ============================================
export interface BookingCreateInput {
  unit_id: string;
  guest_name: string;
  email: string;
  contact_number: string;
  num_guests: number;
  check_in: string;
  check_out: string;
  total_amount: number;
  booking_status?: BookingStatus;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod;
  special_requests?: string;
  internal_notes?: string;
}

export interface BookingUpdateInput extends Partial<BookingCreateInput> {
  booking_id: string;
}

// ============================================
// TYPE GUARDS
// ============================================
export function isSupabaseError(error: unknown): error is SupabaseError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

export function isAuthSession(session: unknown): session is AuthSession {
  return (
    typeof session === "object" &&
    session !== null &&
    "access_token" in session &&
    "user" in session
  );
}

export function isAuthUser(user: unknown): user is AuthUser {
  return typeof user === "object" && user !== null && "id" in user && "email" in user;
}

// ============================================
// ENUM CONVERTERS
// ============================================
export function toUnitType(value: string): UnitType {
  const validTypes: UnitType[] = ["Standard", "Deluxe", "Suite", "Villa"];
  return validTypes.includes(value as UnitType) ? (value as UnitType) : "Standard";
}

export function toBookingStatus(value: string): BookingStatus {
  const validStatuses: BookingStatus[] = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "CheckedOut",
    "Cancelled",
  ];
  return validStatuses.includes(value as BookingStatus) ? (value as BookingStatus) : "Pending";
}

export function toPaymentStatus(value: string): PaymentStatus {
  const validStatuses: PaymentStatus[] = ["Pending", "Partial", "Completed", "Refunded"];
  return validStatuses.includes(value as PaymentStatus) ? (value as PaymentStatus) : "Pending";
}

export function toPaymentMethod(value: string): PaymentMethod {
  const validMethods: PaymentMethod[] = ["Cash", "GCash", "BankTransfer", "Card"];
  return validMethods.includes(value as PaymentMethod) ? (value as PaymentMethod) : "Cash";
}

export function toBlackoutType(value: string): BlackoutType {
  const validTypes: BlackoutType[] = ["Maintenance", "Renovation", "Seasonal", "Manual"];
  return validTypes.includes(value as BlackoutType) ? (value as BlackoutType) : "Manual";
}
