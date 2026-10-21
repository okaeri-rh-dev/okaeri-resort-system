import { describe, expect, it } from "vitest";

import { generateGuestBookingReference, isGuestBookingReference } from "../reference";

describe("guest booking reference", () => {
  it("is made as BK-YYYYMM- plus six characters", () => {
    const reference = generateGuestBookingReference(new Date("2026-10-21T03:00:00Z"));

    expect(reference).toMatch(/^BK-202610-[A-Z0-9]{6}$/);
  });

  it("is always accepted by the check", () => {
    for (let attempt = 0; attempt < 500; attempt++) {
      expect(isGuestBookingReference(generateGuestBookingReference())).toBe(true);
    }
  });

  it.each([
    ["BK-202610-A7B9C2", true],
    ["BK-2025-ABCD12", true],
    ["BK-202610-a7b9c2", false],
    ["BK-202610-A7B9", false],
    ["BKG-2026-10-123", false],
    ["OKR-E2E-DARK", false],
  ])("checks %s → %s", (reference, expected) => {
    expect(isGuestBookingReference(reference)).toBe(expected);
  });
});
