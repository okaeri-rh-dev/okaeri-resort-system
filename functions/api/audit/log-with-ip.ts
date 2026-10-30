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
 *   tableName: string;
 *   recordId?: string;
 *   description: string;
 *   category: string;
 *   severity?: "INFO" | "WARNING" | "CRITICAL" | "DEBUG";
 *   metadata?: Record<string, unknown>;
 *   oldData?: Record<string, unknown>;
 *   newData?: Record<string, unknown>;
 * }
 *
 * Response:
 * {
 *   success: true;
 * }
 *
 * Environment Variables (set via wrangler secrets):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anonymous key
 */

import { createClient } from "@supabase/supabase-js";

import type { Database, Json, TablesInsert } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface AuditLogRequest {
  tableName: string;
  recordId?: string;
  description: string;
  category: string;
  severity?: "INFO" | "WARNING" | "CRITICAL" | "DEBUG";
  metadata?: { [key: string]: Json | undefined };
  oldData?: { [key: string]: Json | undefined };
  newData?: { [key: string]: Json | undefined };
}

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

    // Validate required fields
    if (!body.tableName || !body.description || !body.category) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: tableName, description, category",
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

    // Validate environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      console.error("[Worker] Missing environment variables: SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build audit log data (Layer 2 convention)
    const auditLogData = {
      table_name: body.tableName,
      record_id: body.recordId || null,
      action: "INSERT", // Layer 2 convention: always INSERT
      source: "app", // Layer 2 source marker
      description: body.description,
      category: body.category,
      severity: body.severity || "INFO",
      metadata: body.metadata || null,
      old_data: body.oldData || null,
      new_data: body.newData || null,
      ip_address: clientIP,
      user_agent: userAgent,
      // Note: user_id and user_email will be set by BEFORE INSERT trigger from JWT
    } satisfies TablesInsert<"audit_logs">;

    // Insert as the caller so RLS and the user_id trigger see their JWT
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // No .select(): returning the row needs SELECT on audit_logs, which staff and managers lack
    const { error: insertError } = await supabase.from("audit_logs").insert(auditLogData);

    if (insertError) {
      console.error("[Worker] Supabase insert failed:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to create audit log",
          details: insertError.message,
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
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
