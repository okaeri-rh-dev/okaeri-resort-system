/**
 * Regression: GET /api/public/v1/availability imported Turnstile from
 * "../../../src/lib/turnstile", which resolves to functions/src/lib (does not
 * exist), so any request carrying a Turnstile token failed instead of being
 * verified.
 */

import { addDays, format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/public/v1/availability with a Turnstile token", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies the token and rejects a failed challenge with 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ success: false, "error-codes": ["invalid-input-response"] })
      )
    );
    const { onRequest } = await import("../../../functions/api/public/v1/availability");
    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), 7), "yyyy-MM-dd");
    const request = new Request(
      `https://api.example.com/api/public/v1/availability?start=${start}&end=${end}&cf_turnstile_token=bad-token`
    );

    const response = await onRequest({
      request,
      env: {
        SUPABASE_URL: "http://localhost",
        SUPABASE_ANON_KEY: "anon",
        ENVIRONMENT: "production",
        TURNSTILE_SECRET_KEY: "secret",
      },
    } as never);

    expect(response.status).toBe(403);
  });
});
