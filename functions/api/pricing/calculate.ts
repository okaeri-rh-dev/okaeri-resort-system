import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { checkKVRateLimit, getClientIp } from "@/lib/kv-rate-limit";
import type { Database } from "@/types/database.types";

import { calculateBookingPrice } from "../../lib/pricing";

// Environment types
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT?: string;
}

// Request validation schema
const pricingCalculateRequestSchema = z
  .object({
    check_in: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid check-in date format"),
    check_out: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), "Invalid check-out date format"),
    guest_count: z.number().int().min(1).max(50).optional(), // Optional - can be calculated from unit_requests
    unit_id: z.guid().optional(),
    // For custom pricing (e.g., when unit doesn't exist yet)
    custom_pricing: z
      .object({
        base_rate: z.number().positive(),
        weekend_rate: z.number().positive(),
        extra_person_rate: z.number().nonnegative(),
        base_occupancy: z.number().int().min(1),
      })
      .optional(),
    // For multi-unit bookings (guest bookings without specific unit assignment)
    unit_requests: z
      .array(
        z.object({
          unit_id: z.guid().optional(), // Optional for guest bookings (admin assigns later)
          guest_count: z.number().int().min(1),
        })
      )
      .optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out date must be after check-in date",
  })
  .refine(
    (data) => {
      // Must have either: unit_id, custom_pricing, unit_requests, or guest_count for base pricing
      return data.unit_id || data.custom_pricing || data.unit_requests || data.guest_count;
    },
    {
      message: "Must provide either unit_id, custom_pricing, unit_requests, or guest_count",
    }
  )
  .refine((data) => data.unit_requests || data.guest_count !== undefined, {
    message: "guest_count is required unless unit_requests are provided",
    path: ["guest_count"],
  });

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", message: "Only POST method is allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    const body = await request.json();

    // Validate request
    const validationResult = pricingCalculateRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "VALIDATION_ERROR",
          message: "Invalid request parameters",
          errors: validationResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = validationResult.data;
    // The schema requires guest_count whenever unit_requests is absent, so the 0 is unreachable
    const guestCount = data.guest_count ?? 0;

    // Extract auth token (optional for public guest booking)
    const authHeader = request.headers?.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // The token is not verified on this public path, so it only picks the tier;
    // the key is always the client IP.
    const rateLimit = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      `pricing:${getClientIp(request as unknown as Request)}`,
      { limit: token ? 60 : 10, windowSeconds: 60, environment: env.ENVIRONMENT }
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many pricing requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimit.retryAfter.toString(),
          },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Handle different pricing scenarios
    let pricingResult;
    let notice = null;

    if (data.unit_requests) {
      // Multi-unit booking (with or without specific unit IDs)

      // Get default pricing config for guest bookings without unit IDs
      const { data: pricingConfig } = await supabase
        .from("pricing_config")
        .select("*")
        .eq("id", "default")
        .single();

      const pricingPromises = data.unit_requests.map(async (unitRequest) => {
        let unitData = null;
        let unitName = "Unit (To be assigned)";

        // If unit_id is provided, fetch specific unit
        if (unitRequest.unit_id) {
          const { data: unit, error } = await supabase
            .from("units")
            .select("*")
            .eq("unit_id", unitRequest.unit_id)
            .single();

          if (error || !unit) {
            throw new Error(`Unit ${unitRequest.unit_id} not found`);
          }
          unitData = unit;
          unitName = unit.unit_name;
        }

        // Use global pricing config as primary source, fall back to unit-specific rates
        const pricing = await calculateBookingPrice(supabase, {
          checkIn: new Date(data.check_in),
          checkOut: new Date(data.check_out),
          guestCount: unitRequest.guest_count,
          baseRate: pricingConfig?.base_rate ?? unitData?.base_rate ?? 3000,
          weekendRate: pricingConfig?.weekend_rate ?? unitData?.weekend_rate ?? 3500,
          extraPersonRate: pricingConfig?.extra_person_rate ?? unitData?.extra_person_rate ?? 500,
          baseOccupancy: pricingConfig?.base_occupancy ?? unitData?.base_occupancy ?? 2,
        });

        return {
          unit_id: unitRequest.unit_id || null,
          unit_name: unitName,
          pricing,
        };
      });

      const unitPricings = await Promise.all(pricingPromises);

      // Aggregate totals
      const totalAmount = unitPricings.reduce((sum, up) => sum + up.pricing.total, 0);
      const totalDownpayment = unitPricings.reduce((sum, up) => sum + up.pricing.downpayment, 0);
      const hasSeasonalRates = unitPricings.some((up) =>
        up.pricing.nightlyBreakdown.some((night) => night.seasonalMultiplier !== 1.0)
      );

      pricingResult = {
        units: unitPricings,
        total: totalAmount,
        downpayment: totalDownpayment,
        nights: unitPricings[0].pricing.nights,
        currency: "PHP",
      };

      if (hasSeasonalRates) {
        // Get unique season names
        const seasonNames = new Set<string>();
        unitPricings.forEach((up) => {
          up.pricing.nightlyBreakdown.forEach((night) => {
            if (night.seasonName) {
              seasonNames.add(night.seasonName);
            }
          });
        });
        notice = `Seasonal rates applied (${Array.from(seasonNames).join(", ")})`;
      }
    } else if (data.unit_id) {
      // Single unit booking
      const { data: unit, error } = await supabase
        .from("units")
        .select("*")
        .eq("unit_id", data.unit_id)
        .single();

      if (error || !unit) {
        return new Response(
          JSON.stringify({
            error: "UNIT_NOT_FOUND",
            message: `Unit ${data.unit_id} not found`,
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get global pricing config as primary source
      const { data: pricingConfig } = await supabase
        .from("pricing_config")
        .select("*")
        .eq("id", "default")
        .single();

      pricingResult = await calculateBookingPrice(supabase, {
        checkIn: new Date(data.check_in),
        checkOut: new Date(data.check_out),
        guestCount,
        baseRate: pricingConfig?.base_rate ?? unit.base_rate ?? 3000,
        weekendRate: pricingConfig?.weekend_rate ?? unit.weekend_rate ?? 3500,
        extraPersonRate: pricingConfig?.extra_person_rate ?? unit.extra_person_rate ?? 500,
        baseOccupancy: pricingConfig?.base_occupancy ?? unit.base_occupancy ?? 2,
      });

      // Check for seasonal rates
      const hasSeasonalRates = pricingResult.nightlyBreakdown.some(
        (night) => night.seasonalMultiplier !== 1.0
      );

      if (hasSeasonalRates) {
        const seasonNames = new Set(
          pricingResult.nightlyBreakdown
            .filter((night) => night.seasonName)
            .map((night) => night.seasonName)
        );
        notice = `Seasonal rates applied${
          seasonNames.size > 0 ? ` (${Array.from(seasonNames).join(", ")})` : ""
        }`;
      }
    } else if (data.custom_pricing) {
      // Custom pricing (no unit specified)
      pricingResult = await calculateBookingPrice(supabase, {
        checkIn: new Date(data.check_in),
        checkOut: new Date(data.check_out),
        guestCount,
        ...data.custom_pricing,
      });

      const hasSeasonalRates = pricingResult.nightlyBreakdown.some(
        (night) => night.seasonalMultiplier !== 1.0
      );

      if (hasSeasonalRates) {
        notice = "Seasonal rates applied";
      }
    } else if (data.guest_count) {
      // Guest booking with only guest count (no specific units)
      // Use default pricing configuration
      const { data: pricingConfig } = await supabase
        .from("pricing_config")
        .select("*")
        .eq("id", "default")
        .single();

      pricingResult = await calculateBookingPrice(supabase, {
        checkIn: new Date(data.check_in),
        checkOut: new Date(data.check_out),
        guestCount,
        baseRate: pricingConfig?.base_rate || 3000,
        weekendRate: pricingConfig?.weekend_rate || 3500,
        extraPersonRate: pricingConfig?.extra_person_rate || 500,
        baseOccupancy: pricingConfig?.base_occupancy || 2,
      });

      const hasSeasonalRates = pricingResult.nightlyBreakdown.some(
        (night) => night.seasonalMultiplier !== 1.0
      );

      if (hasSeasonalRates) {
        const seasonNames = new Set(
          pricingResult.nightlyBreakdown
            .filter((night) => night.seasonName)
            .map((night) => night.seasonName)
        );
        notice = `Seasonal rates applied${
          seasonNames.size > 0 ? ` (${Array.from(seasonNames).join(", ")})` : ""
        }`;
      }
    } else {
      // No valid pricing parameters provided
      return new Response(
        JSON.stringify({
          error: "INVALID_REQUEST",
          message: "Must provide unit_id, custom_pricing, unit_requests, or guest_count",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Audit logging removed to comply with ESLint (use Cloudflare Analytics instead)
    // Pricing calculation event tracked via Cloudflare dashboard analytics

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricingResult,
        notice,
        calculated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300", // Browser cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error("Pricing calculation error:", error);

    return new Response(
      JSON.stringify({
        error: "CALCULATION_ERROR",
        message: error instanceof Error ? error.message : "Failed to calculate pricing",
        debug: process.env.NODE_ENV === "development" ? error : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
