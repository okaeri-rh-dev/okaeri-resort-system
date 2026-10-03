import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "../turnstile";

describe("verifyTurnstile with no secret configured", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects in production so a missing secret cannot disable bot protection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await verifyTurnstile("token", "", { environment: "production" })).toBe(false);
  });

  it("rejects when no environment is given", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await verifyTurnstile("token", "")).toBe(false);
  });

  it("still allows development when the dev bypass is disabled", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      await verifyTurnstile("token", "", { environment: "development", skipInDev: false })
    ).toBe(true);
  });
});
