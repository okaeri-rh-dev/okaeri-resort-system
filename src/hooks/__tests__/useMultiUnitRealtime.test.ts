import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { afterWrite } from "@/lib/after-write";

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
  return { supabase: { channel: () => channel, removeChannel: vi.fn() } };
});

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));

describe("useMultiUnitAvailabilitySubscription", () => {
  it("refreshes after a block event, and listens to nothing else", () => {
    renderHook(() => useMultiUnitAvailabilitySubscription());

    listeners.get("availability_blackouts")?.();

    expect(afterWrite).toHaveBeenCalledWith("availability_blackouts");
    expect([...listeners.keys()]).toEqual(["availability_blackouts"]);
  });
});
