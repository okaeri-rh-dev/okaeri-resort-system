/**
 * Permission Guard Security Tests
 * Comprehensive security testing for RBAC and multi-tenant access control
 * Tests Philippine compliance and resort-specific permission scenarios
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PermissionGuard, permissionGuard } from "../permission-guard";
import { PERMISSIONS, SECURITY_ERROR_CODES } from "../constants";
import type { User, Permission, ProjectRole, UserRole } from "@/types/common";

// Mock users for testing different roles and scenarios
const createMockUser = (
  role: UserRole,
  projectRole?: ProjectRole,
  customPermissions?: Permission[]
): User => ({
  id: `user-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@okaeri.com`,
  firstName: role,
  lastName: "User",
  role: role as any,
  status: "active",
  projects: projectRole
    ? [
        {
          projectId: "project-123",
          role: projectRole,
          permissions: customPermissions || [],
          joinedAt: new Date().toISOString(),
        },
      ]
    : [],
  permissions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("Permission Guard Security Tests", () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    guard = PermissionGuard.getInstance();
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("should grant super admin full access to all resources", () => {
      const superAdmin = createMockUser("SUPER_ADMIN");

      // Test various resources
      const checks = [
        { resource: PERMISSIONS.RESOURCES.BOOKING, action: "delete" },
        { resource: PERMISSIONS.RESOURCES.USER, action: "delete" },
        { resource: PERMISSIONS.RESOURCES.AUDIT_LOG, action: "export" },
        { resource: "any-custom-resource", action: "any-action" },
      ];

      checks.forEach((check) => {
        const result = guard.hasPermission(superAdmin, check);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it("should enforce admin role permissions correctly", () => {
      const admin = createMockUser("ADMIN");

      // Should allow admin operations
      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "create",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.USER,
          action: "manage",
        })
      ).toEqual({ allowed: true });

      // Should deny super admin only operations
      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.PROJECT,
          action: "delete",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce manager role permissions correctly", () => {
      const manager = createMockUser("MANAGER");

      // Should allow manager operations
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "approve",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.EXPENSE,
          action: "update",
        })
      ).toEqual({ allowed: true });

      // Should deny delete operations
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Should deny user management
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.USER,
          action: "create",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce staff role permissions correctly", () => {
      const staff = createMockUser("STAFF");

      // Should allow basic operations
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "create",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.EXPENSE,
          action: "read",
        })
      ).toEqual({ allowed: true });

      // Should deny approval operations
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "approve",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Should deny property modifications
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "update",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce viewer role permissions correctly", () => {
      const viewer = createMockUser("VIEWER");

      // Should allow read-only operations
      expect(
        guard.hasPermission(viewer, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(viewer, {
          resource: PERMISSIONS.RESOURCES.REPORT,
          action: "read",
        })
      ).toEqual({ allowed: true });

      // Should deny all write operations
      const writeActions = ["create", "update", "delete", "approve"];
      writeActions.forEach((action) => {
        expect(
          guard.hasPermission(viewer, {
            resource: PERMISSIONS.RESOURCES.BOOKING,
            action,
          })
        ).toEqual({
          allowed: false,
          reason: "Insufficient permissions",
          code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        });
      });
    });
  });

  describe("Multi-Tenant Project Permissions", () => {
    it("should enforce project-specific permissions", () => {
      const user = createMockUser("STAFF", "ADMIN", [
        { resource: PERMISSIONS.RESOURCES.BOOKING, actions: ["delete"] },
      ]);

      // Should allow project-specific permission
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-123",
        })
      ).toEqual({ allowed: true });

      // Should deny for different project
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-456",
        })
      ).toEqual({
        allowed: false,
        reason: "Not a member of this project",
      });

      // Should fall back to role permissions without projectId
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
        })
      ).toEqual({ allowed: true });
    });

    it("should enforce project role hierarchy", () => {
      const projectOwner = createMockUser("VIEWER", "OWNER");
      const projectAdmin = createMockUser("VIEWER", "ADMIN");
      const projectMember = createMockUser("VIEWER", "MEMBER");

      // Project owner should have elevated permissions
      expect(
        guard.hasPermission(projectOwner, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-123",
        })
      ).toEqual({ allowed: true });

      // Project admin should have management permissions
      expect(
        guard.hasPermission(projectAdmin, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "approve",
          projectId: "project-123",
        })
      ).toEqual({ allowed: true });

      // Project member should have limited permissions
      expect(
        guard.hasPermission(projectMember, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
          projectId: "project-123",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(projectMember, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-123",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should validate cross-project access attempts", () => {
      const user = createMockUser("ADMIN");
      user.projects = [
        {
          projectId: "project-A",
          role: "OWNER",
          permissions: [],
          joinedAt: new Date().toISOString(),
        },
        {
          projectId: "project-B",
          role: "VIEWER",
          permissions: [],
          joinedAt: new Date().toISOString(),
        },
      ];

      // Should allow owner actions in project A
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-A",
        })
      ).toEqual({ allowed: true });

      // Should restrict to viewer actions in project B
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "delete",
          projectId: "project-B",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Should deny access to project C
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
          projectId: "project-C",
        })
      ).toEqual({
        allowed: false,
        reason: "Not a member of this project",
      });
    });
  });

  describe("Philippine Compliance Requirements", () => {
    it("should enforce data privacy restrictions for guest data", () => {
      const staff = createMockUser("STAFF");
      const viewer = createMockUser("VIEWER");

      // Staff should access guest data with restrictions
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.GUEST,
          action: "read",
        })
      ).toEqual({ allowed: true });

      // Viewer should not access sensitive guest data
      expect(
        guard.hasPermission(viewer, {
          resource: PERMISSIONS.RESOURCES.GUEST,
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce audit log access restrictions", () => {
      const admin = createMockUser("ADMIN");
      const manager = createMockUser("MANAGER");

      // Admin should read and export audit logs
      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.AUDIT_LOG,
          action: "read",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.AUDIT_LOG,
          action: "export",
        })
      ).toEqual({ allowed: true });

      // Manager should not access audit logs
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.AUDIT_LOG,
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce financial data access restrictions", () => {
      const manager = createMockUser("MANAGER");
      const staff = createMockUser("STAFF");

      // Manager should approve expenses
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.EXPENSE,
          action: "approve",
        })
      ).toEqual({ allowed: true });

      // Staff should not approve expenses
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.EXPENSE,
          action: "approve",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Staff should not delete financial records
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.EXPENSE,
          action: "delete",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });
  });

  describe("Resort Management Specific Scenarios", () => {
    it("should enforce booking management permissions", () => {
      const frontDesk = createMockUser("STAFF");
      const manager = createMockUser("MANAGER");

      // Front desk can create and update bookings
      expect(
        guard.hasPermission(frontDesk, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "create",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(frontDesk, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "update",
        })
      ).toEqual({ allowed: true });

      // Only manager can approve special rates
      expect(
        guard.hasPermission(frontDesk, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "approve",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "approve",
        })
      ).toEqual({ allowed: true });
    });

    it("should enforce property management permissions", () => {
      const admin = createMockUser("ADMIN");
      const manager = createMockUser("MANAGER");
      const staff = createMockUser("STAFF");

      // Admin can manage properties
      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "create",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "delete",
        })
      ).toEqual({ allowed: true });

      // Manager can update but not delete properties
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "update",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "delete",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Staff can only view properties
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "read",
        })
      ).toEqual({ allowed: true });

      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.PROPERTY,
          action: "update",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should enforce payment processing permissions", () => {
      const admin = createMockUser("ADMIN");
      const manager = createMockUser("MANAGER");
      const staff = createMockUser("STAFF");

      // Admin can process refunds
      expect(
        guard.hasPermission(admin, {
          resource: PERMISSIONS.RESOURCES.PAYMENT,
          action: "refund",
        })
      ).toEqual({ allowed: true });

      // Manager cannot process refunds
      expect(
        guard.hasPermission(manager, {
          resource: PERMISSIONS.RESOURCES.PAYMENT,
          action: "refund",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Staff cannot access payment data
      expect(
        guard.hasPermission(staff, {
          resource: PERMISSIONS.RESOURCES.PAYMENT,
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });
  });

  describe("Security Edge Cases and Attack Scenarios", () => {
    it("should reject null or undefined users", () => {
      expect(
        guard.hasPermission(null, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "User not authenticated",
        code: SECURITY_ERROR_CODES.INVALID_TOKEN,
      });

      expect(
        guard.hasPermission(undefined as any, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "User not authenticated",
        code: SECURITY_ERROR_CODES.INVALID_TOKEN,
      });
    });

    it("should handle malformed permission checks", () => {
      const user = createMockUser("ADMIN");

      // Empty resource
      expect(
        guard.hasPermission(user, {
          resource: "",
          action: "read",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Empty action
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should prevent privilege escalation attempts", () => {
      const user = createMockUser("STAFF");

      // Attempt to access admin resources
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.ADMIN,
          action: "manage",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Attempt to modify own permissions
      expect(
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.USER,
          action: "update",
          ownerId: user.id,
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    });

    it("should handle wildcard permissions correctly", () => {
      const customUser: User = {
        ...createMockUser("STAFF"),
        permissions: [
          { resource: "*", actions: ["read"] }, // Read everything
          { resource: "custom", actions: ["*"] }, // All actions on custom
        ],
      };

      // Should allow reading any resource
      expect(
        guard.hasPermission(customUser, {
          resource: "any-resource",
          action: "read",
        })
      ).toEqual({ allowed: true });

      // Should not allow writing to any resource
      expect(
        guard.hasPermission(customUser, {
          resource: "any-resource",
          action: "write",
        })
      ).toEqual({
        allowed: false,
        reason: "Insufficient permissions",
        code: SECURITY_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });

      // Should allow any action on custom resource
      expect(
        guard.hasPermission(customUser, {
          resource: "custom",
          action: "any-action",
        })
      ).toEqual({ allowed: true });
    });
  });

  describe("Helper Methods", () => {
    it("should check project access correctly", () => {
      const user = createMockUser("STAFF");
      user.projects = [
        {
          projectId: "project-123",
          role: "MEMBER",
          permissions: [],
          joinedAt: new Date().toISOString(),
        },
      ];

      expect(guard.canAccessProject(user, "project-123")).toBe(true);
      expect(guard.canAccessProject(user, "project-456")).toBe(false);
      expect(guard.canAccessProject(null, "project-123")).toBe(false);

      // Super admin can access all projects
      const superAdmin = createMockUser("SUPER_ADMIN");
      expect(guard.canAccessProject(superAdmin, "any-project")).toBe(true);
    });

    it("should check resource ownership correctly", () => {
      const user = createMockUser("STAFF");

      expect(guard.isResourceOwner(user, user.id)).toBe(true);
      expect(guard.isResourceOwner(user, "other-user-id")).toBe(false);
      expect(guard.isResourceOwner(null, user.id)).toBe(false);
      expect(guard.isResourceOwner(user, undefined)).toBe(false);
    });

    it("should get effective permissions correctly", () => {
      const user = createMockUser("MANAGER", "OWNER", [
        { resource: "custom", actions: ["special"] },
      ]);

      const permissions = guard.getEffectivePermissions(user, "project-123");

      // Should include role permissions
      expect(permissions).toContainEqual(
        expect.objectContaining({
          resource: PERMISSIONS.RESOURCES.BOOKING,
          actions: expect.arrayContaining(["create", "read", "update"]),
        })
      );

      // Should include project permissions
      expect(permissions).toContainEqual(
        expect.objectContaining({
          resource: "custom",
          actions: ["special"],
        })
      );

      // Should be deduplicated
      const bookingPermissions = permissions.filter(
        (p) => p.resource === PERMISSIONS.RESOURCES.BOOKING
      );
      expect(bookingPermissions).toHaveLength(1);
    });

    it("should deduplicate permissions correctly", () => {
      const user: User = {
        ...createMockUser("STAFF"),
        permissions: [
          { resource: "booking", actions: ["read", "create"] },
          { resource: "booking", actions: ["read", "update"] },
          { resource: "booking", actions: ["create"] }, // Duplicate
        ],
      };

      const permissions = guard.getEffectivePermissions(user);
      const bookingPermission = permissions.find((p) => p.resource === "booking");

      expect(bookingPermission).toEqual({
        resource: "booking",
        actions: expect.arrayContaining(["read", "create", "update"]),
      });

      // Should not have duplicate actions
      const actionSet = new Set(bookingPermission?.actions || []);
      expect(actionSet.size).toBe(bookingPermission?.actions.length);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle users with many permissions efficiently", () => {
      const user = createMockUser("STAFF");
      user.permissions = [];

      // Add many permissions
      for (let i = 0; i < 100; i++) {
        user.permissions.push({
          resource: `resource-${i}`,
          actions: ["read", "write", "delete"],
        });
      }

      const startTime = performance.now();

      // Check multiple permissions
      for (let i = 0; i < 100; i++) {
        guard.hasPermission(user, {
          resource: `resource-${i}`,
          action: "read",
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (100ms for 100 checks)
      expect(duration).toBeLessThan(100);
    });

    it("should handle users in many projects efficiently", () => {
      const user = createMockUser("STAFF");
      user.projects = [];

      // Add many project memberships
      for (let i = 0; i < 50; i++) {
        user.projects.push({
          projectId: `project-${i}`,
          role: "MEMBER",
          permissions: [{ resource: PERMISSIONS.RESOURCES.BOOKING, actions: ["read"] }],
          joinedAt: new Date().toISOString(),
        });
      }

      const startTime = performance.now();

      // Check permissions across projects
      for (let i = 0; i < 50; i++) {
        guard.hasPermission(user, {
          resource: PERMISSIONS.RESOURCES.BOOKING,
          action: "read",
          projectId: `project-${i}`,
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete efficiently
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Singleton Pattern", () => {
    it("should maintain single instance", () => {
      const instance1 = PermissionGuard.getInstance();
      const instance2 = PermissionGuard.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(permissionGuard);
    });
  });
});
