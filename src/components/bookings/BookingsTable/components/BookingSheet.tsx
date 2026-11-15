import { useEffect, type MouseEvent } from "react";

import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Maximize2 } from "lucide-react";

import { BookingActionBar } from "@/components/bookings/BookingSections/BookingActionBar";
import { BookingHeaderLine } from "@/components/bookings/BookingSections/BookingHeaderLine";
import { GuestPaymentChoice } from "@/components/bookings/BookingSections/PaymentRows";
import {
  GuestCard,
  NotesCard,
  PaymentSummaryCard,
  StayCard,
} from "@/components/bookings/BookingSections/sections";
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/patterns";
import { useAllBookings } from "@/hooks/useBookings";
import { isPlainClick } from "@/lib/utils";
import type { Booking } from "@/types";

import type { BookingCardProps } from "../types";

interface BookingActions {
  updateBookingStatus: BookingCardProps["updateBookingStatus"];
  onRecordPayment: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}

/** The booking in `?booking=<id>`: a right-side sheet over the list, full screen on a phone. */
export function BookingSheet(actions: BookingActions) {
  const { booking: bookingId } = useSearch({ from: "/admin/bookings" });
  const navigate = useNavigate({ from: "/admin/bookings" });
  const { data: bookings, isFetching, isStale } = useAllBookings();
  const booking = bookings?.find((b) => b.booking_id === bookingId);

  const close = () =>
    void navigate({ search: (prev) => ({ ...prev, booking: undefined }), replace: true });

  // An unknown id drops out of the URL with no error; a just-saved booking left the list
  // invalidated (stale), so its id waits for the refetch that brings it
  const isUnknown = !!bookingId && !isFetching && !isStale && !booking;
  useEffect(() => {
    if (isUnknown) close();
  }, [isUnknown]);

  return (
    <Sheet open={!!booking} onOpenChange={(open) => !open && close()}>
      {/* The scroll padding keeps a focused element clear of the phone's sticky action bar */}
      <SheetContent className="medium:max-w-md expanded:scroll-pb-0 w-full scroll-pb-20 overflow-y-auto">
        {booking && <BookingSheetBody booking={booking} {...actions} />}
      </SheetContent>
    </Sheet>
  );
}

function BookingSheetBody({
  booking,
  updateBookingStatus,
  onRecordPayment,
  onCancel,
}: BookingActions & { booking: Booking }) {
  const navigate = useNavigate({ from: "/admin/bookings" });

  // The list entry loses its ?booking first, so back from the page returns to the list, not the sheet
  const openFullPage = async (event: MouseEvent<HTMLElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    await navigate({ search: (prev) => ({ ...prev, booking: undefined }), replace: true });
    await navigate({
      to: "/admin/bookings/$bookingId",
      params: { bookingId: booking.booking_id },
      state: { fromBookingsList: true },
    });
  };

  const hasNotes = !!(booking.special_requests || booking.internal_notes);

  return (
    <div className="flex flex-col gap-4">
      <Button
        asChild
        variant="ghost"
        onClick={openFullPage}
        className="expanded:w-auto expanded:px-3 absolute top-0.5 right-12 h-11 w-11 p-0"
      >
        <Link
          to="/admin/bookings/$bookingId"
          params={{ bookingId: booking.booking_id }}
          aria-label="Open full page"
        >
          <Maximize2 className="size-4" aria-hidden />
          <span className="expanded:inline hidden">Full page</span>
        </Link>
      </Button>

      <div className="expanded:pr-36 space-y-1 pr-24">
        <SheetTitle className="font-display text-xl break-words">{booking.guest_name}</SheetTitle>
        {/* A div, since the header line is a div and a p cannot hold it */}
        <SheetDescription asChild>
          <div>
            <BookingHeaderLine booking={booking} />
          </div>
        </SheetDescription>
      </div>

      <BookingActionBar
        booking={booking}
        updateBookingStatus={updateBookingStatus}
        onRecordPayment={() => onRecordPayment(booking)}
        onCancel={() => onCancel(booking)}
        placement="sheet"
      />

      <StayCard booking={booking} />
      <GuestCard booking={booking} />
      <PaymentSummaryCard booking={booking}>
        <GuestPaymentChoice booking={booking} />
      </PaymentSummaryCard>
      {hasNotes && <NotesCard booking={booking} />}
    </div>
  );
}
