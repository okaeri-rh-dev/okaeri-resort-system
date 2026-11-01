// functions/api/audit/log-with-ip.ts

/**
 * Cloudflare Workers function for audit logging with IP capture
 *
 * Purpose: Capture true client IP for security-critical events
 * Free tier: 100,000 requests/day (resort uses ~10-20/day = 0.015% usage)
 *
 * Endpoints:
 * POST /api/audit/log-with-ip
 *
 * Request body:
 * {
 *   tableName: "authentication";
 *   description: one of PASSWORD_EVENTS;
 *   metadata?: Record<string, unknown>;
 * }
 *
 * Response:
 * {
 *   success: true;
 * }
 *
 * Environment Variables (set via wrangler secrets):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (audit_logs takes no client INSERT)
 */

import type { Json, TablesInsert } from "@/types/database.types";

import { createSupabaseAdmin } from "../../lib/supabase-admin";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AuditLogRequest {
  tableName: string;
  description: string;
  metadata?: { [key: string]: Json | undefined };
}

// The service role writes any row, so accept only the events auth-password-reset sends
const PASSWORD_EVENTS = ["Password updated successfully", "Password update failed"];

interface Context {
  request: Request;
  env: Env;
}

/**
 * Handle POST requests to log audit events with IP capture
 */
export async function onRequestPost(context: Context): Promise<Response> {
  const { request, env } = context;

  try {
    // Parse request body
    const body: AuditLogRequest = await request.json();

    if (body.tableName !== "authentication" || !PASSWORD_EVENTS.includes(body.description)) {
      return new Response(
        JSON.stringify({
          error: "Unsupported audit event",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract true client IP from Cloudflare headers
    // CF-Connecting-IP is the most reliable header for true client IP
    const clientIP =
      request.headers.get("CF-Connecting-IP") || // Cloudflare-provided client IP
      request.headers.get("X-Forwarded-For")?.split(",")[0] || // Fallback
      null;

    // Extract user agent
    const userAgent = request.headers.get("User-Agent") || null;

    // Extract authorization token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createSupabaseAdmin(env);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build audit log data (Layer 2 convention)
    const auditLogData = {
      table_name: "authentication",
      action: "INSERT", // Layer 2 convention: always INSERT
      source: "app", // Layer 2 source marker
      description: body.description,
      category: "AUTHENTICATION",
      severity: "WARNING",
      metadata: body.metadata || null,
      ip_address: clientIP,
      user_agent: userAgent,
      user_id: user.id,
      user_email: user.email ?? null,
    } satisfies TablesInsert<"audit_logs">;

    const { error: insertError } = await supabase.from("audit_logs").insert(auditLogData);

    if (insertError) {
      console.error("[Worker] Supabase insert failed:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to create audit log",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Worker] Exception:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
