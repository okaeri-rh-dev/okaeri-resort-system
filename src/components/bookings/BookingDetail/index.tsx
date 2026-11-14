import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { BookingActionBar } from "@/components/bookings/BookingSections/BookingActionBar";
import { BookingHeaderLine } from "@/components/bookings/BookingSections/BookingHeaderLine";
import {
  GuestCard,
  NotesCard,
  PaymentSummaryCard,
  StayCard,
} from "@/components/bookings/BookingSections/sections";
import { useBookingActions } from "@/components/bookings/BookingSections/useBookingActions";
import { DetailAuditSection } from "@/components/entity-detail";
import type { Booking } from "@/types";

interface BookingDetailPageProps {
  booking: Booking;
  bookingId: string;
}

export function BookingDetailPage({ booking, bookingId }: BookingDetailPageProps) {
  const { updateBookingStatus, cancelBooking, handleUploadPayment } = useBookingActions();

  return (
    // The bottom padding keeps the compact action bar off the last card
    <div data-testid="booking-detail" className="expanded:pb-0 space-y-6 pb-24">
      <header className="expanded:flex-row expanded:items-start expanded:justify-between flex flex-col gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            to="/admin/bookings"
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
          className="expanded:static expanded:w-72 expanded:shrink-0 expanded:border-0 expanded:bg-transparent expanded:p-0 expanded:shadow-none"
        />
      </header>

      <div className="expanded:grid-cols-2 grid grid-cols-1 items-start gap-4">
        <div className="space-y-4">
          <StayCard booking={booking} />
          <GuestCard booking={booking} />
          <NotesCard booking={booking} />
        </div>
        <PaymentSummaryCard booking={booking} />
      </div>

      <DetailAuditSection entityType="booking" entityId={bookingId} />
    </div>
  );
}
