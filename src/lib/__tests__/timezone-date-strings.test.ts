/**
 * Before 08:00 Manila the UTC calendar day is still yesterday, so the
 * Manila and UTC helpers must disagree there and agree after.
 */

import { describe, expect, it } from "vitest";

import { toManilaDateString, toUTCDateString } from "../timezone";

describe("date-string helpers", () => {
  it("gives the Manila day before 08:00 Manila, where UTC is still on the previous day", () => {
    const earlyMorningManila = new Date("2026-10-07T20:30:00Z"); // 04:30 on Oct 8 in Manila

    expect(toManilaDateString(earlyMorningManila)).toBe("2026-10-08");
    expect(toUTCDateString(earlyMorningManila)).toBe("2026-10-07");
  });

  it("agrees with UTC once Manila is past 08:00", () => {
    const afternoonManila = new Date("2026-10-08T06:00:00Z"); // 14:00 on Oct 8 in Manila

    expect(toManilaDateString(afternoonManila)).toBe("2026-10-08");
    expect(toUTCDateString(afternoonManila)).toBe("2026-10-08");
  });
});
