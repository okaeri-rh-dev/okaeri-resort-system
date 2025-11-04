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

    // Phase 1: All authenticated users have admin access
    // Phase 2: TODO - Implement role-based access with hasRole('admin')
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
