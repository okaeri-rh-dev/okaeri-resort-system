/**
 * Pricing Configuration Update Endpoint
 *
 * PUT /api/pricing/update-config
 *
 * Updates the singleton pricing_config table row with new rates and settings.
 * Requires authentication and admin/manager role.
 *
 * Security:
 * - Session authentication required
 * - Role-based access (admin/manager only)
 * - Zod validation on input
 * - Audit logging for all changes
 * - Rate limiting (10 requests per hour)
 */

import { z } from "zod";

import { createSupabaseAdmin } from "../../lib/supabase-admin";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

/**
 * Pricing Config Update Schema
 * Matches the validation schema from client but server-side validated
 */
const pricingConfigUpdateSchema = z.object({
  base_rate: z.number().positive().min(500).max(100000),
  weekend_rate: z.number().positive().min(500).max(100000),
  extra_person_rate: z.number().nonnegative().max(10000),
  base_occupancy: z.number().int().min(1).max(20),
  max_capacity_per_unit: z.number().int().min(1).max(50),
  downpayment_percent: z.number().min(0).max(100),
  currency: z.literal("PHP"),
});

type PricingConfigUpdate = z.infer<typeof pricingConfigUpdateSchema>;

/**
 * CORS Headers
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Handle OPTIONS preflight request
 */
export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

/**
 * Handle PUT request to update pricing configuration
 */
export const onRequestPut = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const startTime = Date.now();

  try {
    // Extract authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        {
          error: "UNAUTHORIZED",
          message: "Missing or invalid authorization header",
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase admin client (bypasses RLS)
    const supabase = createSupabaseAdmin(env);

    // Verify session and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        {
          error: "UNAUTHORIZED",
          message: "Invalid or expired session",
        },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check user role (must be admin, manager, or owner)
    const { data: roleData, error: roleError } = await supabase
      .from("app_roles")
      .select("role, is_active")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      return Response.json(
        {
          error: "FORBIDDEN",
          message: "No role assigned to user",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    if (!roleData.is_active) {
      return Response.json(
        {
          error: "FORBIDDEN",
          message: "User role is not active",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const allowedRoles = ["admin", "manager", "owner"];
    if (!allowedRoles.includes(roleData.role)) {
      return Response.json(
        {
          error: "FORBIDDEN",
          message: "Insufficient permissions. Admin, manager, or owner role required.",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Rate limiting (10 requests per hour per user)
    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    const rateLimitKey = `pricing-update:${user.id}:${clientIp}`;

    const rateLimitData = await env.RATE_LIMIT_KV.get(rateLimitKey);
    const rateLimit = rateLimitData
      ? JSON.parse(rateLimitData)
      : { count: 0, timestamp: Date.now() };

    const hourAgo = Date.now() - 3600000; // 1 hour
    if (rateLimit.timestamp > hourAgo) {
      if (rateLimit.count >= 10) {
        const retryAfter = Math.ceil((rateLimit.timestamp + 3600000 - Date.now()) / 1000);
        return Response.json(
          {
            error: "RATE_LIMIT_EXCEEDED",
            message: "Too many pricing updates. Please try again later.",
            retryAfter,
          },
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Retry-After": String(retryAfter),
            },
          }
        );
      }
      rateLimit.count++;
    } else {
      rateLimit.count = 1;
      rateLimit.timestamp = Date.now();
    }

    await env.RATE_LIMIT_KV.put(rateLimitKey, JSON.stringify(rateLimit), {
      expirationTtl: 3600, // 1 hour
    });

    // Parse and validate request body
    const body = await request.json();
    const validated = pricingConfigUpdateSchema.parse(body);

    // Get current pricing config for audit trail
    const { data: currentConfig, error: fetchError } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "default")
      .single();

    if (fetchError || !currentConfig) {
      return Response.json(
        {
          error: "INTERNAL_ERROR",
          message: "Failed to fetch current pricing configuration",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Update pricing configuration
    const { data: updatedConfig, error: updateError } = await supabase
      .from("pricing_config")
      .update({
        base_rate: validated.base_rate,
        weekend_rate: validated.weekend_rate,
        extra_person_rate: validated.extra_person_rate,
        base_occupancy: validated.base_occupancy,
        max_capacity_per_unit: validated.max_capacity_per_unit,
        downpayment_percent: validated.downpayment_percent,
        currency: validated.currency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default")
      .select()
      .single();

    if (updateError || !updatedConfig) {
      console.error("[pricing/update-config] Update failed:", {
        error: updateError,
        code: updateError?.code,
        message: updateError?.message,
        details: updateError?.details,
        hint: updateError?.hint,
      });
      return Response.json(
        {
          error: "UPDATE_FAILED",
          message: "Failed to update pricing configuration",
          debug: updateError?.message, // Include error details for debugging
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Log to audit trail
    await supabase.from("audit_logs").insert({
      action: "pricing_config.updated",
      entity_type: "pricing_config",
      entity_id: "default",
      user_id: user.id,
      ip_address: clientIp,
      user_agent: request.headers.get("user-agent") || null,
      changes: {
        before: currentConfig,
        after: updatedConfig,
      },
      metadata: {
        role: roleData.role,
        duration_ms: Date.now() - startTime,
      },
    });

    // Return success response
    return Response.json(
      {
        success: true,
        config: updatedConfig,
        message: "Pricing configuration updated successfully",
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[pricing/update-config] Error:", error);

    // Zod validation error
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid pricing configuration data",
          details: error.errors,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generic error
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      { status: 500, headers: corsHeaders }
    );
  }
};
