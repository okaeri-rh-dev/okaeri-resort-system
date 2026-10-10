// src/lib/audit-logger.ts

import { getUserAuditRole as getUserRole } from "./audit-roles";

/**
 * Check if current user is an owner (full audit access)
 * Now uses app_roles table instead of environment variables
 * @returns true if user is owner or admin
 * @deprecated Use getUserAuditRole() or canAccessAuditTrail() instead
 */
export async function isCurrentUserOwner(): Promise<boolean> {
  const role = await getUserRole();
  return role === "owner" || role === "admin";
}
