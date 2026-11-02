import { describe, expect, it } from "vitest";

import { ilikeAnyFilter } from "../search-filter";

describe("ilikeAnyFilter", () => {
  it("matches plain text against every column", () => {
    expect(ilikeAnyFilter(["guest_name", "email"], "0917")).toBe(
      'guest_name.ilike."%0917%",email.ilike."%0917%"'
    );
  });

  it.each([
    ["comma", "food, drinks", '"%food, drinks%"'],
    ["open bracket", "a(b", '"%a(b%"'],
    ["close bracket", "a)b", '"%a)b%"'],
    ["dot", "j.doe", '"%j.doe%"'],
    ["double quote", 'say "hi"', '"%say \\"hi\\"%"'],
    ["backslash", "a\\b", '"%a\\\\b%"'],
    ["empty string", "", '"%%"'],
  ])("quotes a search with a %s", (_label, searchQuery, expectedValue) => {
    expect(ilikeAnyFilter(["notes"], searchQuery)).toBe(`notes.ilike.${expectedValue}`);
  });
});
