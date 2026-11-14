import { useId, type ReactNode } from "react";

import { Pencil } from "lucide-react";

import { formatPhoneNumber, RelatedEntityLink } from "@/components/entity-detail";
import { Button, ListCard, ListCardRow, StatusBadge } from "@/components/patterns";
import { manilaDayOf, nightsBetween } from "@/lib/bookings";
import { outstandingBalance, receivedAmount } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { formatPhilippineDate } from "@/lib/timezone";
import type { Booking } from "@/types";

import { CabinChip } from "./CabinChip";

interface SectionProps {
  booking: Booking;
  /** Shows the section's Edit button; left out where the section is read-only. */
  onEdit?: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const weekdayDate = (iso: string) => formatPhilippineDate(new Date(iso), "EEE, MMM d");

const REMOVED = <p className="text-muted-foreground text-sm">Personal details removed.</p>;

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <ListCard>
        <div className="flex min-h-8 items-center justify-between gap-2">
          <h2 id={headingId} className="font-display text-base font-semibold">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </ListCard>
    </section>
  );
}

const EditButton = ({ section, onEdit }: { section: string; onEdit?: () => void }) =>
  onEdit ? (
    <Button
      variant="ghost"
      size="sm"
      className="-mr-2"
      aria-label={`Edit ${section}`}
      onClick={onEdit}
    >
      <Pencil className="size-4" aria-hidden />
      Edit
    </Button>
  ) : null;

export function StayCard({ booking, onEdit }: SectionProps) {
  const nights = nightsBetween(manilaDayOf(booking.check_in), manilaDayOf(booking.check_out));
  return (
    <SectionCard title="Stay" action={<EditButton section="stay" onEdit={onEdit} />}>
      <ListCardRow label="Check-in" value={weekdayDate(booking.check_in)} />
      <ListCardRow label="Check-out" value={weekdayDate(booking.check_out)} />
      <ListCardRow
        label="Length"
        value={`${plural(nights, "night")} · ${plural(booking.num_guests, "guest")}`}
      />
      {booking.booking_units?.length ? (
        <ul aria-label="Cabins" className="divide-y border-t">
          {booking.booking_units.map((bookingUnit) => (
            <li key={bookingUnit.booking_unit_id} className="flex items-center gap-2 pt-2 text-sm">
              <CabinChip bookingUnit={bookingUnit} />
              <span className="min-w-0 flex-1 truncate">{bookingUnit.unit?.unit_name}</span>
              <span className="text-muted-foreground tabular-nums">
                {plural(bookingUnit.assigned_guests ?? 0, "guest")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground border-t pt-2 text-sm">No cabins assigned</p>
      )}
    </SectionCard>
  );
}

export function GuestCard({ booking, onEdit }: SectionProps) {
  return (
    <SectionCard title="Guest" action={<EditButton section="guest" onEdit={onEdit} />}>
      {booking.anonymized_at ? (
        REMOVED
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
              value={<RelatedEntityLink type="guest" id={booking.guest_id} label="View guest" />}
            />
          )}
        </>
      )}
    </SectionCard>
  );
}

const Note = ({ label, text }: { label: string; text: string | null | undefined }) => (
  <div className="space-y-0.5">
    <p className="text-muted-foreground text-xs font-medium">{label}</p>
    <p className="text-sm break-words whitespace-pre-wrap">
      {text || <span className="text-muted-foreground">None</span>}
    </p>
  </div>
);

export function NotesCard({ booking, onEdit }: SectionProps) {
  return (
    <SectionCard title="Notes" action={<EditButton section="notes" onEdit={onEdit} />}>
      {booking.anonymized_at ? (
        REMOVED
      ) : (
        <>
          <Note label="Special request" text={booking.special_requests} />
          <Note label="Internal note" text={booking.internal_notes} />
        </>
      )}
    </SectionCard>
  );
}

export function PaymentSummaryCard({ booking }: { booking: Booking }) {
  const outstanding = outstandingBalance(booking);
  return (
    <SectionCard
      title="Payments"
      action={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
    >
      <ListCardRow label="Total" value={formatCurrency(booking.total_amount)} />
      <ListCardRow label="Received" value={formatCurrency(receivedAmount(booking))} />
      <ListCardRow
        label="Outstanding balance"
        value={
          <span className="font-semibold">
            {outstanding > 0 ? formatCurrency(outstanding) : "Paid"}
          </span>
        }
      />
    </SectionCard>
  );
}
