import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateGuest } from "@/hooks/useGuests";
import { afterWrite } from "@/lib/after-write";
import { guestKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  db: { guests: { update: vi.fn() } },
  handleSupabaseError: (error: { message: string }) => error.message,
  supabase: {},
}));

const ana = { guest_id: "g1", guest_name: "Ana", phone_number: "0917" };
const ben = { guest_id: "g2", guest_name: "Ben", phone_number: "0918" };
const byName = guestKeys.list({ searchQuery: "", sortBy: "name", sortOrder: "asc" });
const searchAna = guestKeys.list({ searchQuery: "an", sortBy: "created", sortOrder: "desc" });

describe("useUpdateGuest", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.mocked(afterWrite).mockClear();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(byName, [ana, ben]);
    queryClient.setQueryData(searchAna, [ana]);
  });

  it.each([
    { outcome: "succeeds", guestName: "Ana Cruz", error: null },
    { outcome: "fails", guestName: "Ana", error: { message: "boom" } },
  ])("patches every guest list before the save $outcome", async ({ guestName, error }) => {
    let finishSave!: () => void;
    vi.mocked(db.guests.update).mockReturnValue(
      new Promise((resolve) => {
        finishSave = () =>
          resolve({ data: error ? null : { ...ana, guest_name: "Ana Cruz" }, error } as never);
      }) as never
    );
    const { result } = renderHook(() => useUpdateGuest(), { wrapper });

    result.current.mutate({ guestId: "g1", updates: { guest_name: "Ana Cruz" } });

    await waitFor(() =>
      expect(queryClient.getQueryData(byName)).toEqual([{ ...ana, guest_name: "Ana Cruz" }, ben])
    );
    expect(queryClient.getQueryData(searchAna)).toEqual([{ ...ana, guest_name: "Ana Cruz" }]);

    finishSave();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(queryClient.getQueryData(byName)).toEqual([{ ...ana, guest_name: guestName }, ben]);
    expect(queryClient.getQueryData(searchAna)).toEqual([{ ...ana, guest_name: guestName }]);
    expect(afterWrite).toHaveBeenCalledWith("guests");
  });
});
