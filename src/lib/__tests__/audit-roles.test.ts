// src/lib/__tests__/audit-roles.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuditRole,
  canAccessAuditTrail,
  getRoleBadgeColor,
  getRoleDisplayName,
  getUserAuditRole,
  grantRole,
  hasAuditRole,
  isRoleChangeValid,
  revokeRole,
} from "../audit-roles";
import { supabase } from "../supabase";

// Mock supabase client
vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe("Audit Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUserAuditRole", () => {
    it("should return user role when authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "admin@test.com" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      const role = await getUserAuditRole();
      expect(role).toBe(AuditRole.ADMIN);
      expect(supabase.rpc).toHaveBeenCalledWith("get_current_audit_role");
    });

    it("should return null when no role assigned", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "user@test.com" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "none",
        error: null,
      } as any);

      const role = await getUserAuditRole();
      expect(role).toBeNull();
    });

    it("should return null when not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null } as any,
        error: null,
      } as any);

      const role = await getUserAuditRole();
      expect(role).toBeNull();
    });

    it("should handle RPC errors gracefully", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "user@test.com" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Database error" } as any,
      } as any);

      const role = await getUserAuditRole();
      expect(role).toBeNull();
    });
  });

  describe("hasAuditRole", () => {
    it("should return true when user has exact role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "manager",
        error: null,
      } as any);

      const result = await hasAuditRole(AuditRole.MANAGER);
      expect(result).toBe(true);
    });

    it("should return true when user has higher role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      const result = await hasAuditRole(AuditRole.STAFF);
      expect(result).toBe(true);
    });

    it("should return false when user has lower role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "staff",
        error: null,
      } as any);

      const result = await hasAuditRole(AuditRole.OWNER);
      expect(result).toBe(false);
    });

    it("should return false when user has no role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "none",
        error: null,
      } as any);

      const result = await hasAuditRole(AuditRole.STAFF);
      expect(result).toBe(false);
    });
  });

  describe("canAccessAuditTrail", () => {
    it("should return true when user has any role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "staff",
        error: null,
      } as any);

      const result = await canAccessAuditTrail();
      expect(result).toBe(true);
    });

    it("should return false when user has no role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "none",
        error: null,
      } as any);

      const result = await canAccessAuditTrail();
      expect(result).toBe(false);
    });
  });

  describe("grantRole", () => {
    it("should grant role when user is admin", async () => {
      // Mock current user as admin
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "admin-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      // Mock successful insert
      const fromMock = {
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      };
      vi.mocked(supabase.from).mockReturnValue(fromMock as any);

      const result = await grantRole("user-456", "user@test.com", AuditRole.MANAGER, "New manager");

      expect(result.success).toBe(true);
      expect(fromMock.insert).toHaveBeenCalledWith({
        user_id: "user-456",
        email: "user@test.com",
        role: AuditRole.MANAGER,
        granted_by: "admin-123",
        granted_at: expect.any(String),
        is_active: true,
        notes: "New manager",
      });
    });

    it("should fail when user is not admin", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "manager",
        error: null,
      } as any);

      const result = await grantRole("user-456", "user@test.com", AuditRole.STAFF, "New staff");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only admins can grant roles");
    });

    it("should handle duplicate role error", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "admin-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      const fromMock = {
        insert: vi.fn().mockResolvedValue({
          error: { code: "23505", message: "Duplicate key" },
        }),
      };
      vi.mocked(supabase.from).mockReturnValue(fromMock as any);

      const result = await grantRole("user-456", "user@test.com", AuditRole.MANAGER);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already has a role");
    });
  });

  describe("revokeRole", () => {
    it("should revoke role when user is admin", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "admin-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      const fromMock = {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      };
      vi.mocked(supabase.from).mockReturnValue(fromMock as any);

      const result = await revokeRole("user-456");

      expect(result.success).toBe(true);
      expect(fromMock.delete).toHaveBeenCalled();
    });

    it("should prevent admin from revoking own role", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "admin-123" } as any },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "admin",
        error: null,
      } as any);

      const result = await revokeRole("admin-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot revoke your own admin role");
    });
  });

  describe("utility functions", () => {
    describe("getRoleDisplayName", () => {
      it("should return correct display names", () => {
        expect(getRoleDisplayName(AuditRole.ADMIN)).toBe("Administrator");
        expect(getRoleDisplayName(AuditRole.OWNER)).toBe("Owner");
        expect(getRoleDisplayName(AuditRole.MANAGER)).toBe("Manager");
        expect(getRoleDisplayName(AuditRole.STAFF)).toBe("Staff");
        expect(getRoleDisplayName("none")).toBe("No Role");
      });
    });

    describe("getRoleBadgeColor", () => {
      it("should return correct badge colors", () => {
        expect(getRoleBadgeColor(AuditRole.ADMIN)).toBe("bg-red-500");
        expect(getRoleBadgeColor(AuditRole.OWNER)).toBe("bg-purple-500");
        expect(getRoleBadgeColor(AuditRole.MANAGER)).toBe("bg-blue-500");
        expect(getRoleBadgeColor(AuditRole.STAFF)).toBe("bg-green-500");
        expect(getRoleBadgeColor("none")).toBe("bg-gray-400");
      });
    });

    describe("isRoleChangeValid", () => {
      it("should allow non-admin role changes", () => {
        expect(isRoleChangeValid(AuditRole.MANAGER, AuditRole.OWNER)).toBe(true);
        expect(isRoleChangeValid(AuditRole.STAFF, AuditRole.MANAGER)).toBe(true);
      });

      it("should prevent demotion of admin", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(isRoleChangeValid(AuditRole.ADMIN, AuditRole.OWNER)).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot demote admin"));
        consoleSpy.mockRestore();
      });

      it("should allow admin to remain admin", () => {
        expect(isRoleChangeValid(AuditRole.ADMIN, AuditRole.ADMIN)).toBe(true);
      });
    });
  });
});
