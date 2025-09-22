import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookingsTable } from "@/components/bookings/BookingsTable";
import { BookingForm } from "@/components/bookings/BookingForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";
import type { Booking } from "@/types";

const bookingsSearchSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/bookings")({
  validateSearch: bookingsSearchSchema,
  component: BookingsPage,
});

function BookingsPage() {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setShowEditDialog(true);
  };

  const handleViewBooking = (booking: Booking) => {
    // Future: Could open a read-only view dialog
    console.log("View booking:", booking);
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
            <p className="text-muted-foreground">Manage all resort bookings and reservations</p>
          </div>
          <Button onClick={() => setShowBookingForm(true)}>New Booking</Button>
        </div>

        <ErrorBoundary level="component">
          <BookingsTable onViewBooking={handleViewBooking} onEditBooking={handleEditBooking} />
        </ErrorBoundary>

        {/* New Booking Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <BookingForm onSuccess={() => setShowBookingForm(false)} />
            </ErrorBoundary>
          </DialogContent>
        </Dialog>

        {/* Edit Booking Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Booking</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              {editingBooking && (
                <BookingForm
                  bookingId={editingBooking.booking_id}
                  initialData={{
                    guest_name: editingBooking.guest_name,
                    guest_email: editingBooking.guest_email,
                    contact_number: editingBooking.guest_phone || "",
                    check_in: editingBooking.check_in_date,
                    check_out: editingBooking.check_out_date,
                    unit_id: editingBooking.unit_id,
                    number_of_guests: editingBooking.number_of_guests,
                    payment_method: editingBooking.payment_method,
                    special_requests: editingBooking.special_requests || "",
                  }}
                  onSuccess={() => {
                    setShowEditDialog(false);
                    setEditingBooking(null);
                  }}
                />
              )}
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
