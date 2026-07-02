import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";

describe("auth.isValidRoute — in-scope admin auth routes", () => {
  it("accepts /admin/login", () => {
    expect(auth.isValidRoute("/admin/login")).toBe(true);
  });
  it("accepts /admin/pending-approval", () => {
    expect(auth.isValidRoute("/admin/pending-approval")).toBe(true);
  });
});

describe("auth redirect targets point in-scope", () => {
  let replaceSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    replaceSpy = vi.fn();
    // Use stubGlobal so unstubAllGlobals fully restores window.location —
    // vi.restoreAllMocks() does NOT undo an Object.defineProperty redefine.
    vi.stubGlobal("location", {
      ...window.location,
      replace: replaceSpy,
      origin: "https://example.com",
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("sends an invalid redirect to /admin/login (not /login)", () => {
    auth.handleRedirect("/definitely-not-a-valid-route");
    expect(replaceSpy).toHaveBeenCalledWith("/admin/login");
  });
});
