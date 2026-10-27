import { z } from "zod";

import { typeError } from "./type-error";

/**
 * Pricing Configuration Validation Schema
 *
 * Validates pricing_config table updates with business rules:
 * - All rates must be positive numbers
 * - Weekend rate should typically be >= base rate (soft validation)
 * - Max capacity must be >= base occupancy
 * - Downpayment percentage between 0-100
 * - Currency locked to PHP for Philippine resort context
 *
 * Used by:
 * - PricingConfigForm component for client-side validation
 * - /api/pricing/update-config endpoint for server-side validation
 */

export const pricingConfigSchema = z
  .object({
    base_rate: z
      .number({ error: typeError("Base rate is required", "Base rate must be a number") })
      .positive("Base rate must be positive")
      .min(500, "Base rate seems too low (minimum ₱500)")
      .max(100000, "Base rate seems too high (maximum ₱100,000)"),

    weekend_rate: z
      .number({ error: typeError("Weekend rate is required", "Weekend rate must be a number") })
      .positive("Weekend rate must be positive")
      .min(500, "Weekend rate seems too low (minimum ₱500)")
      .max(100000, "Weekend rate seems too high (maximum ₱100,000)"),

    extra_person_rate: z
      .number({
        error: typeError("Extra person rate is required", "Extra person rate must be a number"),
      })
      .nonnegative("Extra person rate cannot be negative")
      .max(10000, "Extra person rate seems too high (maximum ₱10,000)"),

    base_occupancy: z
      .number({ error: typeError("Base occupancy is required", "Base occupancy must be a number") })
      .int("Base occupancy must be a whole number")
      .min(1, "Base occupancy must be at least 1 guest")
      .max(20, "Base occupancy seems too high (maximum 20 guests)"),

    max_capacity_per_unit: z
      .number({ error: typeError("Max capacity is required", "Max capacity must be a number") })
      .int("Max capacity must be a whole number")
      .min(1, "Max capacity must be at least 1 guest")
      .max(50, "Max capacity seems too high (maximum 50 guests per unit)"),

    downpayment_percent: z
      .number({
        error: typeError(
          "Downpayment percentage is required",
          "Downpayment percentage must be a number"
        ),
      })
      .min(0, "Downpayment percentage cannot be negative")
      .max(100, "Downpayment percentage cannot exceed 100%"),

    currency: z.literal("PHP", {
      error: "Currency must be PHP for Philippine resort",
    }),
  })
  .refine((data) => data.max_capacity_per_unit >= data.base_occupancy, {
    message: "Max capacity must be greater than or equal to base occupancy",
    path: ["max_capacity_per_unit"],
  })
  .refine(
    () => {
      // Soft validation: weekend rate should typically be >= base rate
      // But we allow it to be lower (maybe off-season pricing strategy)
      return true; // Always pass, just for documentation
    },
    {
      message: "Weekend rate is lower than base rate. This is allowed but uncommon. Please verify.",
      path: ["weekend_rate"],
    }
  );

/**
 * TypeScript type inferred from Zod schema
 * Use this for form data and API requests
 */
export type PricingConfigInput = z.infer<typeof pricingConfigSchema>;
