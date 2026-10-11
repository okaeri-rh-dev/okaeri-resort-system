import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "../useDebouncedValue";

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only publishes the latest value once input stops changing for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    rerender({ value: "o" });
    advance(200);
    rerender({ value: "ok" });
    advance(200);

    expect(result.current).toBe("");

    advance(100);

    expect(result.current).toBe("ok");
  });
});
