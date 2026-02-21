/**
 * Pending Bookings Queue Route
 *
 * Route: /admin/bookings/queue
 * Displays pending multi-unit bookings queue
 */

import { createFileRoute } from "@tanstack/react-router";

import { PendingBookingsQueue } from "@/components/admin/PendingBookingsQueue";
import { requireStaff } from "@/lib/route-guards";

export const Route = createFileRoute("/admin/bookings/queue")({
  beforeLoad: async () => {
    await requireStaff();
  },
  component: AdminQueuePage,
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
