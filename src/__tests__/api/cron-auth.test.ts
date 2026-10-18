import { describe, expect, it } from "vitest";

import { verifyCronAuth } from "../../../functions/lib/cron-auth";

const requestWith = (authorization?: string) =>
  new Request("https://example.com/api/cron/x", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });

describe("verifyCronAuth", () => {
  it("rejects a missing header", () => {
    expect(verifyCronAuth(requestWith(), "secret")).toEqual({
      valid: false,
      error: "Missing Authorization header",
    });
  });

  it("rejects a non-Bearer header", () => {
    expect(verifyCronAuth(requestWith("Basic abc"), "secret").valid).toBe(false);
  });

  it("rejects when the secret is not configured", () => {
    expect(verifyCronAuth(requestWith("Bearer secret"), undefined)).toEqual({
      valid: false,
      error: "Server configuration error",
    });
  });

  it("rejects a wrong token", () => {
    expect(verifyCronAuth(requestWith("Bearer nope"), "secret")).toEqual({
      valid: false,
      error: "Invalid token",
    });
  });

  it("accepts the configured token", () => {
    expect(verifyCronAuth(requestWith("Bearer secret"), "secret")).toEqual({ valid: true });
  });
});
