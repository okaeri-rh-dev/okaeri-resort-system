/**
 * Response bodies of the MSW guest-booking handlers in `__tests__/mocks/handlers/booking.ts`.
 * Error responses carry `success: false` plus `error` (and sometimes `details`).
 */

import type { MockPricing } from "../mocks/handlers/booking";

interface ErrorFields {
  error?: string;
  details?: string;
}

export interface GuestBookingResponse extends ErrorFields {
  success: boolean;
  booking: MockPricing & {
    booking_id: string;
    booking_reference: string;
    is_multi_unit: boolean;
    requested_unit_count: number;
    discount_applied: NonNullable<MockPricing["discount"]> | null;
  };
  is_duplicate?: boolean;
}

export interface PreviewPricingResponse extends ErrorFields {
  success: boolean;
  pricing: MockPricing;
}

export interface RatesResponse {
  success: boolean;
  rates: MockPricing["rates"] & { max_capacity_per_unit: number };
}

export interface DiscountRulesResponse {
  success: boolean;
  discount_rules: Array<{
    name: string;
    conditions: string;
    discount_value: number;
    description: string;
  }>;
}
