import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useContactChannels,
  useReorderContactChannel,
  type ContactChannel,
} from "@/hooks/useContactChannels";

import { ContactChannelsTable } from "../ContactChannelsTable";

vi.mock("@/hooks/useContactChannels", () => ({
  useContactChannels: vi.fn(),
  useSetContactChannelActive: () => ({ mutate: vi.fn() }),
  useReorderContactChannel: vi.fn(),
}));

function channel(overrides: Partial<ContactChannel>): ContactChannel {
  return {
    id: "channel",
    kind: "viber",
    value: "+639171234567",
    label: null,
    is_active: true,
    display_order: 0,
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    ...overrides,
  };
}

const viber = channel({ id: "viber", kind: "viber", display_order: 0 });
const email = channel({
  id: "email",
  kind: "email",
  value: "reservations@okaeri-resort.example",
  display_order: 1,
});
const whatsapp = channel({ id: "whatsapp", kind: "whatsapp", display_order: 2 });

const reorder = vi.fn();

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

describe("ContactChannelsTable ordering", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    reorder.mockReset();
    vi.mocked(useContactChannels).mockReturnValue({
      data: [viber, email, whatsapp],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useContactChannels>);
    vi.mocked(useReorderContactChannel).mockReturnValue({
      mutate: reorder,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderContactChannel>);
  });

  it("offers no up move on the first channel and no down move on the last", () => {
    render(<ContactChannelsTable onEditChannel={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Move Viber up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Viber down" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Email up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Email down" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move WhatsApp up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move WhatsApp down" })).not.toBeInTheDocument();
  });

  it("moves a channel in the chosen direction", async () => {
    render(<ContactChannelsTable onEditChannel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Move Email up" }));

    expect(reorder).toHaveBeenCalledWith({ channel: email, direction: "up" });
  });
});
