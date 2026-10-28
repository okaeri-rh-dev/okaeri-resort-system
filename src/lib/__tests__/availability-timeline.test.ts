import { describe, expect, it } from "vitest";

import { tapFreeNight, timelineCell, type TimelineStay } from "@/lib/availability-timeline";

const CABIN_1 = "unit-1";
const CABIN_2 = "unit-2";

const block = (unitId: string | null, firstNight: string, lastNight: string) => ({
  unit_id: unitId,
  start_date: firstNight,
  end_date: lastNight,
});

// Check-in 14:00 and check-out 12:00, Manila time
const stay = (checkInDay: string, checkOutDay: string, unitId = CABIN_1): TimelineStay => ({
  unit_id: unitId,
  booking_id: `booking-${checkInDay}`,
  check_in: `${checkInDay}T14:00:00+08:00`,
  check_out: `${checkOutDay}T12:00:00+08:00`,
});

describe("timelineCell", () => {
  it("marks a cabin booked from the check-in night up to, not including, the check-out day", () => {
    const stays = [stay("2026-11-02", "2026-11-04")];
    const cell = (night: string) => timelineCell(CABIN_1, night, { blocks: [], stays }).kind;

    expect(cell("2026-11-01")).toBe("free");
    expect(cell("2026-11-02")).toBe("booked");
    expect(cell("2026-11-03")).toBe("booked");
    expect(cell("2026-11-04")).toBe("free");
  });

  it("marks a cabin blocked from the first through the last blocked night", () => {
    const blocks = [block(CABIN_1, "2026-11-02", "2026-11-03")];
    const cell = (night: string) => timelineCell(CABIN_1, night, { blocks, stays: [] }).kind;

    expect(cell("2026-11-01")).toBe("free");
    expect(cell("2026-11-02")).toBe("blocked");
    expect(cell("2026-11-03")).toBe("blocked");
    expect(cell("2026-11-04")).toBe("free");
  });

  it("leaves other cabins free on a cabin block", () => {
    const blocks = [block(CABIN_1, "2026-11-02", "2026-11-02")];

    expect(timelineCell(CABIN_2, "2026-11-02", { blocks, stays: [] }).kind).toBe("free");
  });

  it("shows a resort closure on every cabin and on the Whole resort row", () => {
    const closure = block(null, "2026-11-02", "2026-11-02");
    const cell = (unitId: string | null) =>
      timelineCell(unitId, "2026-11-02", { blocks: [closure], stays: [] });

    expect(cell(CABIN_1)).toEqual({ kind: "blocked", block: closure });
    expect(cell(CABIN_2)).toEqual({ kind: "blocked", block: closure });
    expect(cell(null)).toEqual({ kind: "blocked", block: closure });
  });

  it("keeps cabin blocks and bookings off the Whole resort row", () => {
    const blocks = [block(CABIN_1, "2026-11-02", "2026-11-02")];
    const stays = [stay("2026-11-02", "2026-11-03")];

    expect(timelineCell(null, "2026-11-02", { blocks, stays }).kind).toBe("free");
  });

  it("shows the block over a booking on the same night", () => {
    const cabinBlock = block(CABIN_1, "2026-11-02", "2026-11-02");
    const stays = [stay("2026-11-02", "2026-11-03")];

    expect(timelineCell(CABIN_1, "2026-11-02", { blocks: [cabinBlock], stays })).toEqual({
      kind: "blocked",
      block: cabinBlock,
    });
  });
});

describe("tapFreeNight", () => {
  it("holds the first tapped night", () => {
    expect(tapFreeNight(null, { unitId: CABIN_1, night: "2026-11-05" })).toEqual({
      pending: { unitId: CABIN_1, night: "2026-11-05" },
    });
  });

  it("gives the nights between two taps in one row, in date order", () => {
    const pending = { unitId: CABIN_1, night: "2026-11-05" };

    expect(tapFreeNight(pending, { unitId: CABIN_1, night: "2026-11-02" })).toEqual({
      range: { unitId: CABIN_1, firstNight: "2026-11-02", lastNight: "2026-11-05" },
    });
  });

  it("gives one night when the same night is tapped twice", () => {
    const pending = { unitId: null, night: "2026-11-05" };

    expect(tapFreeNight(pending, { unitId: null, night: "2026-11-05" })).toEqual({
      range: { unitId: null, firstNight: "2026-11-05", lastNight: "2026-11-05" },
    });
  });

  it("starts again from a tap in another row", () => {
    const pending = { unitId: CABIN_1, night: "2026-11-05" };

    expect(tapFreeNight(pending, { unitId: null, night: "2026-11-06" })).toEqual({
      pending: { unitId: null, night: "2026-11-06" },
    });
  });
});
