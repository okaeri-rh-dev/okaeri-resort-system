// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getAvailabilityStatus } from "../../../functions/api/public/v1/availability";

describe("getAvailabilityStatus", () => {
  it.each([
    [0, "booked"],
    [1, "limited"],
    [2, "moderate"],
    [3, "full"],
  ] as const)("maps %i free cabins to %s", (count, status) => {
    expect(getAvailabilityStatus(count)).toBe(status);
  });

  it("treats more than 3 free cabins as full, not booked", () => {
    expect(getAvailabilityStatus(4)).toBe("full");
  });
});
