/**
 * API Response Type Definitions for Tests
 *
 * Provides type-safe interfaces for all API endpoint responses.
 * These types document the API contract and ensure test assertions
 * are type-checked against actual response structures.
 *
 * Usage:
 * ```typescript
 * const data = await response.json() as AvailabilityResponse;
 * expect(data.success).toBe(true);
 * ```
 */

// ============================================================
// AVAILABILITY API RESPONSES
// ============================================================

/**
 * GET /api/availability/multi-unit
 * Success response for multi-unit availability check
 */
export interface AvailabilityResponse {
  success: boolean;
  data: {
    results: Array<{
      unit_id: string;
      is_available: boolean;
      conflicting_bookings: number;
      next_available_date: string | null;
      unit_name?: string;
      unit_code?: string;
      unit_type?: string;
    }>;
    summary: {
      total_units_checked: number;
      available_units: number;
      unavailable_units: number;
    };
  };
}

// ============================================================
// BOOKING API RESPONSES
// ============================================================

/**
 * POST /api/bookings/multi-unit
 * Success response for multi-unit booking creation
 */
export interface MultiUnitBookingResponse {
  success: boolean;
  data: {
    booking_id: string;
    booking_reference: string;
    guest_id?: string;
    guest_name?: string;
    email?: string;
    contact_number?: string;
    check_in?: string;
    check_out?: string;
    num_guests?: number;
    total_amount?: number;
    booking_status?: string;
    payment_status?: string;
    created_at?: string;
    booking_units?: Array<{
      booking_unit_id: string;
      unit_id: string;
      unit_price: number;
      weekend_surcharge: number;
      extra_person_charge: number;
      subtotal: number;
      assigned_guests: number;
      unit?: {
        unit_id: string;
        unit_name: string;
        unit_code: string;
        unit_type: string;
        base_rate: number;
        weekend_rate: number;
        extra_person_rate: number;
        base_occupancy: number;
      };
    }>;
  };
  metadata: {
    units_booked: number;
    processing_time_ms: number;
  };
}

/**
 * POST /api/bookings/:id/units/add
 * Success response for adding unit to booking
 */
export interface AddUnitResponse {
  success: boolean;
  data: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    units: Array<any>;
  };
}

/**
 * POST /api/bookings/:id/units/remove
 * Success response for removing unit from booking
 */
export interface RemoveUnitResponse {
  success: boolean;
  data: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    units: Array<any>;
    refund_amount?: number;
  };
}

// ============================================================
// PRICING API RESPONSES
// ============================================================

/**
 * POST /api/pricing/quote
 * Success response for pricing calculation
 */
export interface PricingQuoteResponse {
  total_amount: number;
  nights: number;
  units: Array<{
    unit_id: string;
    base_amount: number;
    weekend_surcharge: number;
    extra_person_charge: number;
    subtotal: number;
  }>;
}

// ============================================================
// PAYMENT API RESPONSES
// ============================================================

/**
 * POST /api/bookings/:id/payments/record
 * Success response for payment recording
 */
export interface RecordPaymentResponse {
  success: boolean;
  data: {
    payment_id: string;
    booking_id: string;
    amount: number;
    payment_method: string;
    payment_status: string;
    created_at: string;
  };
}

// ============================================================
// ERROR RESPONSES
// ============================================================

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  code?: number;
  details?: any;
}

/**
 * Validation error response with field-level errors
 */
export interface ValidationErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    details: {
      validation_errors: Array<{
        field: string;
        message: string;
      }>;
    };
  };
}

/**
 * Business logic error response (e.g., unavailable units, insufficient funds)
 */
export interface BusinessErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      unavailable_units?: string[];
      [key: string]: any;
    };
  };
}

// ============================================================
// UNION TYPES FOR FLEXIBLE ASSERTIONS
// ============================================================

/**
 * Union type for booking API responses (success or error)
 */
export type BookingApiResponse =
  | MultiUnitBookingResponse
  | ValidationErrorResponse
  | BusinessErrorResponse;

/**
 * Union type for pricing API responses (success or error)
 */
export type PricingApiResponse = PricingQuoteResponse | ApiErrorResponse;

/**
 * Union type for availability API responses (success or error)
 */
export type AvailabilityApiResponse = AvailabilityResponse | ApiErrorResponse;

/**
 * Union type for payment API responses (success or error)
 */
export type PaymentApiResponse = RecordPaymentResponse | ApiErrorResponse;

/**
 * Union type for unit management responses (success or error)
 */
export type UnitManagementResponse = AddUnitResponse | RemoveUnitResponse | ApiErrorResponse;
