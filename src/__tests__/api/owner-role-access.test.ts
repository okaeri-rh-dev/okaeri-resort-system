/**
 * Regression: the `owner` app_role was missing from functions/lib/rbac.ts, so
 * owners got 403 on booking-unit and payment endpoints that staff and managers
 * could use. Role hierarchy: admin > owner > manager > staff.
 */

import { describe, expect, it, vi } from "vitest";

import {
  isManagerOrAbove,
  isStaffOrAbove,
  MANAGER_OR_ABOVE,
  requireRole,
  STAFF_OR_ABOVE,
} from "../../../functions/lib/rbac";
import { createMockContext, createMockRequest, generateTestJWT, mockEnv } from "./setup";

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

const endpoints = [
  { name: "units/add", load: () => import("../../../functions/api/bookings/[id]/units/add") },
  { name: "units/remove", load: () => import("../../../functions/api/bookings/[id]/units/remove") },
  {
    name: "payments/record",
    load: () => import("../../../functions/api/bookings/[id]/payments/record"),
  },
  {
    name: "payments/refund",
    load: () => import("../../../functions/api/bookings/[id]/payments/refund"),
  },
];

describe("owner role access", () => {
  it.each(endpoints)("owner is not forbidden on $name", async ({ name, load }) => {
    vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
    const { onRequestPost } = await load();
    const request = await requestAs("owner", `/api/bookings/not-a-uuid/${name}`);

    const response = await onRequestPost(
      createMockContext(request, mockEnv, { id: "not-a-uuid" }) as never
    );

    expect(response.status).not.toBe(403);
  });

  it("staff is still forbidden on payments/refund", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = await requestAs("staff", "/api/bookings/not-a-uuid/payments/refund");

    const response = await onRequestPost(
      createMockContext(request, mockEnv, { id: "not-a-uuid" }) as never
    );

    expect(response.status).toBe(403);
  });
});

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
