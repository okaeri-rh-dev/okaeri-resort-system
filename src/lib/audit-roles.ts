// src/lib/audit-roles.ts

import type { Database } from "@/types/database.types";

import { supabase } from "./supabase";

// ============================================
// TYPE DEFINITIONS
// ============================================

export enum AuditRole {
  ADMIN = "admin",
  OWNER = "owner",
  MANAGER = "manager",
  STAFF = "staff",
}

export type AppRole = Database["public"]["Tables"]["app_roles"]["Row"];
export type AppRoleInsert = Database["public"]["Tables"]["app_roles"]["Insert"];
export type AppRoleUpdate = Database["public"]["Tables"]["app_roles"]["Update"];

// Role hierarchy levels for permission checks
const ROLE_HIERARCHY: Record<AuditRole | "none", number> = {
  [AuditRole.ADMIN]: 4,
  [AuditRole.OWNER]: 3,
  [AuditRole.MANAGER]: 2,
  [AuditRole.STAFF]: 1,
  none: 0,
};

// ============================================
// ROLE CACHE (60s TTL)
// ============================================

const ROLE_CACHE_TTL_MS = 60_000; // 60 seconds

let roleCache: { role: AuditRole | null; timestamp: number } | null = null;

/**
 * Clear the cached role. Call this on:
 * - Auth state changes (sign-in, sign-out)
 * - Role mutations (grant, revoke, update, deactivate)
 */
export function clearRoleCache(): void {
  roleCache = null;
}

// ============================================
// READ FUNCTIONS
// ============================================

/**
 * Get current user's audit role
 * Uses the SQL function get_current_audit_role() for consistency.
 * Results are cached for 60s to avoid redundant network requests
 * during navigation (route guards, layout checks, etc.).
 *
 * @returns AuditRole or null if no role assigned
 *
 * @example
 * const role = await getUserAuditRole();
 * if (role === AuditRole.ADMIN) {
 *   // Show admin features
 * }
 */
export async function getUserAuditRole(): Promise<AuditRole | null> {
  // Return cached value if still fresh
  if (roleCache && Date.now() - roleCache.timestamp < ROLE_CACHE_TTL_MS) {
    return roleCache.role;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Use the SQL function for single source of truth
    const { data, error } = await supabase.rpc("get_current_audit_role");

    if (error) {
      console.error("[Audit] Failed to get user role:", error.message);
      // Don't cache errors — transient failures shouldn't lock users out
      return null;
    }

    // SQL function returns 'none' for no role
    const role = !data || data === "none" ? null : (data as AuditRole);

    // Cache successful responses
    roleCache = { role, timestamp: Date.now() };

    return role;
  } catch (error) {
    console.error("[Audit] Error getting user role:", error);
    // Don't cache errors
    return null;
  }
}

/**
 * Check if user has required role or higher
 * Uses role hierarchy: admin > owner > manager > staff
 *
 * @param requiredRole - Minimum role required
 * @returns true if user has sufficient permissions
 *
 * @example
 * if (await hasAuditRole(AuditRole.MANAGER)) {
 *   // User is manager, owner, or admin
 * }
 */
export async function hasAuditRole(requiredRole: AuditRole): Promise<boolean> {
  try {
    const userRole = await getUserAuditRole();
    if (!userRole) return false;

    const userLevel = ROLE_HIERARCHY[userRole];
    const requiredLevel = ROLE_HIERARCHY[requiredRole];

    return userLevel >= requiredLevel;
  } catch (error) {
    console.error("[Audit] Error checking role:", error);
    return false;
  }
}

/**
 * Check if user can access audit trail
 * Any role grants basic access (filtered by RLS)
 *
 * @returns true if user has any audit role
 *
 * @example
 * if (await canAccessAuditTrail()) {
 *   // Show audit trail link
 * }
 */
export async function canAccessAuditTrail(): Promise<boolean> {
  const role = await getUserAuditRole();
  return role !== null;
}

/**
 * Check if current user is an admin
 * Convenience function for admin-only features
 *
 * @returns true if user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserAuditRole();
  return role === AuditRole.ADMIN;
}

/**
 * Check if current user is an admin or owner
 * Useful for features available to both admins and owners
 *
 * @returns true if user has admin or owner role
 */
export async function isAdminOrOwner(): Promise<boolean> {
  const role = await getUserAuditRole();
  return role === AuditRole.ADMIN || role === AuditRole.OWNER;
}

// ============================================
// ROLE MANAGEMENT FUNCTIONS (Admin-only)
// ============================================

/**
 * Grant a role to a user
 * Requires admin privileges
 *
 * @param userId - UUID of user receiving the role
 * @param email - Email of user (for denormalization)
 * @param role - Role to grant (admin, owner, manager, staff)
 * @param notes - Optional notes about why role was granted
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await grantRole(
 *   "user-uuid",
 *   "manager@resort.com",
 *   AuditRole.MANAGER,
 *   "New operations manager"
 * );
 */
export async function grantRole(
  userId: string,
  email: string,
  role: AuditRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can grant roles" };
    }

    // Get current user as the granter
    const {
      data: { user: granter },
    } = await supabase.auth.getUser();

    if (!granter) {
      return { success: false, error: "Not authenticated" };
    }

    // Insert role assignment
    const { error } = await supabase.from("app_roles").insert({
      user_id: userId,
      email,
      role,
      granted_by: granter.id,
      granted_at: new Date().toISOString(),
      is_active: true,
      notes: notes || null,
    });

    if (error) {
      // Handle duplicate key error
      if (error.code === "23505") {
        return {
          success: false,
          error: "User already has a role. Use updateRole() instead.",
        };
      }
      return { success: false, error: error.message };
    }

    // Role granted successfully — clear cache so new permissions are reflected
    clearRoleCache();
    return { success: true };
  } catch (error) {
    console.error("[Audit] Error granting role:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Revoke a user's role
 * Requires admin privileges
 * Cannot revoke own admin role (prevents lockout)
 *
 * @param userId - UUID of user whose role will be revoked
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await revokeRole("user-uuid");
 * if (!result.success) {
 *   console.error(result.error);
 * }
 */
export async function revokeRole(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can revoke roles" };
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Prevent self-revocation of admin role
    if (userId === user.id) {
      return {
        success: false,
        error: "Cannot revoke your own admin role (lockout prevention)",
      };
    }

    // Delete role assignment
    const { error } = await supabase.from("app_roles").delete().eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Role revoked successfully — clear cache so new permissions are reflected
    clearRoleCache();
    return { success: true };
  } catch (error) {
    console.error("[Audit] Error revoking role:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update a user's role
 * Requires admin privileges
 *
 * @param userId - UUID of user whose role will be updated
 * @param newRole - New role to assign
 * @param notes - Optional notes about the change
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await updateRole(
 *   "user-uuid",
 *   AuditRole.OWNER,
 *   "Promoted to owner"
 * );
 */
export async function updateRole(
  userId: string,
  newRole: AuditRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can update roles" };
    }

    // Get current user as the updater
    const {
      data: { user: updater },
    } = await supabase.auth.getUser();

    if (!updater) {
      return { success: false, error: "Not authenticated" };
    }

    // Update role assignment
    const { error } = await supabase
      .from("app_roles")
      .update({
        role: newRole,
        granted_by: updater.id,
        granted_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Role updated successfully — clear cache so new permissions are reflected
    clearRoleCache();
    return { success: true };
  } catch (error) {
    console.error("[Audit] Error updating role:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Deactivate a user's role (soft delete)
 * Requires admin privileges
 * Keeps the record but marks it as inactive
 *
 * @param userId - UUID of user whose role will be deactivated
 * @param notes - Optional notes about why role was deactivated
 * @returns Success status and error message if failed
 */
export async function deactivateRole(
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can deactivate roles" };
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Prevent self-deactivation of admin role
    if (userId === user.id) {
      return {
        success: false,
        error: "Cannot deactivate your own admin role (lockout prevention)",
      };
    }

    // Update role to inactive
    const { error } = await supabase
      .from("app_roles")
      .update({
        is_active: false,
        notes: notes || "Role deactivated",
      })
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Role deactivated successfully — clear cache so new permissions are reflected
    clearRoleCache();
    return { success: true };
  } catch (error) {
    console.error("[Audit] Error deactivating role:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// LISTING AND REPORTING FUNCTIONS
// ============================================

/**
 * List all users with their roles
 * Requires admin privileges
 *
 * @returns Array of users with roles, or error
 *
 * @example
 * const result = await listAllRoles();
 * if (result.success && result.data) {
 *   result.data.forEach(role => {
 *     logger.info(`${role.email}: ${role.role}`);
 *   });
 * }
 */
export async function listAllRoles(): Promise<{
  success: boolean;
  data?: AppRole[];
  error?: string;
}> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can list all roles" };
    }

    // Query all roles
    const { data, error } = await supabase
      .from("app_roles")
      .select("*")
      .order("role")
      .order("granted_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error("[Audit] Error listing roles:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * List active roles only
 * Requires admin privileges
 *
 * @returns Array of active users with roles
 */
export async function listActiveRoles(): Promise<{
  success: boolean;
  data?: AppRole[];
  error?: string;
}> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can list roles" };
    }

    // Query active roles only
    const { data, error } = await supabase
      .from("app_roles")
      .select("*")
      .eq("is_active", true)
      .order("role")
      .order("granted_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error("[Audit] Error listing active roles:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get a specific user's role information
 *
 * @param userId - UUID of user to check
 * @returns User's role information or null if no role
 */
export async function getUserRoleInfo(userId: string): Promise<AppRole | null> {
  try {
    const { data, error } = await supabase
      .from("app_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error("[Audit] Error getting user role info:", error);
    return null;
  }
}

/**
 * Count users by role
 * Requires admin privileges
 *
 * @returns Count of users per role
 */
export async function countUsersByRole(): Promise<{
  success: boolean;
  data?: Record<AuditRole, number>;
  error?: string;
}> {
  try {
    // Verify current user is admin
    const currentRole = await getUserAuditRole();
    if (currentRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can view role statistics" };
    }

    const { data, error } = await supabase.from("app_roles").select("role").eq("is_active", true);

    if (error) {
      return { success: false, error: error.message };
    }

    // Count by role
    const counts: Record<AuditRole, number> = {
      [AuditRole.ADMIN]: 0,
      [AuditRole.OWNER]: 0,
      [AuditRole.MANAGER]: 0,
      [AuditRole.STAFF]: 0,
    };

    data?.forEach((row) => {
      counts[row.role as AuditRole]++;
    });

    return { success: true, data: counts };
  } catch (error) {
    console.error("[Audit] Error counting roles:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get display name for a role
 *
 * @param role - Role enum value
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: AuditRole | "none"): string {
  const displayNames: Record<AuditRole | "none", string> = {
    [AuditRole.ADMIN]: "Administrator",
    [AuditRole.OWNER]: "Owner",
    [AuditRole.MANAGER]: "Manager",
    [AuditRole.STAFF]: "Staff",
    none: "No Role",
  };
  return displayNames[role];
}

/**
 * Get role badge color for UI
 *
 * @param role - Role enum value
 * @returns Tailwind color class
 */
export function getRoleBadgeColor(role: AuditRole | "none"): string {
  const colors: Record<AuditRole | "none", string> = {
    [AuditRole.ADMIN]: "bg-red-500",
    [AuditRole.OWNER]: "bg-purple-500",
    [AuditRole.MANAGER]: "bg-blue-500",
    [AuditRole.STAFF]: "bg-green-500",
    none: "bg-gray-400",
  };
  return colors[role];
}

/**
 * Check if a role change is valid
 * Admins can't be demoted, prevents lockout
 *
 * @param currentRole - Current role
 * @param newRole - Proposed new role
 * @returns true if change is allowed
 */
export function isRoleChangeValid(currentRole: AuditRole, newRole: AuditRole): boolean {
  // Prevent demotion of last admin (would need DB query to check properly)
  // This is a simple client-side check
  if (currentRole === AuditRole.ADMIN && newRole !== AuditRole.ADMIN) {
    console.warn("[Audit] Cannot demote admin - verify other admins exist first");
    return false;
  }
  return true;
}
