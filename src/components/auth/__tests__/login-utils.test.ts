import { describe, expect, it } from "vitest";

import { resolveSafeRedirect } from "@/components/auth/login-utils";

const ORIGIN = "https://example.com";

describe("resolveSafeRedirect", () => {
  it("resolves a same-origin relative redirect to its absolute href", () => {
    expect(resolveSafeRedirect("/admin/dashboard", ORIGIN)).toBe(
      "https://example.com/admin/dashboard"
    );
  });

  it("returns the href for a same-origin absolute redirect", () => {
    expect(resolveSafeRedirect("https://example.com/admin/bookings", ORIGIN)).toBe(
      "https://example.com/admin/bookings"
    );
  });

  it("returns null for an external origin (open-redirect attempt)", () => {
    expect(resolveSafeRedirect("https://evil.com/x", ORIGIN)).toBeNull();
  });

  it("returns null for a non-http scheme that is not same-origin", () => {
    // javascript: parses (origin "null"), so the same-origin guard must reject it.
    expect(resolveSafeRedirect("javascript:alert(1)", ORIGIN)).toBeNull();
  });

  it("returns null when no redirect is provided", () => {
    expect(resolveSafeRedirect(undefined, ORIGIN)).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(resolveSafeRedirect("http://[bad", ORIGIN)).toBeNull();
  });
});
