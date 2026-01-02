/**
 * Admin Login API Endpoint with Turnstile Verification
 *
 * POST /api/auth/login
 *
 * Security Features:
 * - Cloudflare Turnstile verification (bot protection)
 * - Rate limiting via middleware
 * - Audit logging for all login attempts
 * - Generic error messages (prevents user enumeration)
 *
 * Request Body:
 * {
 *   email: string,
 *   password: string,
 *   turnstile_token: string
 * }
 *
 * Response (Success):
 * {
 *   session: {
 *     access_token: string,
 *     refresh_token: string,
 *     expires_in: number,
 *     user: { id, email, ... }
 *   }
 * }
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getClientIp, verifyTurnstile } from "@/lib/turnstile";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ENVIRONMENT?: string;
}

// Request validation schema
const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
  turnstile_token: z.string().min(1, "Security verification required"),
});

// CORS headers helper
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    "https://okaeri-resort.pages.dev",
    /^https:\/\/[a-z0-9-]+\.okaeri-resort\.pages\.dev$/,
    "http://localhost:5173",
    "http://localhost:8788",
    "http://127.0.0.1:5173",
  ];

  const isAllowed =
    origin &&
    allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : "https://okaeri-resort.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// Handle OPTIONS request
export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request.headers.get("Origin"));
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Handle POST request for login
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  try {
    // Get client IP for Turnstile and logging
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("User-Agent") || "unknown";

    // Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validationResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, password, turnstile_token } = validationResult.data;

    // Verify Turnstile token
    const turnstileValid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort.pages.dev",
      expectedAction: "admin-login",
      environment: env.ENVIRONMENT,
      skipInDev: true, // Allow dev mode bypass
    });

    if (!turnstileValid) {
      console.warn(`[Login] Turnstile verification failed for ${email} from IP ${clientIp}`);
      return new Response(
        JSON.stringify({
          error: "TURNSTILE_FAILED",
          message: "Security verification failed. Please try again.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client for authentication
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Log failed attempt (don't expose detailed error to client)
      console.warn(
        `[Login] Failed login attempt for ${email} from IP ${clientIp}: ${error.message}`
      );

      // Generic error message to prevent user enumeration
      return new Response(
        JSON.stringify({
          error: "LOGIN_FAILED",
          message: "Invalid email or password. Please try again.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log successful login
    console.log(`[Login] Successful login for ${email} from IP ${clientIp}`);

    // Return session data
    return new Response(
      JSON.stringify({
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
          expires_at: data.session?.expires_at,
          token_type: data.session?.token_type,
          user: {
            id: data.user?.id,
            email: data.user?.email,
            role: data.user?.role,
            created_at: data.user?.created_at,
            last_sign_in_at: data.user?.last_sign_in_at,
          },
        },
        metadata: {
          ip: clientIp,
          user_agent: userAgent,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Login] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
