import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { afterWrite } from "@/lib/after-write";
import { supabase } from "@/lib/supabase";

import { useMultiUnitAvailabilitySubscription } from "../useMultiUnitRealtime";

const listeners = vi.hoisted(() => new Map<string, () => void>());

vi.mock("@/lib/supabase", () => {
  const channel = {
    on: (_event: string, filter: { table: string }, handler: () => void) => {
      listeners.set(filter.table, handler);
      return channel;
    },
    subscribe: () => channel,
  };
  return { supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() } };
});

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));

describe("useMultiUnitAvailabilitySubscription", () => {
  beforeEach(() => {
    listeners.clear();
    vi.clearAllMocks();
  });

  it("refreshes after a block event, and listens to nothing else", () => {
    renderHook(() => useMultiUnitAvailabilitySubscription());

    listeners.get("availability_blackouts")?.();

    expect(afterWrite).toHaveBeenCalledWith("availability_blackouts");
    expect([...listeners.keys()]).toEqual(["availability_blackouts"]);
  });

  it("calls the caller's handler on a block event", () => {
    const onChange = vi.fn();
    renderHook(() => useMultiUnitAvailabilitySubscription({ onChange }));

    listeners.get("availability_blackouts")?.();

    expect(afterWrite).toHaveBeenCalledWith("availability_blackouts");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("calls a new handler without re-subscribing", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(
      ({ onChange }) => useMultiUnitAvailabilitySubscription({ onChange, onError: () => {} }),
      { initialProps: { onChange: firstHandler } }
    );

    rerender({ onChange: secondHandler });
    listeners.get("availability_blackouts")?.();

    expect(supabase.channel).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledOnce();
  });
});
