/**
 * Admin Authentication & Authorization Middleware
 *
 * Enforces JWT authentication + a role baseline for all /api/admin/* endpoints.
 * This middleware runs BEFORE all admin endpoint handlers.
 *
 * Security layers:
 * 1. JWT token extraction from Authorization header
 * 2. Supabase Auth user verification
 * 3. Authorization: requires an active public.app_roles role of staff or above
 *    (staff/manager/owner/admin). Client-mutable user_metadata is never trusted.
 *    Handlers enforce stricter levels where needed (verify-payment = manager+,
 *    pending-users = owner/admin).
 *
 * Returns:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: Authenticated but role is below staff (e.g. pending approval)
 * - Passes to next handler: Authenticated + authorized, real role in adminContext
 *
 * Reference: vault note [[014-admin-api-endpoints instructions]]
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { STAFF_OR_ABOVE, type UserRole } from "../../lib/rbac";
import { lookupUserRole } from "../../lib/role-lookup";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

// Baseline for the entire /api/admin/* area: an approved staff member or above.
// Individual handlers enforce stricter levels where required (verify-payment =
// manager+, pending-users = owner/admin). Authorization is sourced from
// public.app_roles via lookupUserRole — NEVER from client-mutable JWT claims.
const ADMIN_AREA_ROLES = STAFF_OR_ABOVE;

interface AdminContext {
  user_id: string;
  email: string;
  app_role: UserRole;
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

  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
  // STEP 4: Authorize via app_roles (server-side source of truth)
  // ============================================================================

  // Authorization is derived from public.app_roles, NOT from user_metadata /
  // app_metadata (both are client-mutable via supabase.auth.updateUser). A user
  // with no active role — e.g. a fresh self sign-up pending approval — resolves
  // to "user" and is rejected. lookupUserRole fails closed to "user" on error.
  const appRole = await lookupUserRole(user.id, env);

  if (!ADMIN_AREA_ROLES.includes(appRole)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Forbidden",
        error_code: "FORBIDDEN",
        message: "Staff access or higher is required",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // ============================================================================
  // STEP 5: Enrich Request Context for Downstream Handlers
  // ============================================================================

  // Attach admin context to request (for downstream handlers to use)
  const adminContext: AdminContext = {
    user_id: user.id,
    email: user.email || "",
    app_role: appRole,
  };

  // Store in context for downstream handlers
  // Note: Extending Request interface not possible in Workers, use header or context
  (request as CloudflareRequest & { adminContext?: AdminContext }).adminContext = adminContext;

  // ============================================================================
  // STEP 6: Continue to Next Handler
  // ============================================================================

  return next();
}
