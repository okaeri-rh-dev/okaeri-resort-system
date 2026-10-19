import React, { useCallback, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, Upload } from "lucide-react";

import { UNIT_SLOT_MAP } from "@/components/dashboard/unit-calendar-config";
import { ActionMenu, ListCard, StatusBadge } from "@/components/patterns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks";
import { canTransitionStatus } from "@/lib/bookings";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";
import { utcToResortTime } from "@/utils/date-helpers";

import type { BookingCardProps } from "../types";

const formatStayRange = (checkIn: string, checkOut: string): string => {
  try {
    const inDate = utcToResortTime(checkIn);
    const outDate = utcToResortTime(checkOut);
    const sameMonth =
      inDate.getFullYear() === outDate.getFullYear() && inDate.getMonth() === outDate.getMonth();
    return sameMonth
      ? `${format(inDate, "MMM d")} → ${format(outDate, "d")}`
      : `${format(inDate, "MMM d")} → ${format(outDate, "MMM d")}`;
  } catch {
    return "Invalid Date";
  }
};

const getNights = (checkIn: string, checkOut: string): number => {
  try {
    const inDate = utcToResortTime(checkIn);
    const outDate = utcToResortTime(checkOut);
    const ms = outDate.getTime() - inDate.getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  } catch {
    return 0;
  }
};

const PAYMENT_DOT: Record<string, { color: string; label: string }> = {
  Completed: { color: "bg-emerald-500", label: "Paid" },
  Pending: { color: "bg-amber-500", label: "Pending" },
  Failed: { color: "bg-red-500", label: "Failed" },
  Refunded: { color: "bg-red-500", label: "Refunded" },
};

const PaymentDot: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const key = status ?? "Pending";
  const config = PAYMENT_DOT[key] ?? { color: "bg-neutral-400", label: key };
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-600">
      <span className={cn("h-1.5 w-1.5 rounded-full", config.color)} aria-hidden />
      {config.label}
    </span>
  );
};

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onUploadPayment,
  onCancel,
  updateBookingStatus,
}) => {
  const navigate = useNavigate();
  const { canEdit, canConfirmBookings } = useUserRole();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const units = booking.booking_units || [];
  const nights = getNights(booking.check_in, booking.check_out);

  const handleViewBooking = useCallback(() => {
    navigate({
      to: "/admin/bookings/$bookingId",
      params: { bookingId: booking.booking_id },
    });
  }, [navigate, booking.booking_id]);

  const handleEdit = useCallback(() => {
    navigate({
      to: "/admin/bookings/$bookingId/edit",
      params: { bookingId: booking.booking_id },
    });
  }, [navigate, booking.booking_id]);

  const handleConfirm = useCallback(() => {
    updateBookingStatus.mutate({
      bookingId: booking.booking_id,
      status: "Confirmed" as BookingStatus,
    });
  }, [updateBookingStatus, booking.booking_id]);

  const confirmCancel = useCallback(() => {
    onCancel();
    setShowCancelDialog(false);
  }, [onCancel]);

  const isPending = booking.booking_status === "Pending";
  const isCancelled = booking.booking_status === "Cancelled";
  const paymentIncomplete = booking.payment_status !== "Completed";

  const showConfirmPrimary = canConfirmBookings && isPending;
  const showPaymentPrimary = !showConfirmPrimary && !isCancelled && paymentIncomplete;
  const showActionZone = showConfirmPrimary || showPaymentPrimary;

  const menuActions = [
    ...(canEdit ? [{ label: "Edit Booking", onClick: handleEdit }] : []),
    ...(paymentIncomplete && !isCancelled
      ? [{ label: "Upload Payment", onClick: onUploadPayment }]
      : []),
    ...(canConfirmBookings && isPending ? [{ label: "Confirm", onClick: handleConfirm }] : []),
    ...(canEdit && canTransitionStatus(booking.booking_status as BookingStatus, "Cancelled")
      ? [
          {
            label: "Cancel",
            onClick: () => setShowCancelDialog(true),
            variant: "destructive" as const,
          },
        ]
      : []),
  ];

  const handleInfoKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleViewBooking();
    }
  };

  return (
    <>
      <ListCard className="space-y-2">
        {/* Header: identity (left) + status/menu (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-semibold text-neutral-900">{booking.guest_name}</span>
              {booking.is_walk_in && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-800"
                >
                  Walk-in
                </Badge>
              )}
            </div>
            <div className="font-mono text-xs text-neutral-400">{booking.booking_reference}</div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
            {menuActions.length > 0 && <ActionMenu actions={menuActions} />}
          </div>
        </div>

        {/* Tappable info zone: dates + facts */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleViewBooking}
          onKeyDown={handleInfoKeyDown}
          aria-label={`View booking ${booking.booking_reference}`}
          className="-mx-1 cursor-pointer space-y-1.5 rounded px-1 py-1 transition-colors focus-visible:bg-neutral-50 focus-visible:outline-none active:bg-neutral-100"
        >
          {/* Facts strip: dates on the left, nights · guests pushed right */}
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">
              {formatStayRange(booking.check_in, booking.check_out)}
            </span>
            <div className="flex items-center gap-x-2">
              <span>
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
              <span className="text-neutral-300" aria-hidden>
                ·
              </span>
              <span>
                {booking.num_guests} {booking.num_guests === 1 ? "guest" : "guests"}
              </span>
            </div>
          </div>

          {/* Units · amount · payment dot */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex flex-wrap gap-1">
              {units.map((bu) => {
                const unitCode = bu.unit?.unit_code;
                const slotConfig = unitCode ? UNIT_SLOT_MAP.get(unitCode) : undefined;
                return (
                  <Badge
                    key={bu.booking_unit_id}
                    variant="outline"
                    className={cn(
                      "font-mono text-xs",
                      slotConfig
                        ? cn(slotConfig.bg, slotConfig.text, slotConfig.border)
                        : "bg-secondary text-secondary-foreground border-transparent"
                    )}
                  >
                    {unitCode || bu.unit?.unit_name || `Unit ${bu.unit_id.slice(0, 4)}`}
                  </Badge>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-neutral-900">
                {formatCurrency(booking.total_amount)}
              </span>
              <PaymentDot status={booking.payment_status} />
            </div>
          </div>
        </div>

        {/* Action zone: status-dependent primary button */}
        {showActionZone && (
          <div className="pt-1">
            {showConfirmPrimary ? (
              <Button onClick={handleConfirm} size="sm" className="w-full">
                <Check className="mr-1.5 h-4 w-4" />
                Confirm
              </Button>
            ) : (
              <Button onClick={onUploadPayment} variant="outline" size="sm" className="w-full">
                <Upload className="mr-1.5 h-4 w-4" />
                Upload Payment
              </Button>
            )}
          </div>
        )}
      </ListCard>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking</AlertDialogTitle>
            <AlertDialogDescription>
              {booking.booking_reference} will be cancelled and its unit freed for these days. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700">
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
