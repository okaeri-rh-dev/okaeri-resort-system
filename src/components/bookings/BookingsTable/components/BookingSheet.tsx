import { lazy, Suspense, useEffect, useState } from "react";

import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { formatPhoneNumber, formatTableDate, RelatedEntityLink } from "@/components/entity-detail";
import {
  Button,
  DetailField,
  DetailSection,
  Dialog,
  DialogContent,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  StatusBadge,
} from "@/components/patterns";
import { paymentProofKind, usePaymentProofUrl } from "@/hooks/usePaymentProofUrl";
import { outstandingBalance } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { useAllBookings } from "@/stores/useBookingStore";
import type { Booking } from "@/types";

import type { BookingCardProps } from "../types";
import { BookingOverflowMenu } from "./BookingOverflowMenu";
import { CabinChip } from "./CabinChip";
import { MainActionButton } from "./MainActionButton";
import { NeedsActionLabel } from "./NeedsActionLabel";
import { SourceBadge } from "./SourceBadge";

// react-pdf is heavy, so it loads only when a proof opens
const PaymentProofView = lazy(() =>
  import("@/components/admin/PaymentProofView").then((m) => ({ default: m.PaymentProofView }))
);

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
      <SheetContent className="medium:max-w-md w-full overflow-y-auto">
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
  const balance = outstandingBalance(booking);

  return (
    <div className="space-y-6">
      <div className="space-y-1 pr-10">
        <SheetTitle className="font-display text-xl break-words">{booking.guest_name}</SheetTitle>
        {/* A div, since the badges are divs and a p cannot hold them */}
        <SheetDescription asChild className="flex flex-wrap items-center gap-2 tabular-nums">
          <div>
            {booking.booking_reference}
            <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
            <SourceBadge source={booking.booking_source} />
            <NeedsActionLabel booking={booking} />
          </div>
        </SheetDescription>
      </div>

      <div className="flex items-center gap-2">
        <MainActionButton
          booking={booking}
          updateBookingStatus={updateBookingStatus}
          onRecordPayment={() => onRecordPayment(booking)}
          className="flex-1"
        />
        <BookingOverflowMenu
          booking={booking}
          updateBookingStatus={updateBookingStatus}
          onRecordPayment={() => onRecordPayment(booking)}
          onCancel={() => onCancel(booking)}
        />
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link to="/admin/bookings/$bookingId" params={{ bookingId: booking.booking_id }}>
          Open full page
        </Link>
      </Button>

      <DetailSection title="Stay">
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="Check-in" value={formatTableDate(booking.check_in)} />
          <DetailField label="Check-out" value={formatTableDate(booking.check_out)} />
          <DetailField label="Guests" value={booking.num_guests} />
          <DetailField
            label="Cabins"
            value={
              <span className="flex flex-wrap gap-1">
                {(booking.booking_units ?? []).map((bu) => (
                  <CabinChip key={bu.booking_unit_id} bookingUnit={bu} />
                ))}
              </span>
            }
          />
        </div>
      </DetailSection>

      <DetailSection title="Guest">
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
        </div>
      </DetailSection>

      <DetailSection title="Payment">
        <div className="grid grid-cols-2 gap-4">
          <DetailField
            label="Total"
            value={formatCurrency(booking.total_amount)}
            emphasis="figure"
          />
          <DetailField
            label="Balance"
            value={balance > 0 ? `${formatCurrency(balance)} due` : "Paid"}
            emphasis="figure"
          />
          <DetailField
            label="Status"
            value={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
          />
          <DetailField label="Method" value={booking.payment_method || "Not specified"} />
        </div>
        {booking.payment_proof_url && <PaymentProofThumbnail path={booking.payment_proof_url} />}
      </DetailSection>
    </div>
  );
}

function PaymentProofThumbnail({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const { data: url, isError } = usePaymentProofUrl(path);
  const kind = paymentProofKind(path);

  if (isError)
    return <p className="text-muted-foreground mt-4 text-sm">Payment proof unavailable</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        aria-label="View payment proof"
        className="bg-muted focus-visible:ring-ring mt-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
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
          <Suspense fallback={null}>{url && <PaymentProofView url={url} kind={kind} />}</Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
