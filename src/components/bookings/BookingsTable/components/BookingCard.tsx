import React, { useCallback } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ListCard, StatusBadge } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

import type { BookingCardProps } from "../types";
import { formatStayRange, getNights } from "../utils/stay";
import { BalanceLabel } from "./BalanceLabel";
import { BookingOverflowMenu } from "./BookingOverflowMenu";
import { CabinChip } from "./CabinChip";
import { MainActionButton } from "./MainActionButton";
import { NeedsActionLabel } from "./NeedsActionLabel";
import { SourceBadge } from "./SourceBadge";

const PAYMENT_DOT: Record<string, { color: string; label: string }> = {
  Completed: { color: "bg-success-foreground", label: "Paid" },
  Pending: { color: "bg-warning-foreground", label: "Pending" },
  Failed: { color: "bg-danger-foreground", label: "Failed" },
  Refunded: { color: "bg-danger-foreground", label: "Refunded" },
};

const PaymentDot: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const key = status ?? "Pending";
  const config = PAYMENT_DOT[key] ?? { color: "bg-muted-foreground", label: key };
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span className={cn("h-1.5 w-1.5 rounded-full", config.color)} aria-hidden />
      {config.label}
    </span>
  );
};

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onRecordPayment,
  onCancel,
  updateBookingStatus,
}) => {
  const navigate = useNavigate({ from: "/admin/bookings" });
  const units = booking.booking_units || [];
  const nights = getNights(booking.check_in, booking.check_out);

  const handleViewBooking = useCallback(() => {
    void navigate({
      to: "/admin/bookings",
      search: (prev) => ({ ...prev, booking: booking.booking_id }),
    });
  }, [navigate, booking.booking_id]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    // Clicks inside a dialog or menu portal bubble through React too, so check the DOM.
    if (!e.currentTarget.contains(target)) return;
    if (target.closest("a, button, [role=menuitem]")) return;
    handleViewBooking();
  };

  const handleInfoKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleViewBooking();
    }
  };

  return (
    <ListCard>
      {/* A tap anywhere outside the buttons opens the booking; the info zone is the keyboard target */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={handleCardClick} className="cursor-pointer space-y-2">
        {/* Header: identity (left) + status/menu (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-foreground text-base font-semibold">{booking.guest_name}</span>
              <SourceBadge source={booking.booking_source} />
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {booking.booking_reference}
            </div>
            <NeedsActionLabel booking={booking} />
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
            <BookingOverflowMenu
              booking={booking}
              updateBookingStatus={updateBookingStatus}
              onRecordPayment={onRecordPayment}
              onCancel={onCancel}
            />
          </div>
        </div>

        {/* Tappable info zone: dates + facts */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={handleInfoKeyDown}
          aria-label={`View booking ${booking.booking_reference}`}
          className="focus-visible:bg-muted active:bg-muted -mx-1 cursor-pointer space-y-1.5 rounded px-1 py-1 transition-colors focus-visible:outline-none"
        >
          {/* Facts strip: dates on the left, nights · guests pushed right */}
          <div className="text-muted-foreground flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 text-sm">
            <span className="text-foreground font-semibold">
              {formatStayRange(booking.check_in, booking.check_out)}
            </span>
            <div className="flex items-center gap-x-2">
              <span>
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
              <span aria-hidden>·</span>
              <span>
                {booking.num_guests} {booking.num_guests === 1 ? "guest" : "guests"}
              </span>
            </div>
          </div>

          {/* Units · amount · payment dot */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex flex-wrap gap-1">
              {units.map((bu) => (
                <CabinChip key={bu.booking_unit_id} bookingUnit={bu} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {formatCurrency(booking.total_amount)}
              </span>
              <BalanceLabel booking={booking} />
              <PaymentDot status={booking.payment_status} />
            </div>
          </div>
        </div>

        <MainActionButton
          booking={booking}
          updateBookingStatus={updateBookingStatus}
          onRecordPayment={onRecordPayment}
          className="w-full"
        />
      </div>
    </ListCard>
  );
};
