import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { z } from "zod";

// Lazy load heavy components
const BookingsTable = lazy(() =>
  import("@/components/bookings/BookingsTable").then((m) => ({ default: m.BookingsTable }))
);
const BookingForm = lazy(() =>
  import("@/components/bookings/BookingForm").then((m) => ({ default: m.BookingForm }))
);

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
  const params = useParams({ strict: false });
  const isDetailView = !!(params as any).bookingId;

  const [showBookingForm, setShowBookingForm] = useState(false);

  // If we're viewing a specific booking detail, render the child route
  if (isDetailView) {
    return (
      <ErrorBoundary level="page">
        <Outlet />
      </ErrorBoundary>
    );
  }

  // Otherwise, render the bookings table page
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
            <p className="text-muted-foreground">Manage all resort bookings and reservations</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowBookingForm(true)}>New Booking</Button>
            <Button asChild variant="outline">
              <Link to="/bookings/new-multi">New Multi-Unit Booking</Link>
            </Button>
          </div>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <BookingsTable />
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
      </div>
    </ErrorBoundary>
  );
}
