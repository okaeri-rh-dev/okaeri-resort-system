import React from "react";
import { Eye, Edit, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatTableDate,
  StatusBadge,
  MobileCard,
  MobileCardRow,
} from "@/components/tables/utils";
import type { BookingCardProps } from "../types";

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onView,
  onEdit,
  onUploadPayment,
  onCancel,
}) => {
  return (
    <MobileCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="font-mono text-sm font-medium text-blue-600">
            {booking.booking_reference}
          </div>
          <div className="font-medium text-neutral-900">{booking.guest_name}</div>
        </div>
        <div className="flex space-x-1">
          <StatusBadge status={booking.booking_status ?? "Pending"} />
          <StatusBadge status={booking.payment_status ?? "Pending"} />
        </div>
      </div>

      <div className="space-y-2">
        <MobileCardRow label="Unit" value={booking.unit?.unit_name || "N/A"} />
        <MobileCardRow
          label="Dates"
          value={`${formatTableDate(booking.check_in)} - ${formatTableDate(booking.check_out)}`}
        />
        <MobileCardRow label="Guests" value={`${booking.num_guests} guest(s)`} />
        <MobileCardRow label="Amount" value={formatCurrency(booking.total_amount)} />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Edit className="mr-1 h-3 w-3" />
          Edit
        </Button>
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
