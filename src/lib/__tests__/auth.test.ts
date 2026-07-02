import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";

describe("auth.isValidRoute — in-scope admin auth routes", () => {
  it("accepts /admin/login", () => {
    expect(auth.isValidRoute("/admin/login")).toBe(true);
  });
  it("accepts /admin/pending-approval", () => {
    expect(auth.isValidRoute("/admin/pending-approval")).toBe(true);
  });
});
