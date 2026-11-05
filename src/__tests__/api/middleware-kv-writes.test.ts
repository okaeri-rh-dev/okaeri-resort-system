import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/_middleware";
import { createMockContext, mockEnv } from "./setup";

const requestFromInternet = (path: string) =>
  new Request(`https://api.example.com${path}`, {
    headers: { "CF-Connecting-IP": "203.0.113.7", "User-Agent": "Mozilla/5.0" },
  });

describe("Middleware KV usage", () => {
  it.each([
    ["an answered request", 200],
    ["a 404", 404],
  ])("writes nothing to KV for %s", async (_label, status) => {
    const context = {
      ...createMockContext(requestFromInternet("/api/health"), mockEnv),
      next: vi.fn(async () => new Response("{}", { status })),
    };

    await onRequest(context as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockEnv.RATE_LIMIT_KV.put).not.toHaveBeenCalled();
  });
});
