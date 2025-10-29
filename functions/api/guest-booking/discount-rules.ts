import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/guest-booking/discount-rules
 *
 * Returns active discount rules for display to guests.
 * Cached for 30 minutes.
 */

// Environment type
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Discount rule condition type
interface DiscountCondition {
  type: string;
  value?: number | string;
}

// Discount rule structure
interface DiscountRule {
  id: string;
  name: string;
  description?: string;
  conditions: DiscountCondition[];
  discount_type: string;
  discount_value: number;
  priority: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800", // 30 minutes
  };

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from("discount_rules")
      .select("id, name, description, conditions, discount_type, discount_value, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      console.error("[DISCOUNTS] Database error:", error);
      return Response.json(
        { success: false, error: "Failed to fetch discount rules" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Find duration discount for display message
    const durationDiscount = (data as DiscountRule[] | null)?.find((rule) =>
      rule.conditions.some((c) => c.type === "min_nights")
    );

    let displayMessage = null;
    if (durationDiscount) {
      const minNights = durationDiscount.conditions.find((c) => c.type === "min_nights")?.value;
      displayMessage = `Book ${minNights}+ nights and save ${durationDiscount.discount_value}%!`;
    }

    return Response.json(
      {
        success: true,
        discount_rules: data || [],
        display_message: displayMessage,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    console.error("[DISCOUNTS] Unexpected error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch discount rules" },
      { status: 500, headers: corsHeaders }
    );
  }
};
