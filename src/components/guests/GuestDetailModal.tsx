import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/validations";
import { User, Mail, Phone, Calendar, Hash } from "lucide-react";
import { format } from "date-fns";
import type { Guest } from "@/types";

interface GuestDetailModalProps {
  guest: Guest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GuestDetailModal: React.FC<GuestDetailModalProps> = ({
  guest,
  open,
  onOpenChange,
}) => {
  if (!guest) return null;

  const isVIP = guest.total_spent && guest.total_spent > 10000;
  const isRepeatGuest = guest.total_bookings && guest.total_bookings > 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Guest Profile</span>
            <div className="flex gap-2">
              {isVIP && <Badge className="bg-purple-100 text-purple-800">VIP</Badge>}
              {isRepeatGuest && <Badge className="bg-blue-100 text-blue-800">Repeat Guest</Badge>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Full Name</p>
                <p className="font-medium text-lg">{guest.guest_name}</p>
              </div>
              {/* Nationality field not in current schema */}
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="font-semibold mb-3">Contact Details</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              {guest.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{guest.email}</p>
                  </div>
                </div>
              )}
              {guest.phone_number && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium">{guest.phone_number}</p>
                  </div>
                </div>
              )}
              {/* Address field not in current schema */}
            </div>
          </div>

          <Separator />

          {/* Booking Statistics */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Booking History
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Bookings</p>
                <p className="font-medium text-xl">{guest.total_bookings || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Spent</p>
                <p className="font-medium text-xl">{formatCurrency(guest.total_spent || 0)}</p>
              </div>
              {/* First/Last visit dates not in current schema */}
            </div>

            {/* Average metrics */}
            {guest.total_bookings && guest.total_bookings > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground mb-1">Average Spending per Visit</p>
                <p className="font-medium">
                  {formatCurrency((guest.total_spent || 0) / guest.total_bookings)}
                </p>
              </div>
            )}
          </div>

          {/* Preferences & Notes fields not in current schema */}

          {/* Recent Bookings - not in current schema */}
          {false && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Recent Bookings</h3>
                <div className="space-y-2">
                  {[].slice(0, 3).map((booking: any, index: number) => (
                    <div key={index} className="p-3 border rounded-md">
                      <div className="flex justify-between items-start text-sm">
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            <Hash className="h-3 w-3" />
                            {booking.reference}
                          </p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {format(new Date(booking.check_in), "PP")} -
                            {format(new Date(booking.check_out), "PP")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {booking.status}
                          </Badge>
                          <p className="text-sm font-medium mt-1">
                            {formatCurrency(booking.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-xs text-muted-foreground">
            <p>Guest ID: {guest.guest_id}</p>
            {guest.created_at && <p>Created: {format(new Date(guest.created_at), "PPpp")}</p>}
            {guest.updated_at && <p>Last Updated: {format(new Date(guest.updated_at), "PPpp")}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
