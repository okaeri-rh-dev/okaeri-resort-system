import { describe, expect, it } from "vitest";

import { isPaymentReceived } from "../payment";

describe("isPaymentReceived", () => {
  it.each([
    ["Pending", false],
    ["Partial", true],
    ["Completed", true],
    ["Refunded", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isPaymentReceived(status)).toBe(expected);
  });
});
