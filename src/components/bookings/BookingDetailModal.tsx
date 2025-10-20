import React from "react";

import { format } from "date-fns";
import { Calendar, CreditCard, Home, Mail, MessageSquare, Phone, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/validations";
import type { Booking } from "@/types";
import { formatBookingDate, utcToResortTime } from "@/utils/date-helpers";

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  open,
  onOpenChange,
}) => {
  if (!booking) return null;

  const getStatusColor = (status: string | undefined) => {
    const colors = {
      Pending: "bg-yellow-100 text-yellow-800",
      Confirmed: "bg-blue-100 text-blue-800",
      CheckedIn: "bg-green-100 text-green-800",
      CheckedOut: "bg-gray-100 text-gray-800",
      Cancelled: "bg-red-100 text-red-800",
      NoShow: "bg-orange-100 text-orange-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      Pending: "bg-yellow-100 text-yellow-800",
      Partial: "bg-orange-100 text-orange-800",
      Completed: "bg-green-100 text-green-800",
      Refunded: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Booking Details</span>
            <span className="text-muted-foreground text-sm font-normal">
              #{booking.booking_reference}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex gap-2">
            {booking.booking_status && (
              <Badge className={getStatusColor(booking.booking_status)}>
                {booking.booking_status.replace(/([A-Z])/g, " $1").trim()}
              </Badge>
            )}
            {booking.payment_status && (
              <Badge className={getPaymentStatusColor(booking.payment_status)}>
                Payment: {booking.payment_status}
              </Badge>
            )}
          </div>

          {/* Guest Information */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <User className="h-4 w-4" />
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{booking.guest_name}</p>
              </div>
              {booking.email && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="flex items-center gap-1 font-medium">
                    <Mail className="h-3 w-3" />
                    {booking.email}
                  </p>
                </div>
              )}
              {booking.contact_number && (
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="flex items-center gap-1 font-medium">
                    <Phone className="h-3 w-3" />
                    {booking.contact_number}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Number of Guests</p>
                <p className="font-medium">{booking.num_guests}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Booking Details */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Calendar className="h-4 w-4" />
              Stay Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Check-in</p>
                <p className="font-medium">{formatBookingDate(booking.check_in)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Check-out</p>
                <p className="font-medium">{formatBookingDate(booking.check_out)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cabin</p>
                <p className="flex items-center gap-1 font-medium">
                  <Home className="h-3 w-3" />
                  Cabin {booking.booking_units?.[0]?.unit_id}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Nights</p>
                <p className="font-medium">
                  {Math.ceil(
                    (utcToResortTime(booking.check_out).getTime() -
                      utcToResortTime(booking.check_in).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Information */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4" />
              Payment Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Amount</p>
                <p className="text-lg font-medium">{formatCurrency(booking.total_amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount Paid</p>
                <p className="text-lg font-medium">{formatCurrency(0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Balance</p>
                <p className="text-lg font-medium">{formatCurrency(booking.total_amount)}</p>
              </div>
              {booking.payment_method && (
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{booking.payment_method}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(booking.special_requests || booking.internal_notes) && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <MessageSquare className="h-4 w-4" />
                  Additional Information
                </h3>
                <div className="space-y-3 text-sm">
                  {booking.special_requests && (
                    <div>
                      <p className="text-muted-foreground mb-1">Special Requests</p>
                      <p className="bg-muted rounded-md p-3">{booking.special_requests}</p>
                    </div>
                  )}
                  {booking.internal_notes && (
                    <div>
                      <p className="text-muted-foreground mb-1">Internal Notes</p>
                      <p className="bg-muted rounded-md p-3">{booking.internal_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-muted-foreground text-xs">
            {booking.created_at && <p>Created: {format(new Date(booking.created_at), "PPpp")}</p>}
            {booking.updated_at && (
              <p>Last Updated: {format(new Date(booking.updated_at), "PPpp")}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
