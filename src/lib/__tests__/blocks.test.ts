import { describe, expect, it } from "vitest";

import { blockFormMode, blockPhase, describeBlockNights } from "@/lib/blocks";

describe("describeBlockNights", () => {
  it("states the range, the night count, the last check-out and the next check-in", () => {
    expect(describeBlockNights("2026-10-29", "2026-11-06")).toBe(
      "Thu 29 Oct – Fri 6 Nov · 9 nights. Guests can still check out on Thu 29 Oct. The next check-in is Sat 7 Nov."
    );
  });

  it("names a one-night block once, in the singular", () => {
    expect(describeBlockNights("2026-12-31", "2026-12-31")).toBe(
      "Thu 31 Dec · 1 night. Guests can still check out on Thu 31 Dec. The next check-in is Fri 1 Jan."
    );
  });
});

describe("blockPhase", () => {
  const today = "2026-10-27";

  it("is upcoming when the first night is after today", () => {
    expect(blockPhase({ start_date: "2026-10-28", end_date: "2026-10-30" }, today)).toBe(
      "upcoming"
    );
  });

  it("is running from the first night through the last night", () => {
    expect(blockPhase({ start_date: "2026-10-27", end_date: "2026-10-30" }, today)).toBe("running");
    expect(blockPhase({ start_date: "2026-10-20", end_date: "2026-10-27" }, today)).toBe("running");
  });

  it("is over once the last night is before today", () => {
    expect(blockPhase({ start_date: "2026-10-20", end_date: "2026-10-26" }, today)).toBe("over");
  });
});

describe("blockFormMode", () => {
  const today = "2026-10-27";
  const upcoming = { start_date: "2026-11-01", end_date: "2026-11-03" };
  const running = { start_date: "2026-10-26", end_date: "2026-10-29" };
  const over = { start_date: "2026-10-20", end_date: "2026-10-22" };

  it("lets a manager create a block, or change an upcoming one in full", () => {
    expect(blockFormMode(undefined, today, true)).toBe("create");
    expect(blockFormMode(upcoming, today, true)).toBe("edit");
  });

  it("allows only the last night on a running block", () => {
    expect(blockFormMode(running, today, true)).toBe("last-night-only");
  });

  it("opens a past block read-only, even for a manager", () => {
    expect(blockFormMode(over, today, true)).toBe("read-only");
  });

  it("opens every block read-only for staff", () => {
    expect(blockFormMode(upcoming, today, false)).toBe("read-only");
    expect(blockFormMode(running, today, false)).toBe("read-only");
  });
});
