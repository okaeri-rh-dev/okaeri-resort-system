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
} from "../../../functions/lib/rbac";
import { createMockRequest, generateTestJWT } from "./setup";

type RoleRequest = Request & { user: { role: string } };

async function requestAs(role: string, path: string): Promise<Request> {
  const request = createMockRequest(`https://api.example.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await generateTestJWT()}` },
    body: JSON.stringify({}),
  }) as RoleRequest;
  request.user.role = role;
  return request;
}

describe("rbac role tiers", () => {
  it("treats owner as staff-or-above and manager-or-above", async () => {
    const request = await requestAs("owner", "/api/x");

    expect(isStaffOrAbove(request)).toBe(true);
    expect(isManagerOrAbove(request)).toBe(true);
    expect(() => requireRole(request, STAFF_OR_ABOVE)).not.toThrow();
    expect(() => requireRole(request, MANAGER_OR_ABOVE)).not.toThrow();
  });

  it("excludes owner from admin-only checks", async () => {
    const request = await requestAs("owner", "/api/x");

    expect(() => requireRole(request, ["admin"])).toThrow();
  });
});
