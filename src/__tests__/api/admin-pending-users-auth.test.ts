/**
 * Authorization tests for functions/api/admin/pending-users.ts
 *
 * This endpoint lists registered users without a role (exposing emails), so on
 * top of the staff+ middleware baseline it is tightened to owner/admin
 * (frontend roles page = requireAdmin). These tests pin that gate.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestGet } from "../../../functions/api/admin/pending-users";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockListUsers = vi.fn();

// lookupUserRole uses `.select("role")...maybeSingle()` (chainable); pending-users'
// own query uses `.select("user_id")` awaited directly. Distinguish by column.
const mockSelect = vi.fn((cols: string) => {
  if (cols === "user_id") return Promise.resolve({ data: [], error: null });
  return { eq: mockEq };
});
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateClient = vi.fn(() => ({
  auth: { getUser: mockGetUser, admin: { listUsers: mockListUsers } },
  from: mockFrom,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
} as unknown as Parameters<typeof onRequestGet>[0]["env"];

function ctx(authHeader = "Bearer valid-token") {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  const request = new Request("https://app/api/admin/pending-users", { headers });
  return { request, env: ENV } as unknown as Parameters<typeof onRequestGet>[0];
}

function authAs(user: Record<string, unknown> | null, role: string | null) {
  mockGetUser.mockResolvedValueOnce({
    data: { user },
    error: user ? null : { message: "invalid" },
  });
  if (user) mockMaybeSingle.mockResolvedValueOnce({ data: role ? { role } : null, error: null });
}

describe("pending-users authorization (owner/admin only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockListUsers.mockReset();
  });

  it("returns 401 when the token is missing", async () => {
    const res = await onRequestGet(ctx(""));
    expect(res.status).toBe(401);
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("returns 401 when the JWT is invalid", async () => {
    authAs(null, null);
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(401);
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it.each(["user", "staff", "manager"])(
    "returns 403 for '%s' (below owner) and never lists users' PII",
    async (role) => {
      authAs({ id: `u-${role}` }, role === "user" ? null : role);
      const res = await onRequestGet(ctx());
      expect(res.status).toBe(403);
      expect(mockListUsers).not.toHaveBeenCalled();
    }
  );

  it.each(["owner", "admin"])("authorizes '%s' and proceeds to list users", async (role) => {
    authAs({ id: `u-${role}` }, role);
    mockListUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(200);
    expect(mockListUsers).toHaveBeenCalledTimes(1);
  });
});
