import { describe, expect, it } from "vitest";

import { statusTone } from "@/lib/status-tone";

describe("statusTone", () => {
  it.each([
    ["Confirmed", "success"],
    ["CheckedIn", "success"],
    ["Paid", "success"],
    ["Completed", "success"],
    ["Available", "success"],
    ["Pending", "warning"],
    ["Partial", "warning"],
    ["Reserved", "warning"],
    ["Cancelled", "danger"],
    ["Refunded", "danger"],
    ["Maintenance", "danger"],
    ["CheckedOut", "neutral"],
    ["Occupied", "neutral"],
    ["Hold", "neutral"],
  ])("maps %s to %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});
