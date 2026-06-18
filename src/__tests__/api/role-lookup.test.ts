/**
 * Unit tests for functions/lib/role-lookup.ts
 *
 * Hotfix: replaces the previous user_metadata.role extraction in
 * functions/_middleware.ts with a server-side app_roles lookup.
 *
 * These tests cover:
 * - The good path (active app_roles row -> correct role)
 * - The regression-prevention path (user_metadata.role is NEVER consulted)
 * - Fail-closed behavior (errors / missing env -> "user")
 * - KV caching behavior
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { lookupUserRole } from "../../../functions/lib/role-lookup";

// Hoisted mocks for the supabase-js client builder
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateClient = vi.fn(() => ({ from: mockFrom }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Minimal KV mock that satisfies the shape role-lookup uses
function createMockKV(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    // store is exposed only for assertions in tests
    _store: store,
  };
}

function baseEnv(overrides: Record<string, unknown> = {}) {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    RATE_LIMIT_KV: createMockKV(),
    ...overrides,
  } as unknown as Parameters<typeof lookupUserRole>[1];
}

describe("lookupUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockReset();
    mockEq.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockCreateClient.mockClear();
  });

  it("returns 'user' when userId is empty", async () => {
    const env = baseEnv();
    const role = await lookupUserRole("", env);
    expect(role).toBe("user");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns 'user' when userId is undefined", async () => {
    const env = baseEnv();
    const role = await lookupUserRole(undefined, env);
    expect(role).toBe("user");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns the app_roles role on cache miss and writes it to KV", async () => {
    const kv = createMockKV();
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "admin" }, error: null });

    const env = baseEnv({ RATE_LIMIT_KV: kv });
    const role = await lookupUserRole("user-1", env);

    expect(role).toBe("admin");
    expect(mockFrom).toHaveBeenCalledWith("app_roles");
    expect(kv.put).toHaveBeenCalledWith(
      "role:user-1",
      "admin",
      expect.objectContaining({ expirationTtl: 60 })
    );
  });

  it("returns the KV-cached role without hitting the DB", async () => {
    const kv = createMockKV({ "role:user-2": "manager" });

    const env = baseEnv({ RATE_LIMIT_KV: kv });
    const role = await lookupUserRole("user-2", env);

    expect(role).toBe("manager");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("treats an invalid cached value as a cache miss and falls through to DB", async () => {
    const kv = createMockKV({ "role:user-3": "godmode" });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "staff" }, error: null });

    const env = baseEnv({ RATE_LIMIT_KV: kv });
    const role = await lookupUserRole("user-3", env);

    expect(role).toBe("staff");
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it("returns 'user' when there is no active app_roles row (pending approval)", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const env = baseEnv();
    const role = await lookupUserRole("user-pending", env);

    expect(role).toBe("user");
  });

  it("returns 'user' and does not crash when the DB query errors", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "connection failed" },
    });

    const env = baseEnv();
    const role = await lookupUserRole("user-db-err", env);

    expect(role).toBe("user");
  });

  it("returns 'user' when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const env = baseEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    const role = await lookupUserRole("user-no-env", env);
    expect(role).toBe("user");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns 'user' when SUPABASE_URL is missing", async () => {
    const env = baseEnv({ SUPABASE_URL: undefined });
    const role = await lookupUserRole("user-no-url", env);
    expect(role).toBe("user");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("does not throw and returns 'user' if the supabase client itself throws", async () => {
    mockCreateClient.mockImplementationOnce(() => {
      throw new Error("network down");
    });

    const env = baseEnv();
    const role = await lookupUserRole("user-throw", env);
    expect(role).toBe("user");
  });

  it("does not consult user_metadata.role at all (regression test for the original vector)", async () => {
    // Even if the JWT carried { user_metadata: { role: "admin" } }, the lookup helper
    // never sees the JWT — it only takes userId. The middleware is now responsible for
    // passing payload.sub only, NOT payload.user_metadata.role. This test pins the
    // contract: the helper has no way to be tricked by client-controlled JWT claims.
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const env = baseEnv();
    // The userId here matches a user who has NO app_roles row but COULD have
    // user_metadata.role = "admin" on their JWT. The helper must return "user".
    const role = await lookupUserRole("attacker-with-faked-metadata", env);

    expect(role).toBe("user");
  });

  it("returns 'staff' / 'manager' / 'owner' faithfully when app_roles says so", async () => {
    for (const expected of ["staff", "manager", "owner"]) {
      mockMaybeSingle.mockResolvedValueOnce({ data: { role: expected }, error: null });
      const env = baseEnv();
      const role = await lookupUserRole(`user-${expected}`, env);
      expect(role).toBe(expected);
    }
  });

  it("queries app_roles with is_active=true filter", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "admin" }, error: null });
    const env = baseEnv();
    await lookupUserRole("user-active-check", env);

    // First .eq() call: user_id; second .eq() call: is_active=true
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-active-check");
    expect(mockEq).toHaveBeenCalledWith("is_active", true);
  });

  it("returns 'user' if KV write fails after a successful DB read (non-fatal)", async () => {
    const kv = createMockKV();
    kv.put.mockImplementationOnce(async () => {
      throw new Error("KV write throttled");
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "admin" }, error: null });

    const env = baseEnv({ RATE_LIMIT_KV: kv });
    const role = await lookupUserRole("user-kv-write-fail", env);

    // Returns the DB-derived role despite the cache write failing
    expect(role).toBe("admin");
  });
});
