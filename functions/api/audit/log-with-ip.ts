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
 *   audit_id: string;
 * }
 *
 * Environment Variables (set via wrangler secrets):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anonymous key
 */

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
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

interface Context {
  request: Request;
  env: Env;
}

/**
 * Validate and get CORS headers for the request origin
 *
 * Allows requests from:
 * - Production: okaeri-resort.pages.dev
 * - Preview branches: *.okaeri-resort.pages.dev
 *
 * Security: Prevents unauthorized cross-origin requests
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [
    "https://okaeri-resort.pages.dev", // Production
    /^https:\/\/[a-z0-9-]+\.okaeri-resort\.pages\.dev$/, // Preview branches
  ];

  // Check if origin matches allowed patterns
  const isAllowed =
    origin &&
    allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://okaeri-resort.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Handle OPTIONS requests for CORS preflight
 * This must be a separate export for Cloudflare Pages Functions routing
 */
export async function onRequestOptions(context: Context): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Handle POST requests to log audit events with IP capture
 */
export async function onRequestPost(context: Context): Promise<Response> {
  const { request, env } = context;

  // Get CORS headers for this request's origin
  const corsHeaders = getCorsHeaders(request);

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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    };

    // Insert into Supabase via REST API
    const supabaseResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(auditLogData),
    });

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error("[Worker] Supabase insert failed:", errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to create audit log",
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = (await supabaseResponse.json()) as Array<{ audit_id?: string }>;

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        audit_id: result[0]?.audit_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
