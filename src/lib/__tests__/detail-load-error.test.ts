import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { isNoRowError, throwDetailLoadError } from "@/lib/detail-load-error";
import { queryClient } from "@/lib/query-client";

const noRow = { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" };
const badUuid = { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' };
const network = { code: "", message: "TypeError: Failed to fetch" };

function thrownBy(error: unknown) {
  try {
    throwDetailLoadError(error, "guest");
  } catch (thrown) {
    return thrown;
  }
}

describe("isNoRowError", () => {
  it.each([
    ["no row", noRow, true],
    ["non-UUID id", badUuid, true],
    ["network failure", network, false],
    ["plain Error", new Error("boom"), false],
    ["null", null, false],
  ])("%s → %s", (_label, error, expected) => {
    expect(isNoRowError(error)).toBe(expected);
  });
});

describe("throwDetailLoadError", () => {
  it.each([noRow, badUuid])("throws notFound() for %o", (error) => {
    expect(isNotFound(thrownBy(error))).toBe(true);
  });

  it("throws a friendly Error and logs the raw one for other errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const thrown = thrownBy(network);

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Could not load this guest. Try again.");
    expect(consoleError).toHaveBeenCalledWith("Failed to load guest:", network);
    consoleError.mockRestore();
  });
});

describe("queryClient retry", () => {
  it("does not retry a notFound()", () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, thrownBy(noRow))).toBe(false);
  });
});
