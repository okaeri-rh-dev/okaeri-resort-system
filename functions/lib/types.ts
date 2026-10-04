/**
 * Common type definitions for Cloudflare Workers API
 * Provides type safety for replacing 'any' types across the functions/ directory
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole } from "./rbac";

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  code?: number;
  details?: Record<string, unknown>;
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generic database query result
 */
export interface DatabaseResult<T = unknown> {
  data: T | null;
  error: Error | null;
  count?: number;
}

// ============================================
// SUPABASE CLIENT TYPES
// ============================================

/**
 * Supabase query error
 */
export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

/**
 * Supabase RPC call result
 */
export interface RpcResult<T = unknown> {
  data: T | null;
  error: SupabaseError | null;
}

/**
 * Typed Supabase client for resort database
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Generic Supabase client (when Database type not available)
 */
export type GenericSupabaseClient = SupabaseClient;

// ============================================
// AUDIT LOG TYPES
// ============================================

/**
 * Data before/after state for audit trail
 */
export interface AuditChanges {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/**
 * Audit log metadata
 */
export interface AuditMetadata extends Record<string, unknown> {
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  duration_ms?: number;
}

// ============================================
// BOOKING TYPES
// ============================================

/**
 * Multi-unit booking request payload
 */
export interface MultiUnitBookingRequest {
  check_in: string;
  check_out: string;
  unit_ids: string[];
  guest_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  guest_count: number;
  notes?: string;
  channel?: string;
  turnstile_token?: string;
}

/**
 * Booking unit assignment
 */
export interface BookingUnitAssignment {
  booking_id: string;
  unit_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  nightly_rate: number;
  subtotal: number;
}

/**
 * Available unit with pricing
 */
export interface AvailableUnit {
  id: string;
  name: string;
  type: string;
  capacity: number;
  base_rate: number;
  nightly_rate: number;
  amenities?: string[];
  is_available: boolean;
  unavailable_dates?: string[];
}

// ============================================
// PAYMENT TYPES
// ============================================

/**
 * Payment recording request
 */
export interface PaymentRecordRequest {
  booking_id: string;
  amount: number;
  payment_method: string;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  proof_url?: string;
}

/**
 * Payment refund request
 */
export interface PaymentRefundRequest {
  payment_id: string;
  amount: number;
  reason: string;
  refund_method?: string;
  notes?: string;
}

/**
 * Payment summary
 */
export interface PaymentSummary {
  total_paid: number;
  total_refunded: number;
  balance_due: number;
  payment_count: number;
  last_payment_date?: string;
}

// ============================================
// DISCOUNT & PRICING TYPES
// ============================================

/**
 * Discount rule from database
 */
export interface DiscountRule {
  id: string;
  name: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: number;
  min_nights?: number;
  max_nights?: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  priority: number;
}

/**
 * Applied discount calculation
 */
export interface AppliedDiscount {
  rule_id: string;
  rule_name: string;
  discount_type: string;
  discount_value: number;
  calculated_amount: number;
}

/**
 * Pricing preview result
 */
export interface PricingPreview {
  subtotal: number;
  discounts: AppliedDiscount[];
  total_discount: number;
  total: number;
  nights: number;
  nightly_rate: number;
  breakdown: {
    date: string;
    rate: number;
    is_weekend?: boolean;
  }[];
}

// ============================================
// RATE TYPES
// ============================================

/**
 * Rate configuration for a unit
 */
export interface RateConfiguration {
  unit_id: string;
  base_rate: number;
  weekend_rate?: number;
  holiday_rate?: number;
  seasonal_rates?: SeasonalRate[];
}

/**
 * Seasonal rate definition
 */
export interface SeasonalRate {
  start_date: string;
  end_date: string;
  rate: number;
  name?: string;
}

// ============================================
// AVAILABILITY TYPES
// ============================================

/**
 * Availability check request
 */
export interface AvailabilityRequest {
  check_in: string;
  check_out: string;
  unit_ids?: string[];
  guest_count?: number;
}

/**
 * Availability check result
 */
export interface AvailabilityResult {
  available_units: AvailableUnit[];
  unavailable_units: Array<{
    unit_id: string;
    unit_name: string;
    reason: string;
    conflicting_booking_id?: string;
  }>;
  total_available: number;
}

// ============================================
// MONITORING TYPES
// ============================================

/**
 * Quota status for a resource
 */
export interface QuotaStatus {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  status: "OK" | "WARNING" | "CRITICAL";
  unit?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: boolean;
    kv: boolean;
    email: boolean;
  };
  uptime_seconds?: number;
  version?: string;
}

// ============================================
// CLOUDFLARE TYPES
// ============================================

/**
 * Cloudflare request metadata
 */
export interface CloudflareRequestMetadata {
  ip?: string;
  country?: string;
  colo?: string;
  asn?: string;
  ray?: string;
}

/**
 * Authenticated request with user context
 * Extended by RBAC middleware after authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: UserRole;
  };
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Idempotency key info
 */
export interface IdempotencyInfo {
  key: string;
  cached: boolean;
  created_at?: string;
  ttl?: number;
}

// ============================================
// VALIDATION TYPES
// ============================================

/**
 * Zod validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result wrapper
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/**
 * Date range
 */
export interface DateRange {
  start_date: string;
  end_date: string;
}

/**
 * Key-value pair
 */
export interface KeyValuePair<T = unknown> {
  key: string;
  value: T;
}

// ============================================
// DATABASE PLACEHOLDER
// ============================================

/**
 * Placeholder for database schema types
 * Should be replaced with actual generated types from Supabase
 */
export interface Database {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
  };
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if value is an API error response
 */
export function isApiError(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorResponse).error === "string"
  );
}

/**
 * Check if value is a Supabase error
 */
export function isSupabaseError(value: unknown): value is SupabaseError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as SupabaseError).message === "string"
  );
}

/**
 * Check if database result has an error
 */
export function hasError<T>(
  result: DatabaseResult<T>
): result is DatabaseResult<T> & { error: Error } {
  return result.error !== null;
}
