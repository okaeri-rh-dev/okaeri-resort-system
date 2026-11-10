import { lazy, Suspense, useState } from "react";

import { createFileRoute, Link, Outlet, useMatches, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useSelectedBookings } from "@/components/bookings/BookingsTable/hooks/useSelectedBookings";
import { exportBookings } from "@/components/bookings/BookingsTable/utils/export";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  ActionMenu,
  Button,
  Dialog,
  DialogContent,
  FormSkeleton,
  TableSkeleton,
  toast,
} from "@/components/patterns";
import { parseBookingsSearch } from "@/lib/bookings";
import { requireStaff } from "@/lib/route-guards";

// Lazy load heavy components
const BookingsTable = lazy(() =>
  import("@/components/bookings/BookingsTable").then((m) => ({ default: m.BookingsTable }))
);
const BookingForm = lazy(() =>
  import("@/components/bookings/BookingForm").then((m) => ({ default: m.BookingForm }))
);

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: parseBookingsSearch,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: BookingsPage,
});

// The old forms stay reachable here (Airbnb needs them) until #340 moves Airbnb into the new flow.
function BookingsPageMenu({ onOldSingleCabinForm }: { onOldSingleCabinForm: () => void }) {
  const { bookings } = useSelectedBookings();
  const navigate = useNavigate();
  return (
    <ActionMenu
      label="More booking actions"
      actions={[
        {
          label: "Export CSV",
          onClick: () => void exportBookings(bookings).catch(() => toast.error("Export failed")),
        },
        { label: "Old single-cabin form", onClick: onOldSingleCabinForm },
        {
          label: "Old multi-cabin form",
          onClick: () => void navigate({ to: "/admin/bookings/new-multi" }),
        },
      ]}
    />
  );
}

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
          <div className="flex items-center gap-2">
            <BookingsPageMenu onOldSingleCabinForm={() => setShowBookingForm(true)} />
            <Button asChild>
              <Link to="/admin/bookings/new" search={{ step: "stay" }}>
                <Plus aria-hidden="true" />
                New booking
              </Link>
            </Button>
          </div>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <TableSkeleton rows={8} columns={9} toolbar pagination label="Loading bookings" />
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
              <Suspense fallback={<FormSkeleton steps={4} label="Loading booking form" />}>
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
