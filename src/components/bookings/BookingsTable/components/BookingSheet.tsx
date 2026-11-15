import { useEffect, useState, type MouseEvent } from "react";

import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FileText, Maximize2 } from "lucide-react";

import { LazyPaymentProofView } from "@/components/admin/LazyPaymentProofView";
import { BookingActionBar } from "@/components/bookings/BookingSections/BookingActionBar";
import { BookingHeaderLine } from "@/components/bookings/BookingSections/BookingHeaderLine";
import {
  GuestCard,
  NotesCard,
  PaymentSummaryCard,
  StayCard,
} from "@/components/bookings/BookingSections/sections";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/patterns";
import { useAllBookings } from "@/hooks/useBookings";
import { paymentProofKind, usePaymentProofUrl } from "@/hooks/usePaymentProofUrl";
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
        {booking.booking_status === "Pending" && booking.payment_method && (
          <p className="text-muted-foreground text-sm">Guest chose {booking.payment_method}</p>
        )}
        {booking.payment_proof_url && <PaymentProofThumbnail path={booking.payment_proof_url} />}
      </PaymentSummaryCard>
      {hasNotes && <NotesCard booking={booking} />}
    </div>
  );
}

function PaymentProofThumbnail({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const { data: url, isError } = usePaymentProofUrl(path);
  const kind = paymentProofKind(path);

  if (isError) return <p className="text-muted-foreground text-sm">Payment proof unavailable</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        aria-label="View payment proof"
        className="bg-muted focus-visible:ring-ring flex h-32 w-full items-center justify-center overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
      >
        {url && kind === "image" ? (
          <img src={url} alt="" width={448} height={128} className="h-full w-full object-cover" />
        ) : (
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" aria-hidden />
            Payment proof (PDF)
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90dvh] max-w-4xl overflow-y-auto"
          aria-describedby={undefined}
        >
          <DialogTitle>Payment proof</DialogTitle>
          {url && <LazyPaymentProofView url={url} kind={kind} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
