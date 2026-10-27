/**
 * Password Reset Request API Endpoint with Turnstile Verification
 *
 * POST /api/auth/forgot-password
 *
 * Security Features:
 * - Cloudflare Turnstile verification (bot protection)
 * - Rate limiting via middleware
 * - Email enumeration prevention (always returns success)
 * - Audit logging for security monitoring
 *
 * Request Body:
 * {
 *   email: string,
 *   turnstile_token: string
 * }
 *
 * Response (Always 200 - prevents email enumeration):
 * {
 *   success: true,
 *   message: "If an account with that email exists, a reset link has been sent."
 * }
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getClientIp, verifyTurnstile } from "@/lib/turnstile";
import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ENVIRONMENT?: string;
  // Site URL for password reset redirect
  SITE_URL?: string;
}

// Request validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
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

// Handle POST request for password reset
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  // Security: Always return the same success response regardless of outcome
  // This prevents email enumeration attacks
  const successResponse = () =>
    new Response(
      JSON.stringify({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  try {
    // Get client IP for Turnstile and logging
    const clientIp = getClientIp(request);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validationResult.error.issues.map((e) => ({
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

    const { email, turnstile_token } = validationResult.data;

    // Verify Turnstile token
    const turnstileValid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort.pages.dev",
      expectedAction: "admin-forgot-password",
      environment: env.ENVIRONMENT,
      skipInDev: true, // Allow dev mode bypass
    });

    if (!turnstileValid) {
      console.warn(
        `[ForgotPassword] Turnstile verification failed for ${email} from IP ${clientIp}`
      );
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

    // Create Supabase client
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Determine the redirect URL for password reset
    // Use SITE_URL env var or derive from request origin
    const origin =
      request.headers.get("Origin") || env.SITE_URL || "https://okaeri-resort.pages.dev";
    const redirectTo = `${origin}/reset-password`;

    // Request password reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Log error but don't expose to client (prevents enumeration)
      console.warn(
        `[ForgotPassword] Reset request failed for ${email} from IP ${clientIp}: ${error.message}`
      );
      // Still return success response to prevent enumeration
      return successResponse();
    }

    // Log successful request
    console.warn(`[ForgotPassword] Password reset requested for ${email} from IP ${clientIp}`);

    // Return success (same message regardless of email existence)
    return successResponse();
  } catch (error) {
    // Log error but return success to prevent enumeration
    console.error("[ForgotPassword] Unexpected error:", error);

    // Still return success response to prevent enumeration
    return successResponse();
  }
}
