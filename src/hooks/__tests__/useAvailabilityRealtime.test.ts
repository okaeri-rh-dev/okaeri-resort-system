import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAvailabilityRealtime } from "../useAvailabilityRealtime";

const listeners = vi.hoisted(() => new Map<string, () => void>());
const store = vi.hoisted(() => ({
  selectedUnits: [] as { unit_id: string }[],
  clearAvailabilityCache: vi.fn(),
}));

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
vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));
vi.mock("@/stores/useMultiUnitBookingStore", () => ({
  useMultiUnitBookingStore: () => store,
}));

describe("useAvailabilityRealtime", () => {
  beforeEach(() => {
    listeners.clear();
    vi.clearAllMocks();
  });

  it("clears the availability cache and warns when units are selected", () => {
    store.selectedUnits = [{ unit_id: "unit-1" }];
    renderHook(() => useAvailabilityRealtime("2026-12-01", "2026-12-03"));

    listeners.get("availability_blackouts")?.();

    expect(store.clearAvailabilityCache).toHaveBeenCalledOnce();
    expect(toast.warning).toHaveBeenCalledWith("Availability updated", expect.anything());
  });

  it("clears the cache without a toast when no units are selected", () => {
    store.selectedUnits = [];
    renderHook(() => useAvailabilityRealtime("2026-12-01", "2026-12-03"));

    listeners.get("availability_blackouts")?.();

    expect(store.clearAvailabilityCache).toHaveBeenCalledOnce();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
