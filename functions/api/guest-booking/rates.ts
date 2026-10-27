import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * GET /api/guest-booking/rates
 *
 * Returns current pricing configuration from pricing_config table.
 * Used by frontend to display rate card.
 * Cached for 1 hour (CDN).
 */

// Environment type
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600", // 1 hour CDN cache
  };

  try {
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch from pricing_config (single source of truth)
    const { data, error } = await supabase
      .from("pricing_config")
      .select(
        "base_rate, weekend_rate, extra_person_rate, base_occupancy, max_capacity_per_unit, downpayment_percent, currency"
      )
      .eq("id", "default")
      .single();

    if (error) {
      console.error("[RATES] Database error:", error);
      return Response.json(
        { success: false, error: "Failed to fetch configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const { count: totalUnits } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true });

    return Response.json(
      {
        success: true,
        rates: {
          base_rate: data.base_rate,
          weekend_rate: data.weekend_rate,
          extra_person_rate: data.extra_person_rate,
          base_occupancy: data.base_occupancy,
          max_capacity_per_unit: data.max_capacity_per_unit,
          max_units_in_system: totalUnits || 0,
          downpayment_percentage: data.downpayment_percent,
          currency: data.currency,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    console.error("[RATES] Unexpected error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch configuration" },
      { status: 500, headers: corsHeaders }
    );
  }
};
