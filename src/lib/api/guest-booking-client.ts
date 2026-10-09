/**
 * Guest Booking Client API - Frontend Helper
 *
 * Idempotency key storage, rate lookup, date-range validation, and pricing
 * preview for the public multi-unit booking form.
 */

import type { PricingConfig } from "@/types/guest-booking-multi-unit";

/**
 * Fetches static rates from pricing_config table
 *
 * Makes a GET request to /api/guest-booking/rates endpoint
 * Returns pricing configuration including rates and capacity limits
 *
 * @returns Promise<PricingConfig> - Pricing configuration object
 * @throws Error on network failure or server error
 */
export async function fetchRates(): Promise<PricingConfig> {
  const response = await fetch("/api/guest-booking/rates", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error: unknown = await response.json();
    const err = error as Record<string, unknown>;
    throw new Error((err.message as string) || (err.error as string) || "Failed to fetch rates");
  }

  const result: unknown = await response.json();
  const res = result as { success: boolean; rates: PricingConfig };

  if (!res.success || !res.rates) {
    throw new Error("Invalid response structure from rates API");
  }

  return res.rates;
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
