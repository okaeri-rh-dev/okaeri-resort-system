import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateUnit } from "@/hooks/useUnits";
import { afterWrite } from "@/lib/after-write";
import { unitKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  db: { units: { update: vi.fn() } },
  handleSupabaseError: (error: { message: string }) => error.message,
  supabase: {},
}));

const pine = { unit_id: "u1", unit_name: "Pine", base_rate: 3000 };
const oak = { unit_id: "u2", unit_name: "Oak", base_rate: 3500 };
const unfiltered = unitKeys.list({});
const cheap = unitKeys.list({ max_rate: 3200 });

describe("useUpdateUnit", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.mocked(afterWrite).mockClear();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(unfiltered, [pine, oak]);
    queryClient.setQueryData(cheap, [pine]);
    queryClient.setQueryData(unitKeys.unfiltered(), [pine, oak]);
    queryClient.setQueryData(unitKeys.detail("u1"), pine);
  });

  it.each([
    { outcome: "succeeds", unitName: "Pine Cabin", error: null },
    { outcome: "fails", unitName: "Pine", error: { message: "boom" } },
  ])("patches every unit list before the save $outcome", async ({ unitName, error }) => {
    let finishSave!: () => void;
    vi.mocked(db.units.update).mockReturnValue(
      new Promise((resolve) => {
        finishSave = () =>
          resolve({ data: error ? null : { ...pine, unit_name: "Pine Cabin" }, error } as never);
      }) as never
    );
    const { result } = renderHook(() => useUpdateUnit(), { wrapper });

    result.current.mutate({ unitId: "u1", updates: { unit_name: "Pine Cabin" } });

    await waitFor(() =>
      expect(queryClient.getQueryData(unfiltered)).toEqual([
        { ...pine, unit_name: "Pine Cabin" },
        oak,
      ])
    );
    expect(queryClient.getQueryData(cheap)).toEqual([{ ...pine, unit_name: "Pine Cabin" }]);
    expect(queryClient.getQueryData(unitKeys.unfiltered())).toEqual([
      { ...pine, unit_name: "Pine Cabin" },
      oak,
    ]);
    expect(queryClient.getQueryData(unitKeys.detail("u1"))).toMatchObject({
      unit_name: "Pine Cabin",
    });

    finishSave();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(queryClient.getQueryData(unfiltered)).toEqual([{ ...pine, unit_name: unitName }, oak]);
    expect(queryClient.getQueryData(cheap)).toEqual([{ ...pine, unit_name: unitName }]);
    expect(queryClient.getQueryData(unitKeys.unfiltered())).toEqual([
      { ...pine, unit_name: unitName },
      oak,
    ]);
    expect(queryClient.getQueryData(unitKeys.detail("u1"))).toMatchObject({ unit_name: unitName });
    expect(afterWrite).toHaveBeenCalledWith("units");
  });
});
