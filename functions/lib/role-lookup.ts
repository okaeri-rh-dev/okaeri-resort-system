/**
 * Server-side role lookup for authorization decisions.
 *
 * Single source of truth: public.app_roles. The JWT's user_metadata.role
 * is user-mutable via supabase.auth.updateUser({ data }) and MUST NOT be
 * used for authorization.
 *
 * Behavior:
 * - Returns the role from app_roles when an is_active row exists
 * - Returns "user" when no active row exists (e.g., pending approval)
 * - Returns "user" on any error path (fail-closed; never silently grants)
 *
 * Caching: results are cached in RATE_LIMIT_KV for 60s per user_id. Role
 * changes (grants/revokes) take up to 60s to propagate.
 */

import { createClient } from "@supabase/supabase-js";

const ROLE_CACHE_TTL_SECONDS = 60;
const ROLE_CACHE_PREFIX = "role:";
const VALID_ROLES = new Set(["user", "staff", "manager", "admin", "owner"]);

interface RoleLookupEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export async function lookupUserRole(
  userId: string | undefined,
  env: RoleLookupEnv
): Promise<string> {
  if (!userId) return "user";

  const cacheKey = `${ROLE_CACHE_PREFIX}${userId}`;

  if (env.RATE_LIMIT_KV) {
    try {
      const cached = await env.RATE_LIMIT_KV.get(cacheKey);
      if (cached && VALID_ROLES.has(cached)) {
        return cached;
      }
    } catch (err) {
      console.error("role-lookup: KV read failed, falling through to DB", err);
    }
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("role-lookup: missing Supabase env vars; failing closed to 'user'");
    return "user";
  }

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("app_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("role-lookup: app_roles query failed", error);
      return "user";
    }

    const role =
      data?.role && typeof data.role === "string" && VALID_ROLES.has(data.role)
        ? data.role
        : "user";

    if (env.RATE_LIMIT_KV) {
      try {
        await env.RATE_LIMIT_KV.put(cacheKey, role, {
          expirationTtl: ROLE_CACHE_TTL_SECONDS,
        });
      } catch (err) {
        console.error("role-lookup: KV write failed (non-fatal)", err);
      }
    }

    return role;
  } catch (err) {
    console.error("role-lookup: unexpected exception, failing closed", err);
    return "user";
  }
}
