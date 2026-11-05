/**
 * Tests for functions/api/admin/_middleware.ts
 *
 * Closes the "Phase 1: all authenticated users are admins" hole. The middleware
 * must authorize from public.app_roles (staff-or-above baseline), NEVER from the
 * client-mutable JWT user_metadata.role.
 *
 * Covers:
 * - 401 when the Authorization header is missing/malformed or the JWT is invalid
 * - 403 when the authenticated user has no active role ("user" / pending approval)
 * - 403 even when the JWT carries user_metadata.role = "admin" (the spoof vector)
 * - pass-through (next() invoked) for staff / manager / owner / admin
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/api/admin/_middleware";

// Combined supabase-js mock: the middleware calls auth.getUser (JWT verify) and
// lookupUserRole calls from("app_roles")...maybeSingle (role read).
const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateClient = vi.fn((..._args: unknown[]) => ({
  auth: { getUser: mockGetUser },
  from: mockFrom,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  // No RATE_LIMIT_KV → lookupUserRole skips the cache and reads the DB mock.
} as unknown as Parameters<typeof onRequest>[0]["env"];

function makeContext({
  authHeader = "Bearer valid-token",
  method = "GET",
}: { authHeader?: string; method?: string } = {}) {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  const request = new Request("https://app/api/admin/pending-users", { method, headers });
  const next = vi.fn(async () => new Response("NEXT_OK", { status: 200 }));
  return {
    context: { request, next, env: ENV } as unknown as Parameters<typeof onRequest>[0],
    next,
  };
}

/** Make the JWT verification succeed with the given user object. */
function authAs(user: Record<string, unknown>) {
  mockGetUser.mockResolvedValueOnce({ data: { user }, error: null });
}

/** Make the app_roles lookup return the given active role (or null for none). */
function appRole(role: string | null) {
  mockMaybeSingle.mockResolvedValueOnce({
    data: role ? { role } : null,
    error: null,
  });
}

describe("admin _middleware authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { context, next } = makeContext({ authHeader: "" });
    const res = await onRequest(context);
    expect(res.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is not a Bearer token", async () => {
    const { context, next } = makeContext({ authHeader: "Basic abc123" });
    const res = await onRequest(context);
    expect(res.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the JWT is invalid/expired", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad jwt" } });
    const { context, next } = makeContext();
    const res = await onRequest(context);
    expect(res.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated user with no active role (pending approval)", async () => {
    authAs({ id: "u-pending", email: "pending@x.com" });
    appRole(null); // no app_roles row → lookupUserRole returns "user"
    const { context, next } = makeContext();
    const res = await onRequest(context);
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 even when the JWT claims user_metadata.role = 'admin' (spoof vector)", async () => {
    // The attacker set user_metadata.role via supabase.auth.updateUser, but their
    // app_roles record is absent → real role is "user" → denied.
    authAs({ id: "u-attacker", email: "a@x.com", user_metadata: { role: "admin" } });
    appRole(null);
    const { context, next } = makeContext();
    const res = await onRequest(context);
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
    // app_roles was actually consulted (defeats the metadata claim).
    expect(mockFrom).toHaveBeenCalledWith("app_roles");
  });

  it.each(["staff", "manager", "owner", "admin"])(
    "passes through to next() for an approved '%s'",
    async (role) => {
      authAs({ id: `u-${role}`, email: `${role}@x.com` });
      appRole(role);
      const { context, next } = makeContext();
      const res = await onRequest(context);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("NEXT_OK");
    }
  );
});
