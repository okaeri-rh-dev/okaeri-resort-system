// src/hooks/useUserRole.ts
// Hook for accessing current user's role and permission flags
// Used for role-based UI rendering (hiding/showing actions)

import { useQuery } from "@tanstack/react-query";

import { AuditRole, getUserAuditRole } from "@/lib/audit-roles";

// ============================================
// QUERY KEYS
// ============================================

export const userRoleKeys = {
  current: ["user-role", "current"] as const,
};

// ============================================
// HOOK
// ============================================

/**
 * Hook to get current user's role and permission flags
 *
 * This hook caches the role result to avoid repeated database calls.
 * It's designed for UI rendering decisions, not for security checks
 * (those should always happen on the backend).
 *
 * @example
 * const { role, canEdit, canDelete, isStaff, isLoading } = useUserRole();
 *
 * // Filter actions based on permissions
 * const visibleActions = actions.filter(action => {
 *   if (action.type === 'delete' && !canDelete) return false;
 *   if (action.type === 'edit' && !canEdit) return false;
 *   return true;
 * });
 */
export function useUserRole() {
  const { data: role, isLoading } = useQuery({
    queryKey: userRoleKeys.current,
    queryFn: getUserAuditRole,
    staleTime: 5 * 60 * 1000, // 5 minutes - role changes are infrequent
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
  });

  // ============================================
  // PERMISSION FLAGS
  // ============================================

  // Staff can only view - no edit/delete permissions
  const isStaff = role === AuditRole.STAFF;

  // Manager or higher can edit
  const isManager =
    role === AuditRole.MANAGER || role === AuditRole.OWNER || role === AuditRole.ADMIN;

  // Owner or higher for most edit actions
  const isOwner = role === AuditRole.OWNER || role === AuditRole.ADMIN;

  // Only admin can do administrative tasks
  const isAdmin = role === AuditRole.ADMIN;

  // Can edit bookings, payments, etc. (manager+)
  const canEdit = !isStaff && role !== null;

  // Can delete records (owner+)
  const canDelete = isOwner || isAdmin;

  // Can confirm/cancel bookings (manager+)
  const canConfirmBookings = isManager;

  // Can verify/reject payments (manager+)
  const canVerifyPayments = isManager;

  return {
    // Role value
    role,
    isLoading,

    // Role type flags
    isStaff,
    isManager,
    isOwner,
    isAdmin,

    // Action permission flags
    canEdit,
    canDelete,
    canConfirmBookings,
    canVerifyPayments,
  };
}
