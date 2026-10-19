import { describe, expect, it } from "vitest";

import { statusBadgeProps, statusTone } from "@/lib/status-tone";

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

describe("statusBadgeProps", () => {
  it("labels and tones the badge with the status", () => {
    expect(statusBadgeProps("Cancelled", "Pending")).toEqual({
      tone: "danger",
      children: "Cancelled",
    });
  });

  it.each([null, undefined, ""])("falls back when the status is %j", (status) => {
    expect(statusBadgeProps(status, "Available")).toEqual({
      tone: "success",
      children: "Available",
    });
  });
});
