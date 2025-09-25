import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, lazy, Suspense } from "react";

// Lazy load heavy components
const BookingsTable = lazy(() =>
  import("@/components/bookings/BookingsTable").then((m) => ({ default: m.BookingsTable }))
);
const BookingForm = lazy(() =>
  import("@/components/bookings/BookingForm").then((m) => ({ default: m.BookingForm }))
);
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";
import type { Booking, PaymentMethod } from "@/types";

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

  // Memoize initial data for edit form to prevent re-initialization
  const editFormInitialData = useMemo(() => {
    if (!editingBooking) return null;

    return {
      guest_name: editingBooking.guest_name,
      email: editingBooking.email,
      contact_number: editingBooking.contact_number || "",
      check_in: new Date(editingBooking.check_in),
      check_out: new Date(editingBooking.check_out),
      unit_id: editingBooking.unit_id,
      num_guests: editingBooking.num_guests,
      payment_method: (editingBooking.payment_method as PaymentMethod) || undefined,
      special_requests: editingBooking.special_requests || "",
    };
  }, [editingBooking]);

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
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <BookingsTable onViewBooking={handleViewBooking} onEditBooking={handleEditBooking} />
          </Suspense>
        </ErrorBoundary>

        {/* New Booking Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                }
              >
                <BookingForm
                  onSuccess={() => setShowBookingForm(false)}
                  onCancel={() => setShowBookingForm(false)}
                />
              </Suspense>
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
              {editingBooking && editFormInitialData && (
                <BookingForm
                  bookingId={editingBooking.booking_id}
                  initialData={editFormInitialData}
                  onSuccess={() => {
                    setShowEditDialog(false);
                    setEditingBooking(null);
                  }}
                  onCancel={() => {
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
