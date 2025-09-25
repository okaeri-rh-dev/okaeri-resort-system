// Supabase Response Type Definitions
// This file provides comprehensive type definitions for all Supabase API responses
// to ensure type safety and eliminate the use of 'any' types throughout the application

import type { Database } from "../../database.types";

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
  unit_type: Database["public"]["Enums"]["unit_type"];
  base_occupancy: number;
  max_occupancy: number;
  base_rate: number;
  weekend_rate?: number;
  extra_person_rate: number;
  unit_status: Database["public"]["Enums"]["unit_status"];
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
  blackout_type: Database["public"]["Enums"]["blackout_type"];
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
  booking_status: Database["public"]["Enums"]["booking_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  payment_method?: Database["public"]["Enums"]["payment_method"] | null;
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
  payment_method: Database["public"]["Enums"]["payment_method"];
  payment_status: Database["public"]["Enums"]["payment_status"];
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
  payment_status: Database["public"]["Enums"]["payment_status"];
  payment_method?: Database["public"]["Enums"]["payment_method"];
  updated_at?: string;
}

// ============================================
// GUEST TYPES
// ============================================
export interface GuestResponse {
  // Extends Database["public"]["Tables"]["guests"]["Row"]
  guest_id: string;
  guest_name: string;
  email: string;
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
  expense_category: Database["public"]["Enums"]["expense_category"];
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
  booking_status?: Database["public"]["Enums"]["booking_status"];
  payment_status?: Database["public"]["Enums"]["payment_status"];
  payment_method?: Database["public"]["Enums"]["payment_method"];
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
export function toUnitType(value: string): Database["public"]["Enums"]["unit_type"] {
  const validTypes: Database["public"]["Enums"]["unit_type"][] = [
    "Standard",
    "Deluxe",
    "Suite",
    "Villa",
  ];
  return validTypes.includes(value as any)
    ? (value as Database["public"]["Enums"]["unit_type"])
    : "Standard";
}

export function toBookingStatus(value: string): Database["public"]["Enums"]["booking_status"] {
  const validStatuses: Database["public"]["Enums"]["booking_status"][] = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "CheckedOut",
    "Cancelled",
  ];
  return validStatuses.includes(value as any)
    ? (value as Database["public"]["Enums"]["booking_status"])
    : "Pending";
}

export function toPaymentStatus(value: string): Database["public"]["Enums"]["payment_status"] {
  const validStatuses: Database["public"]["Enums"]["payment_status"][] = [
    "Pending",
    "Partial",
    "Completed",
    "Refunded",
  ];
  return validStatuses.includes(value as any)
    ? (value as Database["public"]["Enums"]["payment_status"])
    : "Pending";
}

export function toPaymentMethod(value: string): Database["public"]["Enums"]["payment_method"] {
  const validMethods: Database["public"]["Enums"]["payment_method"][] = [
    "Cash",
    "GCash",
    "BankTransfer",
    "Card",
  ];
  return validMethods.includes(value as any)
    ? (value as Database["public"]["Enums"]["payment_method"])
    : "Cash";
}

export function toBlackoutType(value: string): Database["public"]["Enums"]["blackout_type"] {
  const validTypes: Database["public"]["Enums"]["blackout_type"][] = [
    "Maintenance",
    "Renovation",
    "Seasonal",
    "Manual",
  ];
  return validTypes.includes(value as any)
    ? (value as Database["public"]["Enums"]["blackout_type"])
    : "Manual";
}
