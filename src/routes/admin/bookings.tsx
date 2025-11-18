import { lazy, Suspense, useState } from "react";

import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: bookingsSearchSchema,
  component: BookingsPage,
});

function BookingsPage() {
  const matches = useMatches();
  const [showBookingForm, setShowBookingForm] = useState(false);

  // Check if we're on a child route (not just the bookings list)
  // If there are more than 2 matches, we're on a child route
  // (root + admin + bookings = 3, child routes add more)
  const isChildRoute = matches.length > 3;

  // If we're on a child route, render the child outlet
  if (isChildRoute) {
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
              <Link to="/admin/bookings/new-multi">New Multi-Unit Booking</Link>
            </Button>
          </div>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <BookingsTable />
          </Suspense>
        </ErrorBoundary>

        {/* New Booking Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
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
