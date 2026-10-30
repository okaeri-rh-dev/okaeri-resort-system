/**
 * Pending Users API Endpoint
 *
 * GET /api/admin/pending-users
 *
 * Returns authenticated users who have not been assigned a role.
 * Protected by admin middleware (_middleware.ts).
 *
 * Response:
 * {
 *   users: [{ id, email, full_name, created_at, email_confirmed_at }]
 * }
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { OWNER_OR_ABOVE } from "../../lib/rbac";
import { lookupUserRole } from "../../lib/role-lookup";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Authorize: this endpoint exposes registered-user PII (emails), so it is
    // tightened to owner/admin (frontend roles page = requireAdmin) on top of the
    // staff+ baseline in _middleware.ts. Source of truth is app_roles, never the
    // client-mutable user_metadata. Fails closed (401/403) if the token is absent.
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const appRole = await lookupUserRole(user.id, env);
    if (!OWNER_OR_ABOVE.includes(appRole)) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Owner or admin access required" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all auth users (paginate to avoid default 50-user limit)
    // NOTE: If user count exceeds 1000, implement multi-page iteration
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      console.error("[PendingUsers] Failed to list auth users:", authError.message);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all user IDs that have roles assigned
    const { data: roleData, error: roleError } = await supabase.from("app_roles").select("user_id");

    if (roleError) {
      console.error("[PendingUsers] Failed to list roles:", roleError.message);
      return new Response(JSON.stringify({ error: "Failed to fetch roles" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const assignedUserIds = new Set(roleData?.map((r) => r.user_id) || []);

    // Filter: return users whose ID is NOT in the assigned set
    const pendingUsers = (authData?.users || [])
      .filter((user) => !assignedUserIds.has(user.id))
      .map((user) => ({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
      }));

    return new Response(JSON.stringify({ users: pendingUsers }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[PendingUsers] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
