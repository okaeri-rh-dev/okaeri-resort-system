/**
 * @vitest-environment jsdom
 */

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditableSection } from "@/lib/bookings";
import type { Booking } from "@/types";

import { BookingDetailPage } from "..";

const user = vi.hoisted(() => ({ role: "manager" as string, userId: "user-1" }));
const history = vi.hoisted(() => ({ state: {} as { fromBookingsList?: boolean }, back: vi.fn() }));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => vi.fn(),
  useLocation: ({ select }: { select: (location: { state: object }) => unknown }) =>
    select({ state: history.state }),
  useRouter: () => ({ history: { back: history.back } }),
}));

vi.mock("@/hooks", () => ({
  useUserRole: () => ({
    ...user,
    isManager: user.role !== "staff",
    canEdit: user.role !== "staff",
    canSoftDelete: user.role !== "staff",
  }),
}));

const updateBooking = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const updateStay = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock("@/hooks/useBookings", () => ({
  useUpdateBooking: () => updateBooking,
  useUpdateBookingStay: () => updateStay,
  useUpdateBookingStatus: () => ({ mutate: vi.fn() }),
  useCancelBooking: () => ({ mutate: vi.fn() }),
  useUploadPaymentProof: () => ({ mutate: vi.fn() }),
}));

const softDeletePayment = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/hooks/usePayments", () => ({ useSoftDeletePayment: () => softDeletePayment }));

vi.mock("@/hooks/usePaymentProofUrl", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePaymentProofUrl: () => ({ data: "https://storage.test/proof.jpg", isError: false }),
}));

const auditRow = (overrides: object) => ({
  audit_id: "audit",
  source: "db",
  description: null,
  changed_fields: null,
  metadata: null,
  user_id: "user-1",
  user_email: "manager@example.com",
  old_data: null,
  new_data: null,
  ...overrides,
});
const historyRows = vi.hoisted(() => ({ value: [] as object[] }));
const fetchHistory = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>();
  const rowsOf = (table: string) => {
    fetchHistory();
    return Promise.resolve(
      historyRows.value.filter((row) => (row as { table_name: string }).table_name === table)
    );
  };
  return {
    ...actual,
    db: {
      ...actual.db,
      auditLogs: {
        ...actual.db.auditLogs,
        recentByRecord: () => rowsOf("bookings"),
        recentForBookingCabins: () => rowsOf("booking_units"),
      },
    },
  };
});
const units = [
  { unit_id: "unit-1", unit_name: "Cabin 1", max_occupancy: 6 },
  { unit_id: "unit-2", unit_name: "Cabin 2", max_occupancy: 4 },
  { unit_id: "unit-3", unit_name: "Cabin 3", max_occupancy: 4 },
  { unit_id: "unit-4", unit_name: "Cabin 4", max_occupancy: 4 },
];
vi.mock("@/hooks/usePricingConfig", () => ({
  usePricingConfig: () => ({
    data: { base_rate: 1000, weekend_rate: 1000, extra_person_rate: 0, base_occupancy: 4 },
  }),
}));
const availability = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useMultiUnitBookingQueries", () => ({
  useMultiUnitAvailability: availability,
}));
vi.mock("@/hooks/useUnits", () => ({
  useUnits: () => ({ data: units }),
  allUnitsQuery: () => ({
    queryKey: ["units"],
    queryFn: () => [
      { unit_id: "unit-1", unit_name: "Cabin 1" },
      { unit_id: "unit-3", unit_name: "Cabin 3" },
    ],
  }),
}));

const booking = {
  booking_id: "booking-1",
  booking_reference: "OKR-1",
  guest_id: "guest-1",
  guest_name: "Maria Santos",
  email: "maria@example.com",
  contact_number: "09171234567",
  num_guests: 6,
  booking_status: "Pending",
  booking_source: "Walk-in",
  payment_status: "Partial",
  check_in: "2026-11-13T06:00:00Z",
  check_out: "2026-11-16T04:00:00Z",
  total_amount: 9000,
  special_requests: "Late arrival",
  internal_notes: null,
  payments: [
    {
      payment_id: "pay-2",
      amount: 1000,
      status: "Deleted",
      kind: "manual",
      payment_method: "Cash",
      payment_date: "2026-11-12T02:00:00Z",
      proof_url: null,
      notes: null,
    },
    {
      payment_id: "pay-1",
      amount: 3000,
      status: "Active",
      kind: "online_downpayment",
      payment_method: "GCash",
      payment_date: "2026-11-10T02:00:00Z",
      proof_url: "bookings/booking-1/proof.jpg",
      notes: "Ref 12345",
    },
  ],
  booking_units: [
    {
      booking_unit_id: "bu-1",
      unit_id: "unit-1",
      assigned_guests: 4,
      unit: { unit_code: "C1", unit_name: "Cabin 1" },
    },
    {
      booking_unit_id: "bu-2",
      unit_id: "unit-2",
      assigned_guests: 2,
      unit: { unit_code: "C2", unit_name: "Cabin 2" },
    },
  ],
} as unknown as Booking;

// The route keeps the open edit sheet in ?edit=
function PageWithSearch({
  overrides,
  edit,
}: {
  overrides: Partial<Booking>;
  edit?: EditableSection;
}) {
  const [editing, setEditing] = useState(edit);
  return (
    <BookingDetailPage
      booking={{ ...booking, ...overrides }}
      bookingId="booking-1"
      editing={editing}
      onEditingChange={setEditing}
    />
  );
}

const renderPage = (overrides: Partial<Booking> = {}, edit?: EditableSection) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PageWithSearch overrides={overrides} edit={edit} />
    </QueryClientProvider>
  );

const card = (title: string) => within(screen.getByRole("region", { name: title }));

describe("BookingDetailPage", () => {
  beforeAll(() => {
    // The payment row menu measures itself; setup.ts's stub returns no methods after a mock reset
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    user.role = "manager";
    history.back.mockClear();
    softDeletePayment.mutate.mockClear();
    updateBooking.mutateAsync.mockReset();
    updateStay.mutateAsync.mockReset();
    availability.mockReset();
    availability.mockReturnValue({
      data: units.map((unit) => ({
        unit_id: unit.unit_id,
        is_available: unit.unit_id !== "unit-3",
        reason: unit.unit_id === "unit-3" ? "Booked" : null,
        next_available_date: null,
      })),
      isFetching: false,
    });
    fetchHistory.mockReset();
    historyRows.value = [
      auditRow({
        audit_id: "a-1",
        table_name: "bookings",
        action: "UPDATE",
        changed_fields: ["check_out", "num_guests"],
        created_at: "2026-11-10T02:00:00Z",
      }),
      auditRow({
        audit_id: "a-3",
        table_name: "booking_units",
        action: "INSERT",
        new_data: { booking_id: "booking-1", unit_id: "unit-3" },
        created_at: "2026-11-12T02:00:00Z",
      }),
      auditRow({
        audit_id: "a-2",
        table_name: "booking_units",
        action: "DELETE",
        user_email: null,
        old_data: { booking_id: "booking-1", unit_id: "unit-1" },
        created_at: "2026-11-11T02:00:00Z",
      }),
    ];
  });

  it("shows the guest name once and the booking line with the amount due", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "href",
      "/admin/bookings"
    );
    expect(screen.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria Santos")).toHaveLength(1);
    expect(screen.getByText("OKR-1")).toBeInTheDocument();
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
    expect(screen.getByText("₱6,000.00 due")).toBeInTheDocument();
  });

  it("goes back in history when the page was opened from the bookings list", async () => {
    history.state = { fromBookingsList: true };
    renderPage();

    await userEvent.click(screen.getByRole("link", { name: "Bookings" }));

    expect(history.back).toHaveBeenCalledOnce();
  });

  it("leaves a Cmd-click on the back link to the browser", () => {
    history.state = { fromBookingsList: true };
    renderPage();

    const back = screen.getByRole("link", { name: "Bookings" });
    back.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(back, { metaKey: true });

    expect(history.back).not.toHaveBeenCalled();
  });

  it("lets the back link go to the unfiltered list after a direct visit", async () => {
    history.state = {};
    renderPage();

    const back = screen.getByRole("link", { name: "Bookings" });
    back.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(back);

    expect(back).toHaveAttribute("href", "/admin/bookings");
    expect(history.back).not.toHaveBeenCalled();
  });

  it("shows the stay with weekdays, its length and one row for each cabin", () => {
    renderPage();
    const stay = card("Stay");

    expect(stay.getByText("Fri, Nov 13")).toBeInTheDocument();
    expect(stay.getByText("Mon, Nov 16")).toBeInTheDocument();
    expect(stay.getByText("3 nights · 6 guests")).toBeInTheDocument();
    const cabins = within(stay.getByRole("list", { name: "Cabins" })).getAllByRole("listitem");
    expect(cabins.map((row) => row.textContent)).toEqual([
      "C1Cabin 14 guests",
      "C2Cabin 22 guests",
    ]);
  });

  it("shows the guest's contact details with a tap-to-call phone and the guest record", () => {
    renderPage({ airbnb_confirmation_code: "HMABC123" });
    const guest = card("Guest");

    expect(guest.getByRole("link", { name: /0917/ })).toHaveAttribute("href", "tel:09171234567");
    expect(guest.getByText("maria@example.com")).toBeInTheDocument();
    expect(guest.getByText("HMABC123")).toBeInTheDocument();
    expect(guest.getByRole("link", { name: /View guest/ })).toBeInTheDocument();
  });

  it("shows both notes, with None for an empty one", () => {
    renderPage();
    const notes = card("Notes");

    expect(notes.getByText("Late arrival")).toBeInTheDocument();
    expect(notes.getByText("Internal note").nextSibling).toHaveTextContent("None");
  });

  it("sums only counted payments and shows Paid when nothing is owed", () => {
    const { unmount } = renderPage();
    let payments = card("Payments");
    expect(payments.getByText("Partial")).toBeInTheDocument();
    expect(payments.getByText("Received").nextSibling).toHaveTextContent("₱3,000.00");
    expect(payments.getByText("₱6,000.00")).toBeInTheDocument();
    unmount();

    renderPage({ payments: [{ amount: 9000, status: "Active" }] });
    payments = card("Payments");
    expect(payments.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText(/due$/)).not.toBeInTheDocument();
  });

  it("lists every payment in date order with its method, date, kind, proof and notes", () => {
    renderPage();
    const rows = within(card("Payments").getByRole("list", { name: "Payments" })).getAllByRole(
      "listitem"
    );

    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText("₱3,000.00")).toBeInTheDocument();
    expect(first.getByText("GCash · Nov 10, 2026 · Online downpayment")).toBeInTheDocument();
    expect(first.getByLabelText("Has payment proof")).toBeInTheDocument();
    expect(first.getByText("Ref 12345")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /₱3,000.00/ })).toHaveAttribute(
      "href",
      "/admin/payments/pay-1"
    );
    expect(within(rows[1]).getByText("Cash · Nov 12, 2026 · Payment")).toBeInTheDocument();
    expect(within(rows[1]).queryByLabelText("Has payment proof")).not.toBeInTheDocument();
  });

  it("mutes a deleted or refunded payment and leaves it out of Received", () => {
    renderPage({
      payments: [
        { payment_id: "pay-1", amount: 3000, status: "Active", payment_date: "2026-11-10" },
        { payment_id: "pay-2", amount: 1000, status: "Deleted", payment_date: "2026-11-11" },
        { payment_id: "pay-3", amount: 500, status: "Refunded", payment_date: "2026-11-12" },
      ],
    } as Partial<Booking>);
    const rows = within(card("Payments").getByRole("list", { name: "Payments" })).getAllByRole(
      "listitem"
    );

    expect(within(rows[1]).getByText("Deleted")).toBeInTheDocument();
    expect(within(rows[1]).getByText("₱1,000.00")).toHaveClass("line-through");
    expect(within(rows[2]).getByText("Refunded")).toBeInTheDocument();
    expect(within(rows[2]).getByText("₱500.00")).toHaveClass("line-through");
    expect(within(rows[0]).getByText("₱3,000.00")).not.toHaveClass("line-through");
    expect(card("Payments").getByText("₱6,000.00")).toBeInTheDocument();
  });

  it("gives a manager View proof, Edit and Delete, and Delete asks first", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Actions for payment ₱3,000.00" }));
    expect(screen.getByRole("menuitem", { name: "View proof" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    // A deleted payment with no proof leaves nothing to do
    expect(
      screen.queryByRole("button", { name: "Actions for payment ₱1,000.00" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(softDeletePayment.mutate).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" })
    );
    expect(softDeletePayment.mutate).toHaveBeenCalledWith("pay-1", expect.anything());
  });

  it("gives staff only View proof in the payment menu", async () => {
    user.role = "staff";
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Actions for payment ₱3,000.00" }));
    expect(screen.getByRole("menuitem", { name: "View proof" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Actions for payment ₱1,000.00" })
    ).not.toBeInTheDocument();
  });

  it("opens the payment proof in a modal from the row menu", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Actions for payment ₱3,000.00" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View proof" }));

    expect(screen.getByRole("dialog", { name: "Payment proof" })).toBeInTheDocument();
  });

  it("shows Record payment in the card only while a balance is due", async () => {
    const { unmount } = renderPage();
    const openFilePicker = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    await userEvent.click(card("Payments").getByRole("button", { name: "Record payment" }));
    expect(openFilePicker).toHaveBeenCalledOnce();
    openFilePicker.mockRestore();
    unmount();

    renderPage({ payments: [{ amount: 9000, status: "Active" }] });
    expect(
      card("Payments").queryByRole("button", { name: "Record payment" })
    ).not.toBeInTheDocument();
  });

  it("shows the guest's chosen method and proof on a Pending online booking", () => {
    renderPage({
      payments: [],
      payment_method: "GCash",
      payment_proof_url: "booking-1/proof.jpg",
    });
    const payments = card("Payments");

    expect(payments.getByText("Guest chose GCash")).toBeInTheDocument();
    expect(payments.getByRole("button", { name: "View payment proof" })).toBeInTheDocument();
  });

  it("gives a manager the list's main action and overflow menu", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for OKR-1" })).toBeInTheDocument();
  });

  it("gives staff no main action on a Pending booking, but keeps the menu", () => {
    user.role = "staff";
    renderPage();

    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for OKR-1" })).toBeInTheDocument();
  });

  it("offers Check out on a checked-in booking", () => {
    user.role = "staff";
    renderPage({ booking_status: "CheckedIn" });

    expect(screen.getByRole("button", { name: "Check out" })).toBeInTheDocument();
  });

  it("shows no action bar when a settled booking leaves staff nothing to do", () => {
    user.role = "staff";
    renderPage({ booking_status: "CheckedOut", payments: [{ amount: 9000, status: "Active" }] });

    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it("shows an anonymized booking read-only with personal details removed", () => {
    renderPage({
      anonymized_at: "2026-11-01T00:00:00Z",
      guest_name: "Removed guest",
      email: null,
      contact_number: null,
      special_requests: null,
    });

    expect(screen.getByText("Anonymized")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    expect(card("Guest").getByText("Personal details removed.")).toBeInTheDocument();
    expect(card("Notes").getByText("Personal details removed.")).toBeInTheDocument();
    expect(
      card("Payments").queryByRole("button", { name: "Record payment" })
    ).not.toBeInTheDocument();
  });

  const editButtons = () =>
    screen.queryAllByRole("button", { name: /^Edit / }).map((button) => button.ariaLabel);

  it.each([
    ["Pending", "staff", ["Edit stay", "Edit guest", "Edit notes"]],
    ["Confirmed", "staff", ["Edit stay", "Edit guest", "Edit notes"]],
    ["CheckedIn", "staff", ["Edit guest", "Edit notes"]],
    ["CheckedIn", "manager", ["Edit stay", "Edit guest", "Edit notes"]],
    ["CheckedOut", "staff", ["Edit guest", "Edit notes"]],
    ["Cancelled", "staff", ["Edit notes"]],
    ["CheckedOut", "manager", ["Edit guest", "Edit notes"]],
    ["Cancelled", "manager", ["Edit notes"]],
  ] as const)("shows a %s booking's %s these Edit buttons: %j", (status, role, expected) => {
    user.role = role;
    renderPage({ booking_status: status });

    expect(editButtons()).toEqual(expected);
  });

  it("shows no Edit buttons on an anonymized booking", () => {
    renderPage({ anonymized_at: "2026-11-01T00:00:00Z" });

    expect(editButtons()).toEqual([]);
  });

  it("edits the guest details in a sheet and saves only those fields", async () => {
    updateBooking.mutateAsync.mockResolvedValue({});
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit guest" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit guest" }));
    expect(sheet.getByRole("combobox", { name: "Booking source" })).toBeEnabled();
    const name = sheet.getByLabelText("Guest name");
    await userEvent.clear(name);
    await userEvent.type(name, "Maria Cruz");
    await userEvent.clear(sheet.getByLabelText("Contact number (optional)"));
    await userEvent.click(sheet.getByRole("button", { name: "Save changes" }));

    expect(updateBooking.mutateAsync).toHaveBeenCalledWith({
      bookingId: "booking-1",
      changes: {
        guest_name: "Maria Cruz",
        email: "maria@example.com",
        contact_number: null,
        booking_source: "Walk-in",
        airbnb_confirmation_code: null,
      },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the booking source of a Website booking", async () => {
    renderPage({ booking_source: "Website" });

    await userEvent.click(screen.getByRole("button", { name: "Edit guest" }));

    expect(screen.getByRole("combobox", { name: "Booking source" })).toBeDisabled();
  });

  it("edits both notes in a sheet and saves only those fields", async () => {
    updateBooking.mutateAsync.mockResolvedValue({});
    user.role = "staff";
    renderPage({ booking_status: "CheckedIn" });

    await userEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit notes" }));
    expect(sheet.getByLabelText("Special request")).toHaveValue("Late arrival");
    await userEvent.type(sheet.getByLabelText("Internal note"), "Paid the rest in cash");
    await userEvent.click(sheet.getByRole("button", { name: "Save changes" }));

    expect(updateBooking.mutateAsync).toHaveBeenCalledWith({
      bookingId: "booking-1",
      changes: { special_requests: "Late arrival", internal_notes: "Paid the rest in cash" },
    });
  });

  it("offers only the internal note on a Cancelled booking", async () => {
    updateBooking.mutateAsync.mockResolvedValue({});
    renderPage({ booking_status: "Cancelled" });

    await userEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit notes" }));
    expect(sheet.queryByLabelText("Special request")).not.toBeInTheDocument();
    await userEvent.type(sheet.getByLabelText("Internal note"), "Guest cancelled by phone");
    await userEvent.click(sheet.getByRole("button", { name: "Save changes" }));

    expect(updateBooking.mutateAsync).toHaveBeenCalledWith({
      bookingId: "booking-1",
      changes: { internal_notes: "Guest cancelled by phone" },
    });
  });

  it("asks before Escape drops unsaved changes, and Keep editing keeps them", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    await userEvent.type(screen.getByLabelText("Internal note"), "Draft");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByLabelText("Internal note")).toHaveValue("Draft");
  });

  it("drops unsaved changes when staff leave from the Close button", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit guest" }));
    await userEvent.type(screen.getByLabelText("Guest name"), " Jr");
    await userEvent.click(screen.getByText("Close", { selector: "button" }));
    expect(screen.getByRole("alertdialog", { name: "Leave without saving?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit guest" }));

    expect(screen.getByLabelText("Guest name")).toHaveValue(booking.guest_name);
  });

  it("closes a sheet with no changes at once", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit guest" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before closing a stay sheet with a changed cabin", async () => {
    renderPage();

    await swapCabin2ForCabin4();

    for (const close of screen.getAllByRole("button", { name: "Close" })) {
      await userEvent.click(close);
      expect(
        screen.getByRole("alertdialog", { name: "Leave without saving?" })
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    }
    expect(screen.getByRole("dialog", { name: "Edit stay" })).toBeInTheDocument();
  });

  it("shows a database refusal in the sheet and keeps it open", async () => {
    updateBooking.mutateAsync.mockRejectedValue(
      new Error("A cancelled booking allows only its internal note to change")
    );
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const sheet = within(screen.getByRole("dialog", { name: "Edit notes" }));
    expect(sheet.getByText("Nothing was saved")).toBeInTheDocument();
    expect(
      sheet.getByText("A cancelled booking allows only its internal note to change")
    ).toBeInTheDocument();
  });

  it("edits the dates and cabins in a sheet, with taken cabins disabled", async () => {
    updateStay.mutateAsync.mockResolvedValue({});
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));
    expect(sheet.getByRole("button", { name: "Stay dates" })).toBeEnabled();
    expect(availability).toHaveBeenLastCalledWith(
      units.map((unit) => unit.unit_id),
      "2026-11-13",
      "2026-11-16",
      expect.objectContaining({ excludeBookingId: "booking-1" })
    );
    expect(sheet.getByRole("button", { name: "Add Cabin 3" })).toBeDisabled();
    expect(sheet.getByText("Booked")).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: "Remove Cabin 2" }));
    await userEvent.click(sheet.getByRole("button", { name: "Add Cabin 4" }));
    await userEvent.click(sheet.getByRole("button", { name: "One guest more in Cabin 4" }));
    await userEvent.click(sheet.getByRole("button", { name: "Save changes" }));

    expect(updateStay.mutateAsync).toHaveBeenCalledWith({
      bookingId: "booking-1",
      stay: { check_in: "2026-11-13", check_out: "2026-11-16" },
      cabins: [
        { unit_id: "unit-1", assigned_guests: 4 },
        { unit_id: "unit-4", assigned_guests: 3 },
      ],
      recompute: false,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the stay sheet open while only the new check-in day is picked", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    await userEvent.click(screen.getByRole("button", { name: "Stay dates" }));
    await userEvent.click(screen.getAllByRole("button", { name: / 20th, / })[0]);

    expect(screen.getByRole("dialog", { name: "Edit stay" })).toBeInTheDocument();
    expect(screen.getByText("Pick the dates first to see free cabins.")).toBeInTheDocument();
  });

  const swapCabin2ForCabin4 = async () => {
    if (!screen.queryByRole("dialog")) {
      await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    }
    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));
    await userEvent.click(sheet.getByRole("button", { name: "Remove Cabin 2" }));
    await userEvent.click(sheet.getByRole("button", { name: "Add Cabin 4" }));
    return sheet;
  };

  it("lets a manager recompute the total from current rates after a stay change", async () => {
    updateStay.mutateAsync.mockResolvedValue({});
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    const sheet = await swapCabin2ForCabin4();
    const recompute = sheet.getByRole("checkbox", { name: "Recompute total from current rates" });
    expect(recompute).not.toBeChecked();
    expect(sheet.getByText("Total ₱9,000.00 → ₱6,000.00")).toBeInTheDocument();
    await userEvent.click(recompute);
    await userEvent.click(sheet.getByRole("button", { name: "Save changes" }));

    // Three nights at ₱1,000, no weekend surcharge and no guest over the base occupancy
    const priced = {
      unit_price: 3000,
      weekend_surcharge: 0,
      extra_person_charge: 0,
      subtotal: 3000,
    };
    expect(updateStay.mutateAsync).toHaveBeenCalledWith({
      bookingId: "booking-1",
      stay: { check_in: "2026-11-13", check_out: "2026-11-16" },
      cabins: [
        { unit_id: "unit-1", assigned_guests: 4, ...priced },
        { unit_id: "unit-4", assigned_guests: 2, ...priced },
      ],
      recompute: true,
    });
  });

  it("shows staff the new price only as a hint", async () => {
    user.role = "staff";
    renderPage();

    const sheet = await swapCabin2ForCabin4();

    expect(sheet.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(sheet.getByText("Total ₱9,000.00 → ₱6,000.00")).toBeInTheDocument();
    expect(sheet.getByText("Ask a manager to update the total")).toBeInTheDocument();
  });

  it.each(["manager", "staff"])(
    "shows an Airbnb booking's %s no recompute and no price hint",
    async (role) => {
      user.role = role;
      renderPage({ booking_source: "Airbnb" });

      const sheet = await swapCabin2ForCabin4();

      expect(sheet.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(sheet.queryByText(/→ ₱/)).not.toBeInTheDocument();
      expect(sheet.queryByText("Ask a manager to update the total")).not.toBeInTheDocument();
    }
  );

  it("opens the edit sheet named in the URL only where the section is editable", () => {
    const { unmount } = renderPage({}, "stay");
    expect(screen.getByRole("dialog", { name: "Edit stay" })).toBeInTheDocument();
    unmount();

    renderPage({ booking_status: "CheckedOut" }, "stay");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps at least one cabin in the stay", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));
    await userEvent.click(sheet.getByRole("button", { name: "Remove Cabin 1" }));
    await userEvent.click(sheet.getByRole("button", { name: "Remove Cabin 2" }));

    expect(sheet.getByText("Add at least one cabin.")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("lets staff change the cabins of a Confirmed booking but not its dates", async () => {
    user.role = "staff";
    renderPage({ booking_status: "Confirmed" });

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));

    expect(sheet.queryByRole("button", { name: "Stay dates" })).not.toBeInTheDocument();
    expect(
      sheet.getByText("Only a manager can change the dates of a confirmed booking.")
    ).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Add Cabin 4" })).toBeEnabled();
  });

  it("locks the check-in day of a checked-in stay", async () => {
    renderPage({ booking_status: "CheckedIn" });

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));

    expect(sheet.queryByRole("button", { name: "Stay dates" })).not.toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Check-out day" })).toBeEnabled();
    expect(sheet.getByText("Check-in Fri, Nov 13")).toBeInTheDocument();
  });

  it("shows a taken cabin refusal in the stay sheet", async () => {
    updateStay.mutateAsync.mockRejectedValue(
      new Error("This unit is already booked for some of these days")
    );
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Edit stay" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const sheet = within(screen.getByRole("dialog", { name: "Edit stay" }));
    expect(sheet.getByText("Nothing was saved")).toBeInTheDocument();
    expect(
      sheet.getByText("This unit is already booked for some of these days")
    ).toBeInTheDocument();
  });

  it("folds a manager's History card, newest first, with named cabins", async () => {
    renderPage();

    const toggle = await screen.findByRole("button", { name: "History 3" });
    expect(screen.queryByText("Cabin 3 added")).not.toBeInTheDocument();
    await userEvent.click(toggle);

    const entries = within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem");
    expect(entries.map((entry) => entry.textContent)).toEqual([
      expect.stringContaining("Cabin 3 added"),
      expect.stringContaining("Cabin 1 removed"),
      expect.stringContaining("Changed check out, num guests"),
    ]);
    expect(within(entries[0]).getByText("Created")).toBeInTheDocument();
    expect(entries[0]).toHaveTextContent("manager@example.com · Nov 12, 2026 10:00 AM");
    expect(entries[1]).toHaveTextContent("System · Nov 11, 2026 10:00 AM");
    expect(screen.queryByText("Showing the 50 newest changes.")).not.toBeInTheDocument();
  });

  it.each([
    [50, false],
    [51, true],
  ])(
    "with %i changes, History shows 50 and says so only when some are hidden",
    async (count, notice) => {
      historyRows.value = Array.from({ length: count }, (_, index) =>
        auditRow({
          audit_id: `a-${index}`,
          table_name: "bookings",
          action: "UPDATE",
          changed_fields: ["internal_notes"],
          created_at: "2026-11-10T02:00:00Z",
        })
      );
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "History 50" }));

      expect(
        within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem")
      ).toHaveLength(50);
      expect(screen.queryByText("Showing the 50 newest changes.") !== null).toBe(notice);
    }
  );

  it.each(["owner", "admin"])("gives an %s the History card", async (role) => {
    user.role = role;
    renderPage();

    expect(await screen.findByRole("button", { name: "History 3" })).toBeInTheDocument();
  });

  it("says when History fails to load instead of showing it empty", async () => {
    fetchHistory.mockImplementation(() => {
      throw new Error("offline");
    });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "History" }));

    expect(await screen.findByText("Couldn't load the history.")).toBeInTheDocument();
  });

  it("gives staff no History card and no history fetch", () => {
    user.role = "staff";
    renderPage();

    expect(screen.queryByRole("button", { name: /^History/ })).not.toBeInTheDocument();
    expect(fetchHistory).not.toHaveBeenCalled();
  });
});
