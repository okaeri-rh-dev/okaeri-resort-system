// PROTOTYPE (issue 450): three layouts of the booking page, switched by ?variant=A|B|C on
// /admin/bookings/$bookingId. Payments are sample rows and every action is a toast stub,
// except Verify payment, which still opens the real dialog. Never merge to main.
import { useState, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FileImage, Pencil } from "lucide-react";

import { BookingOverflowMenu } from "@/components/bookings/BookingsTable/components/BookingOverflowMenu";
import { CabinChip } from "@/components/bookings/BookingsTable/components/CabinChip";
import { MainActionButton } from "@/components/bookings/BookingsTable/components/MainActionButton";
import { NeedsActionLabel } from "@/components/bookings/BookingsTable/components/NeedsActionLabel";
import { SourceBadge } from "@/components/bookings/BookingsTable/components/SourceBadge";
import {
  DetailAuditSection,
  formatFullDate,
  formatPhoneNumber,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  DetailField,
  DetailSection,
  ListCard,
  ListCardRow,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

const stub = (what: string) => () => toast(`Prototype: ${what}`);
const actions = {
  updateBookingStatus: {
    mutate: (v: { status: string }) => toast(`Prototype: status → ${v.status}`),
  },
  onRecordPayment: stub("Record payment"),
  onCancel: stub("Cancel booking"),
};

type SamplePayment = {
  id: string;
  amount: number;
  method: string;
  date: string;
  kind: string;
  notes?: string;
  hasProof: boolean;
  status: "Active" | "Deleted" | "Refunded";
};

function samplePayments(booking: Booking): SamplePayment[] {
  const half = Math.round(booking.total_amount / 2);
  return [
    {
      id: "p1",
      amount: half,
      method: "GCash",
      date: booking.created_at ?? booking.check_in,
      kind: "Online downpayment",
      hasProof: true,
      status: "Active",
    },
    {
      id: "p2",
      amount: 1000,
      method: "Cash",
      date: booking.check_in,
      kind: "Payment",
      notes: "Entered twice by mistake",
      hasProof: false,
      status: "Deleted",
    },
    {
      id: "p3",
      amount: Math.round(half / 2),
      method: "Bank transfer",
      date: booking.check_in,
      kind: "Payment",
      notes: "Paid at arrival, rest at check-out",
      hasProof: true,
      status: "Active",
    },
  ];
}

function money(booking: Booking) {
  const payments = samplePayments(booking);
  const received = payments.filter((p) => p.status === "Active").reduce((s, p) => s + p.amount, 0);
  return { payments, received, outstanding: Math.max(booking.total_amount - received, 0) };
}

const readOnly = (booking: Booking) => !!booking.anonymized_at;

function EditPencil({ booking, section }: { booking: Booking; section: string }) {
  if (readOnly(booking)) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Edit ${section}`}
      onClick={stub(`Edit ${section} sheet`)}
    >
      <Pencil className="size-4" aria-hidden />
    </Button>
  );
}

function Badges({ booking }: { booking: Booking }) {
  return (
    <div className="flex flex-wrap items-center gap-2 tabular-nums">
      <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
      <SourceBadge source={booking.booking_source} />
      <NeedsActionLabel booking={booking} />
      {booking.anonymized_at && (
        <StatusBadge tone="neutral">Anonymized {formatFullDate(booking.anonymized_at)}</StatusBadge>
      )}
    </div>
  );
}

function Actions({ booking, className }: { booking: Booking; className?: string }) {
  if (readOnly(booking)) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <MainActionButton booking={booking} {...actions} className="flex-1" />
      <BookingOverflowMenu booking={booking} {...actions} />
    </div>
  );
}

function StayBody({ booking }: { booking: Booking }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <DetailField label="Check-in" value={formatTableDate(booking.check_in)} emphasis="strong" />
      <DetailField label="Check-out" value={formatTableDate(booking.check_out)} emphasis="strong" />
      <DetailField label="Guests" value={booking.num_guests} />
      <DetailField
        label="Cabins"
        value={
          <span className="flex flex-wrap gap-1">
            {(booking.booking_units ?? []).map((bu) => (
              <span key={bu.booking_unit_id} className="flex items-center gap-1">
                <CabinChip bookingUnit={bu} />
                {(booking.booking_units?.length ?? 0) > 1 && (
                  <span className="text-muted-foreground text-xs">{bu.assigned_guests ?? 0}</span>
                )}
              </span>
            ))}
          </span>
        }
      />
    </div>
  );
}

function GuestBody({ booking }: { booking: Booking }) {
  if (readOnly(booking)) {
    return <p className="text-muted-foreground text-sm">Personal details removed.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <DetailField
        label="Name"
        value={
          booking.guest_id ? (
            <RelatedEntityLink type="guest" id={booking.guest_id} label={booking.guest_name} />
          ) : (
            booking.guest_name
          )
        }
      />
      {booking.contact_number && (
        <DetailField label="Phone" value={formatPhoneNumber(booking.contact_number)} />
      )}
      {booking.email && <DetailField label="Email" value={booking.email} />}
      {booking.airbnb_confirmation_code && (
        <DetailField label="Airbnb code" value={booking.airbnb_confirmation_code} />
      )}
    </div>
  );
}

function PaymentRows({ booking }: { booking: Booking }) {
  const { payments } = money(booking);
  return (
    <ul className="divide-y">
      {payments.map((p) => {
        const counted = p.status === "Active";
        return (
          <li
            key={p.id}
            className={cn("flex items-start gap-2 py-2", !counted && "text-muted-foreground")}
          >
            <button
              type="button"
              onClick={stub("open payment detail page")}
              className="min-w-0 flex-1 text-left"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cn("font-semibold tabular-nums", !counted && "line-through")}>
                  {formatCurrency(p.amount)}
                </span>
                <span>{p.method}</span>
                {p.hasProof && <FileImage className="size-4" aria-label="Has proof" />}
                {!counted && (
                  <StatusBadge tone="neutral" size="compact">
                    {p.status === "Deleted" ? "Removed" : "Refunded"}
                  </StatusBadge>
                )}
              </span>
              <span className="text-muted-foreground block text-xs">
                {formatTableDate(p.date)} · {p.kind}
              </span>
              {p.notes && <span className="block text-xs break-words">{p.notes}</span>}
            </button>
            <ActionMenu
              label={`Actions for payment ${formatCurrency(p.amount)}`}
              actions={[
                ...(p.hasProof ? [{ label: "View proof", onClick: stub("View proof") }] : []),
                { label: "Edit", onClick: stub("Edit payment") },
                {
                  label: "Remove",
                  onClick: stub("Remove payment"),
                  variant: "destructive" as const,
                },
              ]}
            />
          </li>
        );
      })}
    </ul>
  );
}

function MoneySummary({
  booking,
  size = "default",
  rows = false,
}: {
  booking: Booking;
  size?: "default" | "large";
  rows?: boolean;
}) {
  const { received, outstanding } = money(booking);
  const emphasis = size === "large" ? "total" : "figure";
  const direction = rows ? "horizontal" : "vertical";
  return (
    <div className={rows ? "divide-y" : "grid grid-cols-1 gap-4 @md:grid-cols-3"}>
      <DetailField
        label="Total"
        value={formatCurrency(booking.total_amount)}
        emphasis={emphasis}
        direction={direction}
      />
      <DetailField
        label="Received"
        value={formatCurrency(received)}
        emphasis={emphasis}
        direction={direction}
      />
      <DetailField
        label="Outstanding"
        value={outstanding > 0 ? formatCurrency(outstanding) : "Paid"}
        emphasis={emphasis}
        direction={direction}
      />
    </div>
  );
}

function RecordPayment({ booking }: { booking: Booking }) {
  if (readOnly(booking) || money(booking).outstanding === 0) return null;
  return (
    <Button variant="outline" className="w-full" onClick={actions.onRecordPayment}>
      Record payment
    </Button>
  );
}

function PaymentsSection({
  booking,
  withSummary = true,
}: {
  booking: Booking;
  withSummary?: boolean;
}) {
  return (
    <DetailSection
      title="Payments"
      action={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
    >
      <div className="@container space-y-4">
        <PaymentRows booking={booking} />
        {withSummary && <MoneySummary booking={booking} />}
        <RecordPayment booking={booking} />
      </div>
    </DetailSection>
  );
}

function NotesBody({ booking }: { booking: Booking }) {
  return (
    <div className="space-y-4">
      <DetailField
        label="Special request"
        value={booking.special_requests || <span className="text-muted-foreground">None</span>}
      />
      <DetailField
        label="Internal note"
        value={booking.internal_notes || <span className="text-muted-foreground">None</span>}
      />
    </div>
  );
}

function Breadcrumb({ booking }: { booking: Booking }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center gap-2 text-sm">
      <Link to="/admin/bookings" className="hover:text-foreground">
        Bookings
      </Link>
      <ChevronRight className="size-4" aria-hidden />
      <span className="text-foreground font-medium tabular-nums" aria-current="page">
        {booking.booking_reference}
      </span>
    </nav>
  );
}

function Title({ booking }: { booking: Booking }) {
  return (
    <h1 className="font-display min-w-0 text-2xl font-semibold break-words">
      {readOnly(booking) ? "Removed guest" : booking.guest_name}
    </h1>
  );
}

const Audit = ({ booking }: { booking: Booking }) => (
  <DetailAuditSection entityType="booking" entityId={booking.booking_id} defaultCollapsed />
);

/** Fixed above the compact bottom nav; hidden from expanded, where the rail or header holds it. */
function StickyActionBar({ booking }: { booking: Booking }) {
  if (readOnly(booking)) return null;
  return (
    <div className="bg-card shadow-popover medium:bottom-0 medium:left-20 expanded:hidden fixed inset-x-0 bottom-(--admin-bottom-bar-height) z-30 border-t px-4 py-2">
      <Actions booking={booking} />
    </div>
  );
}

/** A: a summary rail beside the main column from expanded; summary on top and a sticky bar below it. */
export function VariantA({ booking }: { booking: Booking }) {
  return (
    <div className="expanded:pb-0 space-y-4 pb-20">
      <Breadcrumb booking={booking} />
      <div className="expanded:grid-cols-[minmax(0,1fr)_360px] large:grid-cols-[minmax(0,1fr)_412px] grid grid-cols-1 items-start gap-6">
        <aside className="expanded:sticky expanded:top-4 expanded:order-2 order-1 space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Title booking={booking} />
                <Badges booking={booking} />
              </div>
              <Actions booking={booking} className="expanded:flex hidden" />
              <MoneySummary booking={booking} rows />
              <p className="text-muted-foreground text-sm tabular-nums">
                {formatTableDate(booking.check_in)} → {formatTableDate(booking.check_out)} ·{" "}
                {booking.num_guests} guests
              </p>
            </CardContent>
          </Card>
        </aside>
        <div className="expanded:order-1 order-2 min-w-0 space-y-6">
          <DetailSection title="Stay" action={<EditPencil booking={booking} section="stay" />}>
            <StayBody booking={booking} />
          </DetailSection>
          <DetailSection title="Guest" action={<EditPencil booking={booking} section="guest" />}>
            <GuestBody booking={booking} />
          </DetailSection>
          <PaymentsSection booking={booking} withSummary={false} />
          <DetailSection title="Notes" action={<EditPencil booking={booking} section="notes" />}>
            <NotesBody booking={booking} />
          </DetailSection>
          <Audit booking={booking} />
        </div>
      </div>
      <StickyActionBar booking={booking} />
    </div>
  );
}

/** B: one reading column at every width; actions sit in the header, nothing sticks. */
export function VariantB({ booking }: { booking: Booking }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumb booking={booking} />
      <header className="space-y-3">
        <Title booking={booking} />
        <Badges booking={booking} />
        <Actions booking={booking} className="medium:max-w-sm" />
      </header>
      <DetailSection title="Stay" action={<EditPencil booking={booking} section="stay" />}>
        <StayBody booking={booking} />
      </DetailSection>
      <DetailSection title="Guest" action={<EditPencil booking={booking} section="guest" />}>
        <GuestBody booking={booking} />
      </DetailSection>
      <PaymentsSection booking={booking} />
      <DetailSection
        title="Special request"
        action={<EditPencil booking={booking} section="notes" />}
      >
        <p className="text-sm break-words whitespace-pre-wrap">
          {booking.special_requests || <span className="text-muted-foreground">None</span>}
        </p>
      </DetailSection>
      <DetailSection
        title="Internal note"
        action={<EditPencil booking={booking} section="notes" />}
      >
        <p className="text-sm break-words whitespace-pre-wrap">
          {booking.internal_notes || <span className="text-muted-foreground">None</span>}
        </p>
      </DetailSection>
      <Audit booking={booking} />
    </div>
  );
}

/** C: a hero with the money up front, then tabs (Details, Payments, History); sticky bar on phone. */
export function VariantC({ booking }: { booking: Booking }) {
  const [tab, setTab] = useState("details");
  const { payments } = money(booking);
  return (
    <div className="expanded:pb-0 space-y-6 pb-20">
      <Breadcrumb booking={booking} />
      <section className="bg-card @container space-y-4 rounded-lg border p-4">
        <div className="expanded:flex-row expanded:items-start expanded:justify-between flex flex-col gap-4">
          <div className="min-w-0 space-y-2">
            <Title booking={booking} />
            <Badges booking={booking} />
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatTableDate(booking.check_in)} → {formatTableDate(booking.check_out)}
            </p>
          </div>
          <Actions booking={booking} className="expanded:flex hidden w-80" />
        </div>
        <MoneySummary booking={booking} size="large" />
      </section>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="expanded:grid-cols-2 mt-4 grid grid-cols-1 gap-6">
          <DetailSection title="Stay" action={<EditPencil booking={booking} section="stay" />}>
            <StayBody booking={booking} />
          </DetailSection>
          <DetailSection title="Guest" action={<EditPencil booking={booking} section="guest" />}>
            <GuestBody booking={booking} />
          </DetailSection>
          <DetailSection
            title="Notes"
            action={<EditPencil booking={booking} section="notes" />}
            className="expanded:col-span-2"
          >
            <NotesBody booking={booking} />
          </DetailSection>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsSection booking={booking} withSummary={false} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Audit booking={booking} />
        </TabsContent>
      </Tabs>
      <StickyActionBar booking={booking} />
    </div>
  );
}

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });

const nightsOf = (booking: Booking) =>
  Math.round(
    (new Date(booking.check_out.slice(0, 10)).getTime() -
      new Date(booking.check_in.slice(0, 10)).getTime()) /
      86_400_000
  );

function DenseCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ListCard>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </ListCard>
  );
}

function SmallPencil({ booking, section }: { booking: Booking; section: string }) {
  if (readOnly(booking)) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-mr-2"
      aria-label={`Edit ${section}`}
      onClick={stub(`Edit ${section} sheet`)}
    >
      <Pencil className="size-4" aria-hidden />
      Edit
    </Button>
  );
}

function DenseStay({ booking }: { booking: Booking }) {
  const nights = nightsOf(booking);
  return (
    <DenseCard title="Stay" action={<SmallPencil booking={booking} section="stay" />}>
      <ListCardRow label="Check-in" value={shortDay(booking.check_in)} />
      <ListCardRow label="Check-out" value={shortDay(booking.check_out)} />
      <ListCardRow
        label="Length"
        value={`${nights} ${nights === 1 ? "night" : "nights"} · ${booking.num_guests} guests`}
      />
      <ul className="divide-y border-t">
        {(booking.booking_units ?? []).map((bu) => (
          <li key={bu.booking_unit_id} className="flex items-center gap-2 pt-2 text-sm">
            <CabinChip bookingUnit={bu} />
            <span className="min-w-0 flex-1 truncate">{bu.unit?.unit_name ?? "Cabin"}</span>
            <span className="text-muted-foreground tabular-nums">
              {bu.assigned_guests ?? 0} guests
            </span>
          </li>
        ))}
      </ul>
    </DenseCard>
  );
}

function DenseGuest({ booking }: { booking: Booking }) {
  return (
    <DenseCard title="Guest" action={<SmallPencil booking={booking} section="guest" />}>
      {readOnly(booking) ? (
        <p className="text-muted-foreground text-sm">Personal details removed.</p>
      ) : (
        <>
          {booking.contact_number && (
            <ListCardRow
              label="Phone"
              value={
                <a href={`tel:${booking.contact_number}`} className="text-primary">
                  {formatPhoneNumber(booking.contact_number)}
                </a>
              }
            />
          )}
          {booking.email && (
            <ListCardRow
              label="Email"
              value={<span className="block truncate">{booking.email}</span>}
            />
          )}
          {booking.airbnb_confirmation_code && (
            <ListCardRow label="Airbnb code" value={booking.airbnb_confirmation_code} />
          )}
          {booking.guest_id && (
            <ListCardRow
              label="Guest record"
              value={<RelatedEntityLink type="guest" id={booking.guest_id} label="Open" />}
            />
          )}
        </>
      )}
    </DenseCard>
  );
}

function DensePayments({ booking }: { booking: Booking }) {
  const { received, outstanding } = money(booking);
  return (
    <DenseCard
      title="Payments"
      action={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
    >
      <PaymentRows booking={booking} />
      <div className="space-y-1 border-t pt-2">
        <ListCardRow label="Total" value={formatCurrency(booking.total_amount)} />
        <ListCardRow label="Received" value={formatCurrency(received)} />
        <ListCardRow
          label="Outstanding"
          value={
            <span className="font-semibold">
              {outstanding > 0 ? formatCurrency(outstanding) : "Paid"}
            </span>
          }
        />
      </div>
      {!readOnly(booking) && outstanding > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={actions.onRecordPayment}>
          Record payment
        </Button>
      )}
    </DenseCard>
  );
}

function DenseNotes({ booking }: { booking: Booking }) {
  const note = (label: string, text?: string | null) => (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-sm break-words whitespace-pre-wrap">
        {text || <span className="text-muted-foreground">None</span>}
      </p>
    </div>
  );
  return (
    <DenseCard title="Notes" action={<SmallPencil booking={booking} section="notes" />}>
      {note("Special request", booking.special_requests)}
      {note("Internal note", booking.internal_notes)}
    </DenseCard>
  );
}

/** D: dense. Tight cards of label-value rows, a one-line header, cabins as rows; two columns from expanded. */
export function VariantD({ booking }: { booking: Booking }) {
  const { outstanding } = money(booking);
  return (
    <div className="expanded:pb-0 space-y-4 pb-16">
      <header className="expanded:flex-row expanded:items-start expanded:justify-between flex flex-col gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            to="/admin/bookings"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            <ChevronLeft className="size-3" aria-hidden />
            Bookings
          </Link>
          <h1 className="font-display text-xl font-semibold break-words">
            {readOnly(booking) ? "Removed guest" : booking.guest_name}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
            <span>{booking.booking_reference}</span>
            <StatusBadge size="compact" {...statusBadgeProps(booking.booking_status, "Pending")} />
            <SourceBadge source={booking.booking_source} />
            <NeedsActionLabel booking={booking} />
            {outstanding > 0 && (
              <span className="text-foreground font-medium">{formatCurrency(outstanding)} due</span>
            )}
          </div>
        </div>
        <Actions booking={booking} className="expanded:flex hidden w-72 shrink-0" />
      </header>
      <div className="expanded:grid-cols-2 grid grid-cols-1 items-start gap-4">
        <div className="space-y-4">
          <DenseStay booking={booking} />
          <DenseGuest booking={booking} />
          <DenseNotes booking={booking} />
        </div>
        <DensePayments booking={booking} />
      </div>
      <Audit booking={booking} />
      <StickyActionBar booking={booking} />
    </div>
  );
}
