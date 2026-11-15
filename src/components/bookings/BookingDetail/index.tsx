import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { BookingActionBar } from "@/components/bookings/BookingSections/BookingActionBar";
import { BookingHeaderLine } from "@/components/bookings/BookingSections/BookingHeaderLine";
import { GuestPaymentChoice, PaymentRows } from "@/components/bookings/BookingSections/PaymentRows";
import {
  GuestCard,
  NotesCard,
  PaymentSummaryCard,
  StayCard,
} from "@/components/bookings/BookingSections/sections";
import { useBookingActions } from "@/components/bookings/BookingSections/useBookingActions";
import { useUserRole } from "@/hooks";
import { canEditSection, type EditableSection } from "@/lib/bookings";
import { isPlainClick } from "@/lib/utils";
import type { Booking } from "@/types";
import type { Payment as PaymentRow } from "@/types/entity-detail.types";

import { BookingHistoryCard } from "./BookingHistoryCard";
import { GuestEditSheet, NotesEditSheet, StayEditSheet } from "./EditSheets";

interface BookingDetailPageProps {
  booking: Booking;
  bookingId: string;
  /** The open edit sheet, from the route's ?edit= */
  editing: EditableSection | undefined;
  onEditingChange: (section: EditableSection | undefined) => void;
}

export function BookingDetailPage({
  booking,
  bookingId,
  editing,
  onEditingChange,
}: BookingDetailPageProps) {
  const { updateBookingStatus, cancelBooking, handleUploadPayment } = useBookingActions();
  const router = useRouter();
  const { role, isManager } = useUserRole();
  const fromBookingsList = useLocation({ select: (location) => location.state.fromBookingsList });
  const editHandler = (section: EditableSection) =>
    canEditSection(booking, section, role) ? () => onEditingChange(section) : undefined;
  const closeSheet = () => onEditingChange(undefined);

  return (
    // The bottom padding keeps the compact action bar off the last card
    <div data-testid="booking-detail" className="expanded:pb-0 space-y-6 pb-24">
      <header className="expanded:flex-row expanded:items-start expanded:justify-between flex flex-col gap-3">
        <div className="min-w-0 space-y-1">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Link renders an a with an href */}
          <Link
            to="/admin/bookings"
            // Back keeps the list's filters; a direct visit gets the list with none
            onClick={(event) => {
              if (!fromBookingsList || !isPlainClick(event)) return;
              event.preventDefault();
              router.history.back();
            }}
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
          >
            <ChevronLeft className="size-3" aria-hidden />
            Bookings
          </Link>
          <h1 className="font-display text-2xl font-semibold break-words">{booking.guest_name}</h1>
          <BookingHeaderLine booking={booking} />
        </div>
        <BookingActionBar
          booking={booking}
          updateBookingStatus={updateBookingStatus}
          onRecordPayment={() => handleUploadPayment(booking)}
          onCancel={() => cancelBooking.mutate(booking.booking_id)}
          placement="page"
        />
      </header>

      <div className="expanded:grid-cols-2 grid grid-cols-1 items-start gap-4">
        <div className="space-y-4">
          <StayCard booking={booking} onEdit={editHandler("stay")} />
          <GuestCard booking={booking} onEdit={editHandler("guest")} />
          <NotesCard booking={booking} onEdit={editHandler("notes")} />
        </div>
        <PaymentSummaryCard
          booking={booking}
          // The detail query loads whole payment rows
          rows={
            <PaymentRows
              payments={(booking.payments ?? []) as PaymentRow[]}
              readOnly={!!booking.anonymized_at}
            />
          }
          onRecordPayment={booking.anonymized_at ? undefined : () => handleUploadPayment(booking)}
        >
          {booking.booking_status === "Pending" && <GuestPaymentChoice booking={booking} />}
        </PaymentSummaryCard>
        {isManager && <BookingHistoryCard bookingId={bookingId} />}
      </div>

      <StayEditSheet booking={booking} open={editing === "stay"} onClose={closeSheet} />
      <GuestEditSheet booking={booking} open={editing === "guest"} onClose={closeSheet} />
      <NotesEditSheet booking={booking} open={editing === "notes"} onClose={closeSheet} />
    </div>
  );
}
