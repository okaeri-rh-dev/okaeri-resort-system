/**
 * Regression: the root middleware attached the authenticated user to the
 * Request, but the Pages runtime hands the next handler a fresh
 * `new Request(request.clone())`, so routes never saw it and every valid staff
 * token got 401. The user must travel on `context.data`, which is shared.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/_middleware";
import { createMockContext, createMockRequest, generateTestJWT, mockEnv } from "./setup";

vi.mock("../../../functions/lib/role-lookup", () => ({
  lookupUserRole: vi.fn(async () => "staff"),
}));

async function postThroughMiddleware(token?: string): Promise<Response> {
  vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
  const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
  const request = createMockRequest("https://api.example.com/api/bookings/multi-unit", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({}),
  });
  const context = createMockContext(request, mockEnv);
  context.data = {};

  // Same hand-off as node_modules/wrangler/templates/pages-template-worker.ts
  context.next = async () =>
    onRequestPost({
      ...context,
      request: new Request(request.clone() as never),
    } as never);

  return onRequest(context as never);
}

describe("authentication hand-off from root middleware to a route", () => {
  beforeEach(() => {
    mockEnv.SUPABASE_JWT_SECRET = "test-jwt-secret-key-for-hmac-256-signing";
  });

  it("lets a valid staff token reach the route authenticated", async () => {
    const response = await postThroughMiddleware(await generateTestJWT());

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("rejects a request without a token", async () => {
    const response = await postThroughMiddleware();

    expect(response.status).toBe(401);
  });
});
