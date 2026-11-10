import { describe, expect, it } from "vitest";

import { toQuotedCSV } from "../csv";

describe("toQuotedCSV", () => {
  it("leaves headers bare and quotes every cell, doubling inner quotes", () => {
    expect(toQuotedCSV(["Name", "Amount"], [['Say "hi", ok', 12.5]])).toBe(
      'Name,Amount\n"Say ""hi"", ok","12.5"'
    );
  });
});
