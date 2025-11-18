/**
 * Legacy Pending Bookings Route - Redirects to /admin/bookings/queue
 *
 * Kept for backward compatibility with existing links and bookmarks.
 *
 * @route /pending-bookings → /admin/bookings/queue
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pending-bookings")({
  beforeLoad: () => {
    // Redirect to new admin queue location
    throw redirect({
      to: "/admin/bookings/queue",
      replace: true,
    });
  },
});
