/**
 * Guest Booking Client API - Frontend Helper
 *
 * Rate lookup for the public multi-unit booking form.
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
