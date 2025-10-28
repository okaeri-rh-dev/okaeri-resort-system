/**
 * Pending Bookings Queue Route
 *
 * Route: /pending-bookings
 * Displays pending multi-unit bookings queue
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

import { PendingBookingsQueue } from "@/components/admin/PendingBookingsQueue";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/pending-bookings")({
  component: AdminQueuePage,
  beforeLoad: async () => {
    // Authentication guard
    const session = await auth.getSession();

    if (!session) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/pending-bookings",
        },
      });
    }

    // Check admin role (adjust based on your auth implementation)
    const userRole = session.user?.user_metadata?.role || session.user?.app_metadata?.role;
    if (userRole !== "admin") {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
});

function AdminQueuePage() {
  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Booking Queue</h1>
        <p className="text-muted-foreground">Manage pending multi-unit booking requests</p>
      </div>

      <PendingBookingsQueue />
    </div>
  );
}
