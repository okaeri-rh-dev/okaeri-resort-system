import type { ReactNode } from "react";

import { PostgrestError, type PostgrestSingleResponse } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contactChannelKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";

import {
  useCreateContactChannel,
  useReorderContactChannel,
  useSetContactChannelActive,
  type ContactChannel,
} from "../useContactChannels";

vi.mock("@/lib/supabase", () => ({
  db: {
    contactChannels: {
      create: vi.fn(),
      setActive: vi.fn(),
      reorder: vi.fn(),
    },
  },
  handleSupabaseError: (error: { message: string }) => error.message,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const channel: ContactChannel = {
  id: "channel-1",
  kind: "viber",
  value: "+639171234567",
  label: "Maria",
  is_active: true,
  display_order: 0,
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
};

function rowResponse(row: ContactChannel) {
  return { data: row, error: null } as unknown as PostgrestSingleResponse<never>;
}

function voidResponse() {
  return { data: null, error: null } as unknown as PostgrestSingleResponse<never>;
}

function errorResponse(code: string, message: string) {
  return {
    data: null,
    error: new PostgrestError({ code, message, details: "", hint: "" }),
  } as unknown as PostgrestSingleResponse<never>;
}

function renderWithClient<T>(hook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), invalidateQueries };
}

const newChannel = { kind: "viber", value: "+639171234567", label: "Maria" } as const;

describe("useCreateContactChannel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms the new channel and refreshes every contact channel list", async () => {
    vi.mocked(db.contactChannels.create).mockResolvedValue(rowResponse(channel));
    const { result, invalidateQueries } = renderWithClient(useCreateContactChannel);

    await act(() => result.current.mutateAsync(newChannel));

    expect(toast.success).toHaveBeenCalledWith("Contact channel added", {
      description: "Viber (Maria) is now listed.",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: contactChannelKeys.all });
  });

  it("says how to fix a duplicate when the kind and value are taken", async () => {
    vi.mocked(db.contactChannels.create).mockResolvedValue(
      errorResponse(
        "23505",
        'duplicate key value violates unique constraint "contact_channels_kind_value_key"'
      )
    );
    const { result } = renderWithClient(useCreateContactChannel);

    await act(() => result.current.mutateAsync(newChannel).catch(() => undefined));

    expect(toast.error).toHaveBeenCalledWith("Could not add contact channel", {
      description: "This channel is already listed. Edit or show the existing one.",
    });
  });
});

describe("useSetContactChannelActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms a hidden channel", async () => {
    vi.mocked(db.contactChannels.setActive).mockResolvedValue(
      rowResponse({ ...channel, is_active: false })
    );
    const { result } = renderWithClient(useSetContactChannelActive);

    await act(() => result.current.mutateAsync({ id: channel.id, isActive: false }));

    expect(db.contactChannels.setActive).toHaveBeenCalledWith(channel.id, false);
    expect(toast.success).toHaveBeenCalledWith("Contact channel hidden", {
      description: "Guests no longer see Viber (Maria).",
    });
  });

  it("shows the error when the change is refused", async () => {
    vi.mocked(db.contactChannels.setActive).mockResolvedValue(
      errorResponse("42501", "permission denied for table contact_channels")
    );
    const { result } = renderWithClient(useSetContactChannelActive);

    await act(() =>
      result.current.mutateAsync({ id: channel.id, isActive: true }).catch(() => undefined)
    );

    expect(toast.error).toHaveBeenCalledWith("Could not show contact channel", {
      description: "permission denied for table contact_channels",
    });
  });
});

describe("useReorderContactChannel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves the channel and refreshes every contact channel list", async () => {
    vi.mocked(db.contactChannels.reorder).mockResolvedValue(voidResponse());
    const { result, invalidateQueries } = renderWithClient(useReorderContactChannel);

    await act(() => result.current.mutateAsync({ channel, direction: "down" }));

    expect(db.contactChannels.reorder).toHaveBeenCalledWith(channel.id, "down");
    expect(toast.success).toHaveBeenCalledWith("Contact channel moved", {
      description: "Viber (Maria) moved down.",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: contactChannelKeys.all });
  });

  it("shows the error when the move is refused", async () => {
    vi.mocked(db.contactChannels.reorder).mockResolvedValue(
      errorResponse("42501", "Only managers can reorder contact channels")
    );
    const { result } = renderWithClient(useReorderContactChannel);

    await act(() =>
      result.current.mutateAsync({ channel, direction: "up" }).catch(() => undefined)
    );

    expect(toast.error).toHaveBeenCalledWith("Could not move contact channel", {
      description: "Only managers can reorder contact channels",
    });
  });
});
