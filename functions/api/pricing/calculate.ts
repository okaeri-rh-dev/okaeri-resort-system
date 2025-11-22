import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { calculateBookingPrice } from "../../lib/pricing";

// Environment types
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  KV_RATE_LIMIT: KVNamespace;
  KV_PRICING_CACHE: KVNamespace;
}

// Request validation schema
const pricingCalculateRequestSchema = z
  .object({
    check_in: z.string().refine((date) => {
      const checkIn = new Date(date);
      return checkIn >= new Date(new Date().setHours(0, 0, 0, 0));
    }, "Check-in date must be today or in the future"),
    check_out: z.string(),
    guest_count: z.number().int().min(1).max(50).optional(), // Optional - can be calculated from unit_requests
    unit_id: z.string().uuid().optional(),
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
          unit_id: z.string().uuid().optional(), // Optional for guest bookings (admin assigns later)
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
  );

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limiting helper
async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  limit: number = 10,
  windowMinutes: number = 1
): Promise<boolean> {
  const key = `rate_limit:pricing:${identifier}`;
  const now = Date.now();
  const window = windowMinutes * 60 * 1000;

  const data = (await kv.get(key, "json")) as { count: number; resetAt: number } | null;

  if (!data || now > data.resetAt) {
    await kv.put(key, JSON.stringify({ count: 1, resetAt: now + window }), {
      expirationTtl: windowMinutes * 60,
    });
    return true;
  }

  if (data.count >= limit) {
    return false;
  }

  await kv.put(key, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
    expirationTtl: Math.floor((data.resetAt - now) / 1000),
  });
  return true;
}

// Cache key generator
function getCacheKey(params: {
  check_in: string;
  check_out: string;
  guest_count: number;
  unit_id?: string;
}): string {
  return `pricing:${params.unit_id || "custom"}:${params.check_in}:${params.check_out}:${params.guest_count}`;
}

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", message: "Only POST method is allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validationResult.data;

    // Extract auth token (optional for public guest booking)
    const authHeader = request.headers?.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Rate limiting (check if KV namespace exists)
    if (env.KV_RATE_LIMIT) {
      const identifier = token || request.headers?.get("cf-connecting-ip") || "anonymous";
      const rateLimitOk = await checkRateLimit(
        env.KV_RATE_LIMIT,
        identifier,
        token ? 60 : 10, // Authenticated: 60/min, Guest: 10/min
        1
      );

      if (!rateLimitOk) {
        return new Response(
          JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message: "Too many pricing requests. Please try again later.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check cache for single unit requests
    let cachedResult = null;
    let cacheKey = "";

    if (data.unit_id && !data.unit_requests) {
      cacheKey = getCacheKey({
        check_in: data.check_in,
        check_out: data.check_out,
        guest_count: data.guest_count,
        unit_id: data.unit_id,
      });

      if (env.KV_PRICING_CACHE) {
        const cached = await env.KV_PRICING_CACHE.get(cacheKey, "json");
        if (cached) {
          cachedResult = cached;
        }
      }
    }

    if (cachedResult) {
      return new Response(
        JSON.stringify({
          success: true,
          ...cachedResult,
          cached: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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
            .eq("id", unitRequest.unit_id)
            .single();

          if (error || !unit) {
            throw new Error(`Unit ${unitRequest.unit_id} not found`);
          }
          unitData = unit;
          unitName = unit.name;
        }

        // Use unit-specific pricing or fall back to default config
        const pricing = await calculateBookingPrice(supabase, {
          checkIn: new Date(data.check_in),
          checkOut: new Date(data.check_out),
          guestCount: unitRequest.guest_count,
          baseRate: unitData?.base_rate || pricingConfig?.base_rate || 3000,
          weekendRate: unitData?.weekend_rate || pricingConfig?.weekend_rate || 3500,
          extraPersonRate: unitData?.extra_person_rate || pricingConfig?.extra_person_rate || 500,
          baseOccupancy: unitData?.base_occupancy || pricingConfig?.base_occupancy || 2,
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
        .eq("id", data.unit_id)
        .single();

      if (error || !unit) {
        return new Response(
          JSON.stringify({
            error: "UNIT_NOT_FOUND",
            message: `Unit ${data.unit_id} not found`,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get pricing config as fallback
      const { data: pricingConfig } = await supabase
        .from("pricing_config")
        .select("*")
        .eq("id", "default")
        .single();

      pricingResult = await calculateBookingPrice(supabase, {
        checkIn: new Date(data.check_in),
        checkOut: new Date(data.check_out),
        guestCount: data.guest_count,
        baseRate: unit.base_rate || pricingConfig?.base_rate || 3000,
        weekendRate: unit.weekend_rate || pricingConfig?.weekend_rate || 3500,
        extraPersonRate: unit.extra_person_rate || pricingConfig?.extra_person_rate || 500,
        baseOccupancy: unit.base_occupancy || pricingConfig?.base_occupancy || 2,
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
        guestCount: data.guest_count,
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
        guestCount: data.guest_count,
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache single unit results for 1 hour
    if (data.unit_id && !data.unit_requests && env.KV_PRICING_CACHE) {
      await env.KV_PRICING_CACHE.put(
        cacheKey,
        JSON.stringify({
          pricing: pricingResult,
          notice,
          calculated_at: new Date().toISOString(),
        }),
        { expirationTtl: 3600 } // 1 hour
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
          ...corsHeaders,
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
