import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveContactChannels, type ContactChannel } from "@/hooks/useContactChannels";
import { useDocumentStore } from "@/stores/useDocumentStore";

import { DEFAULT_LETTERHEAD } from "../constants";
import { DocumentGenerator } from "../DocumentGenerator";

const { documents, generate, toastError } = vi.hoisted(() => ({
  documents: {
    letterhead: vi.fn(),
    saveLetterhead: vi.fn(),
    allocateNumber: vi.fn(),
  },
  generate: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useContactChannels", () => ({ useActiveContactChannels: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  handleSupabaseError: (error: { message: string }) => error.message,
  db: { documents },
}));
vi.mock("../pdf/useGeneratePDF", () => ({ useGeneratePDF: () => ({ generate }) }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

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

const CHANNEL_CONTACTS = { phone: "+63 917 123 4567", email: "stay@okaeri-resort.example" };

beforeEach(() => {
  vi.clearAllMocks();
  documents.letterhead.mockResolvedValue({ data: null, error: null });
  documents.saveLetterhead.mockResolvedValue({ data: null, error: null });
  vi.mocked(useActiveContactChannels).mockReturnValue({
    data: channels,
    isSuccess: true,
  } as unknown as ReturnType<typeof useActiveContactChannels>);
});

function renderGenerator() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DocumentGenerator />
    </QueryClientProvider>
  );
}

describe("DocumentGenerator shared letterhead", () => {
  it("uses the default letterhead with the first visible mobile and email channels before anyone saves one", async () => {
    renderGenerator();

    expect((await screen.findAllByText("+63 917 123 4567")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("stay@okaeri-resort.example").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amita St., Brgy. Taboc").length).toBeGreaterThan(0);
  });

  it("says the letterhead failed to load and keeps Download off", async () => {
    documents.letterhead.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    useDocumentStore.getState().addLineItem({
      id: "item-1",
      type: "accommodation",
      description: "Cabin stay",
      quantity: 1,
      unit_label: "night",
      unit_price: 5000,
      amount: 5000,
    });
    renderGenerator();

    expect(await screen.findByText("Could not load the letterhead")).toBeInTheDocument();
    for (const download of screen.getAllByRole("button", { name: "Download PDF" })) {
      expect(download).toBeDisabled();
    }
  });

  it("shows the saved letterhead", async () => {
    documents.letterhead.mockResolvedValue({
      data: { ...DEFAULT_LETTERHEAD, phone: "+63 917 555 0101", email: "" },
      error: null,
    });
    renderGenerator();

    expect((await screen.findAllByText("+63 917 555 0101")).length).toBeGreaterThan(0);
    expect(screen.queryByText("+63 917 123 4567")).not.toBeInTheDocument();
  });

  it("saves an edit to the shared letterhead", async () => {
    const user = userEvent.setup();
    renderGenerator();

    await user.click(await screen.findByRole("button", { name: /Letterhead/i }));
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Phone"));
    await user.type(dialog.getByLabelText("Phone"), "+63 917 555 0101");
    await user.click(dialog.getByRole("button", { name: "Save Settings" }));

    expect(documents.saveLetterhead).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+63 917 555 0101", logo_base64: "", tin: "" })
    );
  });

  it("asks before it resets the shared letterhead to the defaults", async () => {
    const user = userEvent.setup();
    documents.letterhead.mockResolvedValue({
      data: { ...DEFAULT_LETTERHEAD, phone: "+63 917 555 0101" },
      error: null,
    });
    renderGenerator();

    await user.click(await screen.findByRole("button", { name: /Letterhead/i }));
    await user.click(await screen.findByRole("button", { name: "Reset to Defaults" }));

    const confirm = within(await screen.findByRole("alertdialog"));
    expect(confirm.getByText(/every device/)).toBeInTheDocument();
    expect(documents.saveLetterhead).not.toHaveBeenCalled();

    await user.click(confirm.getByRole("button", { name: "Reset letterhead" }));

    expect(documents.saveLetterhead).toHaveBeenCalledWith(
      expect.objectContaining({ ...DEFAULT_LETTERHEAD, ...CHANNEL_CONTACTS })
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByLabelText("Phone")).toHaveValue(CHANNEL_CONTACTS.phone);
  });
});

describe("DocumentGenerator download", () => {
  beforeEach(() => {
    useDocumentStore.getState().resetForm();
    useDocumentStore.getState().addLineItem({
      id: "item-1",
      type: "accommodation",
      description: "Cabin stay",
      quantity: 1,
      unit_label: "night",
      unit_price: 5000,
      amount: 5000,
    });
  });

  async function clickDownload() {
    const user = userEvent.setup();
    renderGenerator();
    const [download] = screen.getAllByRole("button", { name: "Download PDF" });
    await waitFor(() => expect(download).toBeEnabled());
    await user.click(download);
  }

  it("puts the shared document number on the PDF", async () => {
    documents.allocateNumber.mockResolvedValue({ data: "QUO-2026-0001", error: null });

    await clickDownload();

    expect(documents.allocateNumber).toHaveBeenCalledWith("quotation");
    await waitFor(() =>
      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ document_number: "QUO-2026-0001" }),
        })
      )
    );
  });

  it("makes no PDF and shows an error when it cannot take a number", async () => {
    documents.allocateNumber.mockResolvedValue({
      data: null,
      error: { message: "TypeError: Failed to fetch" },
    });

    await clickDownload();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not get a document number", {
        description: "TypeError: Failed to fetch",
      })
    );
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("DocumentGenerator tablet tabs", () => {
  beforeEach(() => {
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

  it("starts beside the collapsed rail on medium windows", () => {
    renderGenerator();

    const bar = screen.getByRole("button", { name: "Preview" }).parentElement;
    expect(bar).toHaveClass("medium:left-20");
  });
});
