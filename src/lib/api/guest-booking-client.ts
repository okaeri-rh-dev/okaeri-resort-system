/**
 * Guest Booking Client API - Frontend Helper
 *
 * Provides client-side idempotency key management and booking submission utilities
 * Implements the dual idempotency strategy:
 * - KV cache (10 minutes) for fast recent lookups
 * - PostgreSQL (48 hours) for long-term duplicate prevention
 *
 * Usage:
 * ```typescript
 * import { submitGuestBooking } from '@/lib/api/guest-booking-client';
 *
 * const handleSubmit = async (formData: BookingFormData) => {
 *   try {
 *     const result = await submitGuestBooking(formData);
 *     // Handle success - idempotency key automatically cleared
 *   } catch (error) {
 *     // Handle error - key preserved for retry
 *   }
 * };
 * ```
 */

import type {
  ErrorResponse,
  MultiUnitBookingRequest,
  MultiUnitBookingResponse,
  PricingPreviewRequest,
  PricingPreviewResponse,
} from "@/types/guest-booking-multi-unit";

/**
 * API base URL for guest booking endpoints
 * Uses environment variable if available, fallback to relative path
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/guest-booking";

/**
 * SessionStorage key for idempotency key persistence
 * Survives page refreshes but clears when tab/window closes
 */
const IDEMPOTENCY_STORAGE_KEY = "booking_idempotency_key";

/**
 * Generates or retrieves existing idempotency key from sessionStorage
 *
 * Benefits of sessionStorage:
 * - Survives page refreshes (user can navigate back without losing key)
 * - Clears when tab/window closes (prevents stale keys across sessions)
 * - Scoped to single tab (multiple tabs get different keys)
 *
 * @returns UUID string (crypto.randomUUID())
 */
export function getOrCreateIdempotencyKey(): string {
  // Check if running in browser environment
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    // Server-side rendering or non-browser environment
    // Return a new UUID (will be handled by server)
    return crypto.randomUUID();
  }

  // Check if key exists in sessionStorage
  let key = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);

  if (!key) {
    // Generate new UUID using Web Crypto API
    // crypto.randomUUID() is available in:
    // - Chrome 92+, Firefox 95+, Safari 15.4+
    // - Secure contexts only (HTTPS or localhost)
    key = crypto.randomUUID();

    // Persist to sessionStorage
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key);
  }

  return key;
}

/**
 * Clears idempotency key after successful booking
 *
 * Call this when:
 * - Booking successfully created (status 200/201)
 * - User confirms booking completion
 * - Navigating away from booking form
 *
 * Do NOT call this on:
 * - Network errors (allow retry with same key)
 * - Validation errors (allow correction and resubmit)
 * - Server errors (allow retry)
 */
export function clearIdempotencyKey(): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return; // Server-side rendering
  }

  sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
}

/**
 * Checks if an idempotency key currently exists
 * Useful for UI state management (e.g., "Resume booking" button)
 *
 * @returns true if key exists in sessionStorage
 */
export function hasIdempotencyKey(): boolean {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }

  return sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) !== null;
}

/**
 * Gets current idempotency key without creating one
 * Returns null if no key exists
 *
 * @returns UUID string or null
 */
export function getCurrentIdempotencyKey(): string | null {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return null;
  }

  return sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
}

/**
 * Manually sets an idempotency key
 * Useful for advanced scenarios (e.g., resuming abandoned booking)
 *
 * @param key - UUID string to set
 */
export function setIdempotencyKey(key: string): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key);
}

/**
 * Submits guest booking with automatic idempotency protection
 *
 * Features:
 * - Automatically generates/retrieves idempotency key
 * - Passes key in both header (KV cache) and body (database)
 * - Clears key only on successful submission
 * - Preserves key on errors for retry
 *
 * @param bookingData - Booking form data (validated by caller)
 * @returns API response with booking details
 * @throws Error on network failure or server error
 */
export async function submitGuestBooking(
  bookingData: MultiUnitBookingRequest
): Promise<MultiUnitBookingResponse> {
  // Get or create idempotency key
  const idempotencyKey = getOrCreateIdempotencyKey();

  // Submit booking request
  const response = await fetch("/api/guest-booking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Pass in header for KV cache (fast lookup)
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      ...bookingData,
      // Also pass in body for PostgreSQL (long-term duplicate prevention)
      idempotency_key: idempotencyKey,
    }),
  });

  // Parse response with union type for success/error responses
  const result: MultiUnitBookingResponse | ErrorResponse = await response.json();

  // Clear key only on successful submission
  // Errors preserve key for retry
  if (response.ok) {
    clearIdempotencyKey();
  }

  // Throw on error (caller handles retry logic)
  if (!response.ok) {
    const errorResult = result as ErrorResponse;
    throw new Error(errorResult.error || "Booking submission failed");
  }

  return result as MultiUnitBookingResponse;
}

/**
 * Type guard: Check if error is due to idempotency (duplicate submission)
 *
 * @param error - Error from submitGuestBooking()
 * @returns true if error indicates duplicate submission
 */
export function isIdempotencyError(error: any): boolean {
  if (typeof error === "object" && error !== null) {
    const errorCode = error.code || error.error;
    return (
      errorCode === "DUPLICATE_SUBMISSION" ||
      errorCode === "IDEMPOTENCY_CONFLICT" ||
      (typeof error.message === "string" &&
        (error.message.includes("duplicate") || error.message.includes("idempotency")))
    );
  }

  return false;
}

/**
 * Browser compatibility check for crypto.randomUUID()
 *
 * @returns true if crypto.randomUUID() is available
 */
export function supportsRandomUUID(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  );
}

/**
 * Fallback UUID generator for older browsers
 * Uses Math.random() - less secure but functional
 *
 * Only use if supportsRandomUUID() returns false
 * Modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) have crypto.randomUUID()
 *
 * @returns UUID v4 string
 */
export function generateFallbackUUID(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fetches static rates from pricing_config table
 *
 * Makes a GET request to /api/guest-booking/rates endpoint
 * Returns pricing configuration including rates and capacity limits
 *
 * @returns Promise<PricingConfig> - Pricing configuration object
 * @throws Error on network failure or server error
 */
export async function fetchRates(): Promise<any> {
  const response = await fetch("/api/guest-booking/rates", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error: any = await response.json();
    throw new Error(error.message || error.error || "Failed to fetch rates");
  }

  const result: any = await response.json();
  return result.data;
}

/**
 * Validates date range for booking
 *
 * Checks:
 * - Check-in date is not in the past
 * - Check-out date is after check-in date
 * - Minimum 1 night stay
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Error message string if invalid, null if valid
 */
export function validateDateRange(checkIn: Date, checkOut: Date): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Normalize dates to midnight for comparison
  const checkInNormalized = new Date(checkIn);
  checkInNormalized.setHours(0, 0, 0, 0);

  const checkOutNormalized = new Date(checkOut);
  checkOutNormalized.setHours(0, 0, 0, 0);

  // Check if check-in is in the past
  if (checkInNormalized < today) {
    return "Check-in date cannot be in the past";
  }

  // Check if check-out is after check-in
  if (checkOutNormalized <= checkInNormalized) {
    return "Check-out date must be after check-in date";
  }

  // Check minimum 1 night stay
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) {
    return "Minimum stay is 1 night";
  }

  return null; // Valid
}

/**
 * Calculates number of nights between two dates
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights (integer)
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const checkInTime = checkIn.getTime();
  const checkOutTime = checkOut.getTime();
  const diffMs = checkOutTime - checkInTime;
  return Math.floor(diffMs / msPerDay);
}

/**
 * Fetch pricing preview from server
 * POST /api/guest-booking/preview-pricing
 *
 * IMPORTANT: This endpoint calls PostgreSQL calculate_booking_pricing() function.
 * It is NOT a client-side calculation - it's a server-side preview wrapper for UX.
 *
 * Source: 02-api-specification.md lines 645-698
 *
 * @param request Pricing preview request with dates and unit requests
 * @throws Error if API call fails or returns non-success
 * @returns PricingPreviewResponse with breakdown
 */
export async function previewPricing(
  request: PricingPreviewRequest
): Promise<PricingPreviewResponse> {
  try {
    const response = await fetch(`${API_BASE}/preview-pricing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pricing preview: ${response.status} ${response.statusText}`);
    }

    const data: PricingPreviewResponse = await response.json();

    if (!data.success) {
      throw new Error("API returned success: false");
    }

    return data;
  } catch (error) {
    console.error("[API] previewPricing error:", error);
    throw error;
  }
}
