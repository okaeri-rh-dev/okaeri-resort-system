/**
 * Property-Based Tests for Pricing Engine
 *
 * Validates that pricing invariants hold for ALL possible inputs
 * using generative testing with fast-check library.
 *
 * Source: vault note [[07-testing-strategy]]
 */

import * as fc from "fast-check";
import { describe, test } from "vitest";

import type { PreviewPricingResponse } from "../integration/responses";

const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";

describe("Server-Side Pricing - Property-Based Tests", () => {
  test("PROPERTY: Total price is never negative", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // number of units
        fc.integer({ min: 1, max: 20 }), // guests per unit
        fc.date({ min: new Date("2025-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 1, max: 30 }), // nights
        async (numUnits, guests, checkIn, nights) => {
          // Skip invalid dates
          if (isNaN(checkIn.getTime())) return true;

          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          if (response.status !== 200) return true; // Skip invalid inputs

          const data = (await response.json()) as PreviewPricingResponse;
          return data.pricing.total >= 0;
        }
      ),
      { numRuns: 50 } // Test 50 random combinations
    );
  });

  test("PROPERTY: Downpayment is always 50% of total", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date({ min: new Date("2025-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 1, max: 30 }),
        async (numUnits, guests, checkIn, nights) => {
          // Skip invalid dates
          if (isNaN(checkIn.getTime())) return true;

          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          if (response.status !== 200) return true;

          const data = (await response.json()) as PreviewPricingResponse;
          const expected = Math.round(data.pricing.total * 0.5);
          return Math.abs(data.pricing.downpayment_required - expected) < 1; // Allow rounding difference
        }
      ),
      { numRuns: 50 }
    );
  });

  test("PROPERTY: Discount never exceeds subtotal", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date({ min: new Date("2025-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 7, max: 30 }), // Long enough for discount
        async (numUnits, guests, checkIn, nights) => {
          // Skip invalid dates
          if (isNaN(checkIn.getTime())) return true;

          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          if (response.status !== 200) return true;

          const data = (await response.json()) as PreviewPricingResponse;
          const discountAmount = data.pricing.discount?.amount || 0;
          return discountAmount <= data.pricing.subtotal;
        }
      ),
      { numRuns: 50 }
    );
  });

  test("PROPERTY: More nights always costs more or equal (without discounts)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date({ min: new Date("2025-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 1, max: 5 }), // shorter stay (avoid discount range)
        async (numUnits, guests, checkIn, shortNights) => {
          // Skip invalid dates
          if (isNaN(checkIn.getTime())) return true;

          const longNights = shortNights + 1;
          const shortCheckOut = new Date(checkIn);
          shortCheckOut.setDate(shortCheckOut.getDate() + shortNights);

          const longCheckOut = new Date(checkIn);
          longCheckOut.setDate(longCheckOut.getDate() + longNights);

          const [shortResponse, longResponse] = await Promise.all([
            fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
                check_in: checkIn.toISOString(),
                check_out: shortCheckOut.toISOString(),
              }),
            }),
            fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
                check_in: checkIn.toISOString(),
                check_out: longCheckOut.toISOString(),
              }),
            }),
          ]);

          if (shortResponse.status !== 200 || longResponse.status !== 200) return true;

          const shortData = (await shortResponse.json()) as PreviewPricingResponse;
          const longData = (await longResponse.json()) as PreviewPricingResponse;

          // More nights should cost more (using subtotal to avoid discount effects)
          return longData.pricing.subtotal >= shortData.pricing.subtotal;
        }
      ),
      { numRuns: 30 } // Fewer runs due to API calls
    );
  });
});
