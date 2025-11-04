/**
 * Admin Authentication Middleware (Phase 1)
 *
 * Enforces JWT authentication for all /api/admin/* endpoints.
 * This middleware runs BEFORE all admin endpoint handlers.
 *
 * Security layers:
 * 1. JWT token extraction from Authorization header
 * 2. Supabase Auth user verification
 * 3. Phase 1: All authenticated users have admin access
 *    Phase 2: TODO - Implement role-based access control with profiles table
 *
 * Returns:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - Passes to next handler: Authenticated user verified
 *
 * Reference: docs/implementation/guest-booking-multi-unit/chunks/014-admin-api-endpoints/instructions.md lines 204-380
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AdminContext {
  user_id: string;
  email: string;
  app_role: string;
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Admin authentication middleware handler
 *
 * Verifies JWT token and admin role before allowing access to admin endpoints
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  next: () => Promise<Response>;
  env: Env;
}): Promise<Response> {
  const { request, next, env } = context;

  // ============================================================================
  // STEP 1: Handle CORS Preflight Requests
  // ============================================================================

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // ============================================================================
  // STEP 2: Extract JWT Token from Authorization Header
  // ============================================================================

  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
        error_code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // ============================================================================
  // STEP 3: Verify JWT Token with Supabase Auth
  // ============================================================================

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
        error_code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // ============================================================================
  // STEP 4: Phase 1 - All authenticated users have admin access
  // ============================================================================

  // Phase 1: Skip role verification - all authenticated users are admins
  // Phase 2: TODO - Implement role-based access control
  //
  // When implementing Phase 2, uncomment and update the following:
  //
  // const userRole = user.user_metadata?.role || user.app_metadata?.role;
  //
  // if (userRole !== "admin") {
  //   const { data: profile, error: profileError } = await supabase
  //     .from("profiles")
  //     .select("role")
  //     .eq("id", user.id)
  //     .single();
  //
  //   if (profileError || !profile || profile.role !== "admin") {
  //     return new Response(
  //       JSON.stringify({
  //         success: false,
  //         error: "Forbidden - insufficient permissions",
  //         error_code: "FORBIDDEN",
  //         message: "Admin role required",
  //       }),
  //       {
  //         status: 403,
  //         headers: {
  //           "Content-Type": "application/json",
  //           ...corsHeaders,
  //         },
  //       }
  //     );
  //   }
  // }

  // ============================================================================
  // STEP 5: Enrich Request Context for Downstream Handlers
  // ============================================================================

  // Attach admin context to request (for downstream handlers to use)
  const adminContext: AdminContext = {
    user_id: user.id,
    email: user.email || "",
    app_role: "admin", // Phase 1: All authenticated users are admins
  };

  // Store in context for downstream handlers
  // Note: Extending Request interface not possible in Workers, use header or context
  (request as Request & { adminContext?: AdminContext }).adminContext = adminContext;

  // ============================================================================
  // STEP 6: Continue to Next Handler
  // ============================================================================

  return next();
}
