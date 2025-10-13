/**
 * Centralized Pricing Quote Endpoint
 *
 * POST /api/pricing/quote
 *
 * Single source of truth for multi-unit booking pricing calculation.
 * Server recalculates pricing on every booking submission (no quote_id caching).
 *
 * Gap Resolution #7: Centralized pricing endpoint as authoritative source
 */

import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface PricingQuoteRequest {
  units: Array<{
    unit_id: string;
    guests: number;
  }>;
  check_in: string; // ISO 8601 UTC timestamp
  check_out: string; // ISO 8601 UTC timestamp
}

interface PricingQuoteResponse {
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

/**
 * Calculate pricing for multi-unit booking
 *
 * This is the SINGLE SOURCE OF TRUTH for pricing.
 * All pricing logic centralized here - used by both client (estimates) and server (final totals).
 */
export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const startTime = Date.now();

  try {
    // Parse request body
    const data = (await request.json()) as PricingQuoteRequest;

    // Validate request
    if (!data.units || !Array.isArray(data.units) || data.units.length === 0) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "units array is required and must not be empty",
        },
        { status: 400 }
      );
    }

    if (!data.check_in || !data.check_out) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "check_in and check_out are required",
        },
        { status: 400 }
      );
    }

    // Validate dates
    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return Response.json(
        {
          error: "INVALID_DATES",
          message: "check_in and check_out must be valid ISO 8601 dates",
        },
        { status: 400 }
      );
    }

    if (checkOut <= checkIn) {
      return Response.json(
        {
          error: "INVALID_DATES",
          message: "check_out must be after check_in",
        },
        { status: 400 }
      );
    }

    // Calculate number of nights
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate pricing using centralized logic
    const pricing = await calculateMultiUnitPricing(data, env, nights);

    const processingTime = Date.now() - startTime;

    return Response.json(pricing, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        "X-Processing-Time": `${processingTime}ms`,
      },
    });
  } catch (error) {
    console.error("[Pricing Quote] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to calculate pricing",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500 }
    );
  }
};

/**
 * Calculate multi-unit pricing with weekend detection and extra person charges
 *
 * SINGLE SOURCE OF TRUTH: All pricing calculations happen here
 */
async function calculateMultiUnitPricing(
  data: PricingQuoteRequest,
  env: Env,
  nights: number
): Promise<PricingQuoteResponse> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const checkIn = new Date(data.check_in);
  let totalAmount = 0;
  const unitBreakdowns = [];

  for (const unitRequest of data.units) {
    // Fetch unit pricing data
    const { data: unitData, error } = await supabase
      .from("units")
      .select("unit_id, unit_name, base_rate, weekend_rate, extra_person_rate, base_occupancy")
      .eq("unit_id", unitRequest.unit_id)
      .single();

    if (error || !unitData) {
      throw new Error(`Unit ${unitRequest.unit_id} not found`);
    }

    let baseAmount = 0;
    let weekendSurcharge = 0;

    // Calculate nightly rates with weekend detection
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkIn);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      // Weekend: Friday (5) or Saturday (6)
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const nightRate = isWeekend ? unitData.weekend_rate : unitData.base_rate;

      if (isWeekend && unitData.weekend_rate > unitData.base_rate) {
        weekendSurcharge += unitData.weekend_rate - unitData.base_rate;
      }

      baseAmount += nightRate;
    }

    // Calculate extra person charges
    const extraPersons = Math.max(0, unitRequest.guests - unitData.base_occupancy);
    const extraPersonCharge = extraPersons * unitData.extra_person_rate * nights;

    const subtotal = baseAmount + extraPersonCharge;

    unitBreakdowns.push({
      unit_id: unitRequest.unit_id,
      base_amount: baseAmount,
      weekend_surcharge: weekendSurcharge,
      extra_person_charge: extraPersonCharge,
      subtotal,
    });

    totalAmount += subtotal;
  }

  return {
    total_amount: totalAmount,
    nights,
    units: unitBreakdowns,
  };
}

/**
 * Export for testing
 */
export { calculateMultiUnitPricing };
