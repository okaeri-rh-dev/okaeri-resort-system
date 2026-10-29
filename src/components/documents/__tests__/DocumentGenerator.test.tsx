import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveContactChannels, type ContactChannel } from "@/hooks/useContactChannels";
import { useDocumentStore } from "@/stores/useDocumentStore";

import { DocumentGenerator } from "../DocumentGenerator";

vi.mock("@/hooks/useContactChannels", () => ({ useActiveContactChannels: vi.fn() }));

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

const channels = [
  channel({ id: "viber", kind: "viber", value: "+639170000001" }),
  channel({ id: "mobile-1", kind: "mobile", value: "+639171234567", display_order: 1 }),
  channel({ id: "mobile-2", kind: "mobile", value: "+639179998888", display_order: 2 }),
  channel({ id: "email", kind: "email", value: "stay@okaeri-resort.example", display_order: 3 }),
];

beforeEach(() => {
  vi.mocked(useActiveContactChannels).mockReturnValue({
    data: channels,
    isSuccess: true,
  } as unknown as ReturnType<typeof useActiveContactChannels>);
});

function renderGenerator() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentGenerator />
    </QueryClientProvider>
  );
}

describe("DocumentGenerator letterhead contact defaults", () => {
  beforeEach(() => {
    localStorage.removeItem("document-storage");
    useDocumentStore.getState().resetLetterhead({ phone: "", email: "" });
    useDocumentStore.setState({ contactDefaultsApplied: false });
  });

  it("uses the first visible mobile and email channels on a new device", async () => {
    renderGenerator();

    expect((await screen.findAllByText("+63 917 123 4567")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("stay@okaeri-resort.example").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amita St., Brgy. Taboc").length).toBeGreaterThan(0);
    expect(useDocumentStore.getState().letterhead.website).toBe("");
  });

  it("resets the letterhead phone and email to the channel defaults", async () => {
    const user = userEvent.setup();
    useDocumentStore.setState({ contactDefaultsApplied: true });
    useDocumentStore.getState().updateLetterhead({ phone: "+63 917 555 0101" });
    renderGenerator();

    await user.click(screen.getByRole("button", { name: /Letterhead/i }));
    await user.click(await screen.findByRole("button", { name: "Reset to Defaults" }));

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Phone")).toHaveValue("+63 917 123 4567");
    expect(dialog.getByLabelText("Email")).toHaveValue("stay@okaeri-resort.example");
  });
});

describe("DocumentGenerator tablet tabs", () => {
  beforeEach(() => {
    localStorage.removeItem("document-storage");
    useDocumentStore.getState().resetForm();
  });

  it("shows an edit in the preview when switching to Preview right after typing", async () => {
    const user = userEvent.setup();
    renderGenerator();

    const editPanel = within(screen.getByRole("tabpanel", { name: "Edit" }));
    await user.type(editPanel.getByLabelText(/Name/), "Maria Santos");
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    const previewPanel = within(screen.getByRole("tabpanel", { name: "Preview" }));
    expect(previewPanel.getByText("Maria Santos")).toBeInTheDocument();
  });
});

describe("DocumentGenerator mobile action bar", () => {
  // jsdom has no layout, so this pins the bar to the shell's published bottom bar height
  it("sits above the admin bottom bar on compact windows", () => {
    renderGenerator();

    const bar = screen.getByRole("button", { name: "Preview" }).parentElement;
    expect(bar).toHaveClass("bottom-(--admin-bottom-bar-height)", "medium:bottom-0");
  });
});
