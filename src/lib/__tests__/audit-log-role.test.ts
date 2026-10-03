/**
 * Regression: db.auditLogs.create filled audit_logs.user_role from
 * user_metadata.role, which any user can set via supabase.auth.updateUser.
 * The role must come from app_roles (get_current_audit_role).
 */

import { describe, expect, it, vi } from "vitest";

const inserted: Array<Record<string, unknown>> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "u1", email: "u1@example.com", user_metadata: { role: "admin" } } },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      },
    }),
  })),
}));

vi.mock("@/lib/audit-roles", () => ({ getUserAuditRole: vi.fn(async () => "staff") }));

describe("db.auditLogs.create", () => {
  it("records the app_roles role, not the user-editable metadata role", async () => {
    const { db } = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");

    await db.auditLogs.create({ tableName: "bookings", description: "test" });

    expect(inserted[0]?.user_role).toBe("staff");
  });
});
