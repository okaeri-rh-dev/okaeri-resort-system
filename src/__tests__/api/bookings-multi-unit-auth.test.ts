/**
 * Regression: POST /api/bookings/multi-unit writes with the service-role key,
 * but only checked that the caller was authenticated. A self-registered
 * account with no app_roles row (role "user") could create bookings.
 */

import { describe, expect, it, vi } from "vitest";

import { createMockContext, createMockRequest, generateTestJWT, mockEnv } from "./setup";

type RoleRequest = Request & { user: { role: string } };

async function postAs(role: string): Promise<Response> {
  vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
  const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
  const request = createMockRequest("https://api.example.com/api/bookings/multi-unit", {
    method: "POST",
    headers: { Authorization: `Bearer ${await generateTestJWT()}` },
    body: JSON.stringify({}),
  }) as RoleRequest;
  request.user.role = role;

  return onRequestPost(createMockContext(request, mockEnv) as never);
}

describe("POST /api/bookings/multi-unit authorization", () => {
  it("forbids a user without a staff role", async () => {
    const response = await postAs("user");

    expect(response.status).toBe(403);
  });

  it.each(["staff", "manager", "owner", "admin"])("lets %s through", async (role) => {
    const response = await postAs(role);

    expect(response.status).not.toBe(403);
  });
});
