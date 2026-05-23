import React from "react";

import { Link } from "@tanstack/react-router";
import { Edit, Eye, Upload, X } from "lucide-react";

import { UNIT_SLOT_MAP } from "@/components/dashboard/unit-calendar-config";
import { formatCurrency, formatTableDate } from "@/components/tables/formatters";
import { MobileCard, StatusBadge } from "@/components/tables/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { BookingCardProps } from "../types";

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onUploadPayment, onCancel }) => {
  const units = booking.booking_units || [];

  return (
    <MobileCard className="space-y-3">
      {/* Row 1: Guest name + booking status */}
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
        <StatusBadge status={booking.booking_status ?? "Pending"} />
      </div>

      {/* Row 2: Dates emphasized */}
      <div className="rounded-md bg-neutral-50 px-3 py-2">
        <div className="text-sm font-semibold text-neutral-900">
          {formatTableDate(booking.check_in)} — {formatTableDate(booking.check_out)}
        </div>
        <div className="text-xs text-neutral-500">{booking.num_guests} guests</div>
      </div>

      {/* Row 3: Color-coded unit chips */}
      {units.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">Units</span>
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
        </div>
      )}

      {/* Row 4: Amount + payment status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">
          {formatCurrency(booking.total_amount)}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500">Payment:</span>
          <StatusBadge
            status={booking.payment_status ?? "Pending"}
            className="px-1.5 py-0 text-[10px]"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          to="/admin/bookings/$bookingId"
          params={{ bookingId: booking.booking_id }}
          className="flex-1"
        >
          <Button variant="outline" size="sm" className="w-full">
            <Eye className="mr-1 h-3 w-3" />
            View
          </Button>
        </Link>
        <Link
          to="/admin/bookings/$bookingId/edit"
          params={{ bookingId: booking.booking_id }}
          className="flex-1"
        >
          <Button variant="outline" size="sm" className="w-full">
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {booking.payment_status !== "Completed" && (
          <Button variant="outline" size="sm" onClick={onUploadPayment} className="flex-1">
            <Upload className="mr-1 h-3 w-3" />
            Payment
          </Button>
        )}
        {booking.booking_status !== "Cancelled" && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1 text-red-600 hover:text-red-700"
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        )}
      </div>
    </MobileCard>
  );
};
