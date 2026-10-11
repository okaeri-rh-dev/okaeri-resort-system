/**
 * Regression: the `owner` app_role was missing from functions/lib/rbac.ts, so
 * owners failed staff-or-above and manager-or-above checks.
 * Role hierarchy: admin > owner > manager > staff.
 */

import { describe, expect, it } from "vitest";

import {
  isManagerOrAbove,
  isStaffOrAbove,
  MANAGER_OR_ABOVE,
  requireRole,
  STAFF_OR_ABOVE,
  type AuthenticatedUser,
} from "../../../functions/lib/rbac";

describe("rbac role tiers", () => {
  it("treats owner as staff-or-above and manager-or-above", () => {
    const owner: AuthenticatedUser = { id: "owner-id", role: "owner" };

    expect(isStaffOrAbove(owner)).toBe(true);
    expect(isManagerOrAbove(owner)).toBe(true);
    expect(() => requireRole(owner, STAFF_OR_ABOVE)).not.toThrow();
    expect(() => requireRole(owner, MANAGER_OR_ABOVE)).not.toThrow();
  });

  it("excludes owner from admin-only checks", () => {
    const owner: AuthenticatedUser = { id: "owner-id", role: "owner" };

    expect(() => requireRole(owner, ["admin"])).toThrow();
  });
});
