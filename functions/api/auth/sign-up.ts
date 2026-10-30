/**
 * Sign-Up API Endpoint with Turnstile Verification
 *
 * POST /api/auth/sign-up
 *
 * Security Features:
 * - Cloudflare Turnstile verification (bot protection)
 * - Rate limiting via middleware
 * - Generic error messages (prevents email enumeration)
 * - Does NOT return session tokens (requires email verification)
 *
 * Request Body:
 * {
 *   email: string,
 *   password: string,
 *   full_name: string,
 *   turnstile_token: string
 * }
 *
 * Response (Success):
 * {
 *   success: true,
 *   message: "Account created. Please check your email to verify."
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
}

// Request validation schema
const signUpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  turnstile_token: z.string().min(1, "Security verification required"),
});

// Handle POST request for sign-up
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    // Get client IP for Turnstile and logging
    const clientIp = getClientIp(request);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = signUpSchema.safeParse(body);

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
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { email, password, full_name, turnstile_token } = validationResult.data;

    // Verify Turnstile token
    const turnstileValid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort.pages.dev",
      expectedAction: "sign-up",
      environment: env.ENVIRONMENT,
      skipInDev: true,
    });

    if (!turnstileValid) {
      console.warn(`[SignUp] Turnstile verification failed for ${email} from IP ${clientIp}`);
      return new Response(
        JSON.stringify({
          error: "TURNSTILE_FAILED",
          message: "Security verification failed. Please try again.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
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

    // Determine redirect URL from request origin
    const origin = request.headers.get("Origin") || "https://okaeri-resort.pages.dev";

    // Create user account
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
        emailRedirectTo: origin + "/login?confirmed=true",
      },
    });

    if (error) {
      // Log error but return generic message to prevent email enumeration
      console.warn(
        `[SignUp] Registration failed for ${email} from IP ${clientIp}: ${error.message}`
      );

      return new Response(
        JSON.stringify({
          error: "REGISTRATION_FAILED",
          message: "Registration failed. Please try again.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Log successful registration
    console.warn(`[SignUp] Account created for ${email} from IP ${clientIp}`);

    // Return success - do NOT return session tokens
    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created. Please check your email to verify.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SignUp] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
