// src/hooks/useRoleManagement.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { pendingUsersKeys } from "@/hooks/usePendingUsers";
import {
  AuditRole,
  countUsersByRole,
  deactivateRole,
  grantRole,
  listActiveRoles,
  listAllRoles,
  updateRole,
  type AppRole,
} from "@/lib/audit-roles";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { AuditLog } from "@/types/audit.types";

// ============================================
// QUERY KEYS
// ============================================

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  list: (filters: string) => [...roleKeys.lists(), { filters }] as const,
  details: () => [...roleKeys.all, "detail"] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  stats: () => [...roleKeys.all, "stats"] as const,
  history: (userId: string) => [...roleKeys.all, "history", userId] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all roles (active and inactive)
 * Admin-only - will fail if user is not admin
 */
export function useAllRoles() {
  return useQuery({
    queryKey: roleKeys.list("all"),
    queryFn: async () => {
      const result = await listAllRoles();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch roles");
      }
      return result.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });
}

/**
 * Fetch active roles only
 * Admin-only - will fail if user is not admin
 */
export function useActiveRoles() {
  return useQuery({
    queryKey: roleKeys.list("active"),
    queryFn: async () => {
      const result = await listActiveRoles();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch active roles");
      }
      return result.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });
}

/**
 * Fetch role statistics (count by role type)
 * Admin-only - will fail if user is not admin
 */
export function useRoleStats() {
  return useQuery({
    queryKey: roleKeys.stats(),
    queryFn: async () => {
      const result = await countUsersByRole();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch role statistics");
      }
      return result.data || { admin: 0, owner: 0, manager: 0, staff: 0 };
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

/**
 * Fetch role change history for a specific user
 * Queries audit_logs table for all role-related events
 * Admin-only - will fail if user is not admin
 *
 * @param userId - UUID of the user whose history to fetch
 * @returns Query result with audit log entries
 */
export function useRoleHistory(userId: string | null) {
  return useQuery({
    queryKey: roleKeys.history(userId || ""),
    queryFn: async () => {
      if (!userId) return [];

      // Query audit_logs for role changes
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "app_roles")
        .eq("record_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("Failed to fetch role history", { error, userId });
        throw new Error(error.message);
      }

      return (data || []) as AuditLog[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Grant a role to a user
 * Admin-only mutation
 */
export function useGrantRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      email,
      role,
      notes,
    }: {
      userId: string;
      email: string;
      role: AuditRole;
      notes?: string;
    }) => {
      logger.info("Granting role", { userId, email, role });

      const result = await grantRole(userId, email, role, notes);

      if (!result.success) {
        throw new Error(result.error || "Failed to grant role");
      }

      return result;
    },
    onSuccess: (_data, variables) => {
      logger.info("Role granted successfully", { email: variables.email, role: variables.role });

      // Invalidate all role queries and pending users list
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: pendingUsersKeys.all });
    },
    onError: (error, variables) => {
      logger.error("Failed to grant role", {
        error,
        email: variables.email,
        role: variables.role,
      });
    },
  });
}

/**
 * Update an existing user's role
 * Admin-only mutation
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      newRole,
      notes,
    }: {
      userId: string;
      newRole: AuditRole;
      notes?: string;
    }) => {
      logger.info("Updating role", { userId, newRole });

      const result = await updateRole(userId, newRole, notes);

      if (!result.success) {
        throw new Error(result.error || "Failed to update role");
      }

      return result;
    },
    onMutate: async ({ userId, newRole }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: roleKeys.all });

      // Snapshot previous value
      const previousRoles = queryClient.getQueryData<AppRole[]>(roleKeys.list("all"));

      // Optimistically update
      if (previousRoles) {
        queryClient.setQueryData<AppRole[]>(
          roleKeys.list("all"),
          previousRoles.map((r) => (r.user_id === userId ? { ...r, role: newRole } : r))
        );
      }

      return { previousRoles };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousRoles) {
        queryClient.setQueryData(roleKeys.list("all"), context.previousRoles);
      }
      logger.error("Failed to update role", { error });
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

/**
 * Deactivate a user's role (soft delete)
 * Admin-only mutation
 */
export function useDeactivateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, notes }: { userId: string; notes?: string }) => {
      logger.info("Deactivating role", { userId });

      const result = await deactivateRole(userId, notes);

      if (!result.success) {
        throw new Error(result.error || "Failed to deactivate role");
      }

      return result;
    },
    onMutate: async ({ userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: roleKeys.all });

      // Snapshot previous value
      const previousRoles = queryClient.getQueryData<AppRole[]>(roleKeys.list("all"));

      // Optimistically update
      if (previousRoles) {
        queryClient.setQueryData<AppRole[]>(
          roleKeys.list("all"),
          previousRoles.map((r) => (r.user_id === userId ? { ...r, is_active: false } : r))
        );
      }

      return { previousRoles };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousRoles) {
        queryClient.setQueryData(roleKeys.list("all"), context.previousRoles);
      }
      logger.error("Failed to deactivate role", { error });
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}
