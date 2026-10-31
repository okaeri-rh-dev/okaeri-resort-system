import { describe, expect, it } from "vitest";

import { onRequestPost } from "../../../functions/api/guest-booking/status";
import { mockEnv } from "./setup";

const lookupFromSameClient = (attempt: number) =>
  new Request("https://api.example.com/api/guest-booking/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.7",
      "User-Agent": "Mozilla/5.0",
      // Cloudflare sets a new Ray ID on every request; the connection header can vary too
      "CF-Ray": `8d${attempt}abc-MNL`,
      Connection: attempt % 2 ? "keep-alive" : "close",
    },
    body: JSON.stringify({ booking_reference: "not-a-reference", email: "guest@example.com" }),
  });

describe("POST /api/guest-booking/status rate limit", () => {
  it("returns 429 once one client passes 20 lookups in an hour", async () => {
    const env = { ...mockEnv, ENVIRONMENT: "production" as const };

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 21; attempt++) {
      const response = await onRequestPost({ request: lookupFromSameClient(attempt), env });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 20)).not.toContain(429);
    expect(statuses[20]).toBe(429);
  });
});
