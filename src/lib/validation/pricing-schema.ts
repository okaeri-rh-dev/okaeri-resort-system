import { z } from "zod";

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
      .number({
        required_error: "Base rate is required",
        invalid_type_error: "Base rate must be a number",
      })
      .positive("Base rate must be positive")
      .min(500, "Base rate seems too low (minimum ₱500)")
      .max(100000, "Base rate seems too high (maximum ₱100,000)"),

    weekend_rate: z
      .number({
        required_error: "Weekend rate is required",
        invalid_type_error: "Weekend rate must be a number",
      })
      .positive("Weekend rate must be positive")
      .min(500, "Weekend rate seems too low (minimum ₱500)")
      .max(100000, "Weekend rate seems too high (maximum ₱100,000)"),

    extra_person_rate: z
      .number({
        required_error: "Extra person rate is required",
        invalid_type_error: "Extra person rate must be a number",
      })
      .nonnegative("Extra person rate cannot be negative")
      .max(10000, "Extra person rate seems too high (maximum ₱10,000)"),

    base_occupancy: z
      .number({
        required_error: "Base occupancy is required",
        invalid_type_error: "Base occupancy must be a number",
      })
      .int("Base occupancy must be a whole number")
      .min(1, "Base occupancy must be at least 1 guest")
      .max(20, "Base occupancy seems too high (maximum 20 guests)"),

    max_capacity_per_unit: z
      .number({
        required_error: "Max capacity is required",
        invalid_type_error: "Max capacity must be a number",
      })
      .int("Max capacity must be a whole number")
      .min(1, "Max capacity must be at least 1 guest")
      .max(50, "Max capacity seems too high (maximum 50 guests per unit)"),

    downpayment_percent: z
      .number({
        required_error: "Downpayment percentage is required",
        invalid_type_error: "Downpayment percentage must be a number",
      })
      .min(0, "Downpayment percentage cannot be negative")
      .max(100, "Downpayment percentage cannot exceed 100%"),

    currency: z.literal("PHP", {
      errorMap: () => ({ message: "Currency must be PHP for Philippine resort" }),
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

/**
 * Helper: Validate pricing config and return detailed errors
 *
 * @param data - Pricing configuration data to validate
 * @returns { success: true, data } or { success: false, errors }
 *
 * @example
 * ```typescript
 * const result = validatePricingConfig(formData);
 * if (!result.success) {
 *   console.error(result.errors);
 *   return;
 * }
 * await updatePricingConfig(result.data);
 * ```
 */
export function validatePricingConfig(data: unknown): {
  success: boolean;
  data?: PricingConfigInput;
  errors?: z.ZodError;
} {
  const result = pricingConfigSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Seasonal Rate Validation Schema
 *
 * Validates seasonal pricing multipliers with business rules:
 * - Season ID must be unique and use lowercase/underscores only
 * - Date format must be MM-DD (e.g., "03-01" for March 1)
 * - Multiplier between 0.5x and 3.0x (50% discount to 200% increase)
 * - Priority determines precedence when dates overlap
 *
 * Used by:
 * - SeasonalRatesForm component for client-side validation
 * - /api/pricing/seasonal-rates endpoint for server-side validation
 */
export const seasonalRateSchema = z.object({
  id: z.string().uuid().optional(),

  season_id: z
    .string({
      required_error: "Season ID is required",
    })
    .min(1, "Season ID is required")
    .regex(/^[a-z_]+$/, "Season ID must contain only lowercase letters and underscores")
    .max(50, "Season ID is too long (max 50 characters)"),

  name: z
    .string({
      required_error: "Season name is required",
    })
    .min(1, "Season name is required")
    .max(100, "Season name is too long (max 100 characters)"),

  start_date: z
    .string({
      required_error: "Start date is required",
    })
    .regex(/^\d{2}-\d{2}$/, "Start date must be in MM-DD format (e.g., 03-01)")
    .refine((date) => {
      const [month, day] = date.split("-").map(Number);
      return month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }, "Invalid date: check month (01-12) and day (01-31) values"),

  end_date: z
    .string({
      required_error: "End date is required",
    })
    .regex(/^\d{2}-\d{2}$/, "End date must be in MM-DD format (e.g., 05-31)")
    .refine((date) => {
      const [month, day] = date.split("-").map(Number);
      return month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }, "Invalid date: check month (01-12) and day (01-31) values"),

  multiplier: z
    .number({
      required_error: "Price multiplier is required",
      invalid_type_error: "Price multiplier must be a number",
    })
    .min(0.5, "Multiplier must be at least 0.5x (50% discount maximum)")
    .max(3.0, "Multiplier must be at most 3.0x (200% increase maximum)"),

  priority: z
    .number({
      required_error: "Priority is required",
      invalid_type_error: "Priority must be a number",
    })
    .int("Priority must be a whole number")
    .min(0, "Priority must be at least 0")
    .max(100, "Priority must be at most 100"),

  is_active: z
    .boolean({
      required_error: "Active status is required",
    })
    .default(true),

  description: z
    .string()
    .max(500, "Description is too long (max 500 characters)")
    .optional()
    .nullable(),

  color: z
    .enum(["blue", "green", "orange", "red", "purple"], {
      errorMap: () => ({ message: "Color must be blue, green, orange, red, or purple" }),
    })
    .optional()
    .default("blue"),

  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

/**
 * TypeScript type for seasonal rate
 */
export type SeasonalRateInput = z.infer<typeof seasonalRateSchema>;

/**
 * Seasonal rates collection schema
 * Validates an array of seasonal rates with additional business rules
 */
export const seasonalRatesCollectionSchema = z
  .array(seasonalRateSchema)
  .refine(
    (rates) => {
      // Check for duplicate season_ids
      const seasonIds = rates.map((r) => r.season_id);
      return seasonIds.length === new Set(seasonIds).size;
    },
    {
      message: "Duplicate season IDs found. Each season must have a unique ID.",
    }
  )
  .refine(
    (rates) => {
      // At least one rate should be active
      return rates.some((r) => r.is_active);
    },
    {
      message: "At least one seasonal rate must be active.",
    }
  );

/**
 * Helper: Validate seasonal rate and return detailed errors
 */
export function validateSeasonalRate(data: unknown): {
  success: boolean;
  data?: SeasonalRateInput;
  errors?: z.ZodError;
} {
  const result = seasonalRateSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Helper: Validate seasonal rates collection
 */
export function validateSeasonalRatesCollection(data: unknown): {
  success: boolean;
  data?: SeasonalRateInput[];
  errors?: z.ZodError;
} {
  const result = seasonalRatesCollectionSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}
