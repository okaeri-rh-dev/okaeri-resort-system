/**
 * Regression: parseRpcError in POST /api/admin/assign-units read an undefined
 * `errorHint`, so any RPC error that did not match the first message checks
 * threw a ReferenceError instead of mapping to its intended status.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const bookingId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";

let rpcError: { message: string; code?: string; hint?: string } | null = null;

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "staff-1" } }, error: null }) },
  rpc: async () => ({ data: null, error: rpcError }),
};

async function assignUnits(): Promise<Response> {
  const { onRequest } = await import("../../../functions/api/admin/assign-units");
  const request = new Request("https://api.example.com/api/admin/assign-units", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId, unit_ids: [unitId] }),
  });

  return onRequest({
    request: request as never,
    env: { SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "key" },
  } as never);
}

describe("POST /api/admin/assign-units RPC error mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => fakeSupabase) }));
    vi.doMock("../../../functions/lib/audit-logger-workers", () => ({
      logAuditEventWorker: vi.fn(async () => undefined),
    }));
  });

  it("maps a unique violation to 409 duplicate assignment", async () => {
    rpcError = { message: "duplicate key value violates unique constraint", code: "23505" };

    const response = await assignUnits();

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Duplicate assignment");
  });

  it("maps an exclusion-constraint hint to 409 booking conflict", async () => {
    rpcError = { message: "constraint failed", hint: "exclusion constraint on booking_units" };

    const response = await assignUnits();

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Booking conflict");
  });

  it("maps a wrong cabin count to 400", async () => {
    rpcError = { message: "Must assign exactly 2 cabins, got 1", code: "P0001" };

    const response = await assignUnits();

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; details: string };
    expect(body.error).toBe("Wrong number of cabins");
    expect(body.details).toBe("Must assign exactly 2 cabins, got 1");
  });
});
