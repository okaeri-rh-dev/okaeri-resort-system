import { describe, expect, it } from "vitest";

import { statusBadgeProps, statusTone } from "@/lib/status-tone";

describe("statusTone", () => {
  it.each([
    ["Confirmed", "success"],
    ["CheckedIn", "success"],
    ["Paid", "success"],
    ["Completed", "success"],
    ["Free", "success"],
    ["Pending", "warning"],
    ["Partial", "warning"],
    ["Cancelled", "danger"],
    ["Refunded", "danger"],
    ["Blocked", "danger"],
    ["CheckedOut", "neutral"],
    ["Booked", "neutral"],
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

  it.each([
    ["CheckedIn", "Checked In"],
    ["CheckedOut", "Checked Out"],
  ])("labels %s as %s", (status, label) => {
    expect(statusBadgeProps(status, "Pending").children).toBe(label);
  });

  it.each([null, undefined, ""])("falls back when the status is %j", (status) => {
    expect(statusBadgeProps(status, "Free")).toEqual({
      tone: "success",
      children: "Free",
    });
  });
});
