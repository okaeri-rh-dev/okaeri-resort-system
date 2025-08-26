/**
 * Permission-based access control guard
 * Implements RBAC with fine-grained permissions
 */

import { PERMISSIONS, SECURITY_ERROR_CODES } from "./constants";
import type { User, Permission, ProjectRole, UserRole } from "@/types/common";

export interface PermissionCheck {
  resource: string;
  action: string;
  projectId?: string;
  ownerId?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

/**
 * Role hierarchy for inheritance
 */
const ROLE_HIERARCHY: Record<string, string[]> = {
  SUPER_ADMIN: ["ADMIN", "MANAGER", "STAFF", "VIEWER"],
  ADMIN: ["MANAGER", "STAFF", "VIEWER"],
  MANAGER: ["STAFF", "VIEWER"],
  STAFF: ["VIEWER"],
  VIEWER: [],
};

/**
 * Project role hierarchy
 */
const PROJECT_ROLE_HIERARCHY: Record<string, string[]> = {
  OWNER: ["ADMIN", "MANAGER", "MEMBER", "VIEWER"],
  ADMIN: ["MANAGER", "MEMBER", "VIEWER"],
  MANAGER: ["MEMBER", "VIEWER"],
  MEMBER: ["VIEWER"],
  VIEWER: [],
};

/**
 * Default permissions by role
 */
const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    { resource: "*", actions: ["*"] }, // Full access
  ],
  ADMIN: [
    { resource: PERMISSIONS.RESOURCES.BOOKING, actions: Object.values(PERMISSIONS.ACTIONS) },
    { resource: PERMISSIONS.RESOURCES.PROPERTY, actions: Object.values(PERMISSIONS.ACTIONS) },
    { resource: PERMISSIONS.RESOURCES.EXPENSE, actions: Object.values(PERMISSIONS.ACTIONS) },
    { resource: PERMISSIONS.RESOURCES.REPORT, actions: Object.values(PERMISSIONS.ACTIONS) },
    { resource: PERMISSIONS.RESOURCES.USER, actions: ["create", "read", "update", "manage"] },
    { resource: PERMISSIONS.RESOURCES.PROJECT, actions: ["read", "update", "manage"] },
    { resource: PERMISSIONS.RESOURCES.SETTINGS, actions: ["read", "update", "manage"] },
    { resource: PERMISSIONS.RESOURCES.AUDIT_LOG, actions: ["read", "export"] },
  ],
  MANAGER: [
    { resource: PERMISSIONS.RESOURCES.BOOKING, actions: ["create", "read", "update", "approve"] },
    { resource: PERMISSIONS.RESOURCES.PROPERTY, actions: ["create", "read", "update"] },
    { resource: PERMISSIONS.RESOURCES.EXPENSE, actions: ["create", "read", "update", "approve"] },
    { resource: PERMISSIONS.RESOURCES.REPORT, actions: ["read", "export"] },
    { resource: PERMISSIONS.RESOURCES.USER, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.PROJECT, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.SETTINGS, actions: ["read"] },
  ],
  STAFF: [
    { resource: PERMISSIONS.RESOURCES.BOOKING, actions: ["create", "read", "update"] },
    { resource: PERMISSIONS.RESOURCES.PROPERTY, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.EXPENSE, actions: ["create", "read"] },
    { resource: PERMISSIONS.RESOURCES.REPORT, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.USER, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.PROJECT, actions: ["read"] },
  ],
  VIEWER: [
    { resource: PERMISSIONS.RESOURCES.BOOKING, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.PROPERTY, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.EXPENSE, actions: ["read"] },
    { resource: PERMISSIONS.RESOURCES.REPORT, actions: ["read"] },
  ],
};

export class PermissionGuard {
  private static instance: PermissionGuard;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): PermissionGuard {
    if (!PermissionGuard.instance) {
      PermissionGuard.instance = new PermissionGuard();
    }
    return PermissionGuard.instance;
  }

  /**
   * Check if user has permission for a specific action on a resource
   */
  hasPermission(user: User | null, check: PermissionCheck): PermissionResult {
    // No user, no access
    if (!user) {
      return {
        allowed: false,
        reason: "User not authenticated",
        code: SECURITY_ERROR_CODES.INVALID_TOKEN,
      };
    }

    // Super admin has all permissions
    if (user.role === "SUPER_ADMIN") {
      return { allowed: true };
    }

    // Check project-specific permissions if projectId provided
    if (check.projectId) {
      const projectPermission = this.checkProjectPermission(user, check);
      if (projectPermission.allowed) {
        return projectPermission;
      }
    }

    // Check role-based permissions
    const rolePermission = this.checkRolePermission(user.role, check);
    if (rolePermission.allowed) {
      return rolePermission;
    }

    // Check inherited permissions from role hierarchy
    const inheritedPermission = this.checkInheritedPermission(user.role, check);
    if (inheritedPermission.allowed) {
      return inheritedPermission;
    }

    return {
      allowed: false,
      reason: "Insufficient permissions",
      code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    };
  }

  /**
   * Check project-specific permissions
   */
  private checkProjectPermission(user: User, check: PermissionCheck): PermissionResult {
    if (!check.projectId || !user.projects) {
      return { allowed: false };
    }

    const membership = user.projects.find((p) => p.projectId === check.projectId);
    if (!membership) {
      return {
        allowed: false,
        reason: "Not a member of this project",
      };
    }

    // Check if user has specific permission in project
    const hasPermission = membership.permissions.some((permission) =>
      this.matchesPermission(permission, check.resource, check.action)
    );

    if (hasPermission) {
      return { allowed: true };
    }

    // Check default permissions for project role
    const projectRolePermissions = this.getProjectRolePermissions(membership.role);
    const hasRolePermission = projectRolePermissions.some((permission) =>
      this.matchesPermission(permission, check.resource, check.action)
    );

    return { allowed: hasRolePermission };
  }

  /**
   * Check role-based permissions
   */
  private checkRolePermission(role: string, check: PermissionCheck): PermissionResult {
    const permissions = DEFAULT_PERMISSIONS[role] || [];

    const hasPermission = permissions.some((permission) =>
      this.matchesPermission(permission, check.resource, check.action)
    );

    return { allowed: hasPermission };
  }

  /**
   * Check inherited permissions from role hierarchy
   */
  private checkInheritedPermission(role: string, check: PermissionCheck): PermissionResult {
    const inheritedRoles = ROLE_HIERARCHY[role] || [];

    for (const inheritedRole of inheritedRoles) {
      const permission = this.checkRolePermission(inheritedRole, check);
      if (permission.allowed) {
        return permission;
      }
    }

    return { allowed: false };
  }

  /**
   * Check if permission matches the resource and action
   */
  private matchesPermission(permission: Permission, resource: string, action: string): boolean {
    // Wildcard permission
    if (permission.resource === "*" && permission.actions.includes("*")) {
      return true;
    }

    // Check resource match
    const resourceMatch = permission.resource === "*" || permission.resource === resource;
    if (!resourceMatch) {
      return false;
    }

    // Check action match
    const actionMatch = permission.actions.includes("*") || permission.actions.includes(action);

    return actionMatch;
  }

  /**
   * Get default permissions for project role
   */
  private getProjectRolePermissions(role: ProjectRole): Permission[] {
    const rolePermissions: Record<ProjectRole, Permission[]> = {
      OWNER: DEFAULT_PERMISSIONS.ADMIN || [],
      ADMIN: DEFAULT_PERMISSIONS.MANAGER || [],
      MANAGER: DEFAULT_PERMISSIONS.STAFF || [],
      MEMBER: DEFAULT_PERMISSIONS.VIEWER || [],
      VIEWER: DEFAULT_PERMISSIONS.VIEWER || [],
    };

    return rolePermissions[role] || [];
  }

  /**
   * Check if user can access a specific project
   */
  canAccessProject(user: User | null, projectId: string): boolean {
    if (!user) return false;

    // Super admin can access all projects
    if (user.role === "SUPER_ADMIN") return true;

    // Check if user is member of the project
    return user.projects?.some((p) => p.projectId === projectId) || false;
  }

  /**
   * Check if user owns a resource
   */
  isResourceOwner(user: User | null, ownerId: string | undefined): boolean {
    if (!user || !ownerId) return false;
    return user.id === ownerId;
  }

  /**
   * Get user's effective permissions for a project
   */
  getEffectivePermissions(user: User | null, projectId?: string): Permission[] {
    if (!user) return [];

    // Super admin has all permissions
    if (user.role === "SUPER_ADMIN") {
      return [{ resource: "*", actions: ["*"] }];
    }

    let permissions: Permission[] = [];

    // Add role-based permissions
    permissions = [...(DEFAULT_PERMISSIONS[user.role] || [])];

    // Add project-specific permissions if projectId provided
    if (projectId && user.projects) {
      const membership = user.projects.find((p) => p.projectId === projectId);
      if (membership) {
        permissions = [...permissions, ...membership.permissions];

        // Add project role permissions
        const projectRolePermissions = this.getProjectRolePermissions(membership.role);
        permissions = [...permissions, ...projectRolePermissions];
      }
    }

    // Deduplicate permissions
    return this.deduplicatePermissions(permissions);
  }

  /**
   * Deduplicate permissions array
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const map = new Map<string, Set<string>>();

    for (const permission of permissions) {
      if (!map.has(permission.resource)) {
        map.set(permission.resource, new Set());
      }

      const actions = map.get(permission.resource)!;
      permission.actions.forEach((action) => actions.add(action));
    }

    return Array.from(map.entries()).map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions),
    }));
  }
}

// Export singleton instance
export const permissionGuard = PermissionGuard.getInstance();
