import { lazy, Suspense } from "react";

import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useSelectedBookings } from "@/components/bookings/BookingsTable/hooks/useSelectedBookings";
import { exportBookings } from "@/components/bookings/BookingsTable/utils/export";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActionMenu, Button, TableSkeleton, toast } from "@/components/patterns";
import { parseBookingsSearch } from "@/lib/bookings";
import { requireStaff } from "@/lib/route-guards";

// Lazy load heavy components
const BookingsTable = lazy(() =>
  import("@/components/bookings/BookingsTable").then((m) => ({ default: m.BookingsTable }))
);

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: parseBookingsSearch,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: BookingsPage,
});

function BookingsPageMenu() {
  const { bookings } = useSelectedBookings();
  return (
    <ActionMenu
      label="More booking actions"
      actions={[
        {
          label: "Export CSV",
          onClick: () => void exportBookings(bookings).catch(() => toast.error("Export failed")),
        },
      ]}
    />
  );
}

function BookingsPage() {
  const matches = useMatches();

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
            <BookingsPageMenu />
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
      </div>
    </ErrorBoundary>
  );
}
