import { lazy, Suspense, useState } from "react";

import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { Building2, ChevronDown, Plus, Users } from "lucide-react";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/patterns";
import { requireStaff } from "@/lib/route-guards";

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
  beforeLoad: async () => {
    await requireStaff();
  },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Booking
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={() => setShowBookingForm(true)}
                className="flex cursor-pointer flex-col items-start gap-1 p-3"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Single Cabin Booking</span>
                </div>
                <span className="text-muted-foreground ml-6 text-xs">
                  Book one cabin for a guest
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer p-0">
                <Link
                  to="/admin/bookings/new-multi"
                  className="flex flex-col items-start gap-1 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Multi-Cabin Booking</span>
                  </div>
                  <span className="text-muted-foreground ml-6 text-xs">
                    Book multiple cabins for groups or events
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
              </div>
            }
          >
            <BookingsTable />
          </Suspense>
        </ErrorBoundary>

        {/* New Booking Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            {/* DialogHeader removed - BookingForm has its own step-based header */}
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
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
