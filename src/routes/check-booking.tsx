/**
 * Legacy Check Booking Route - Redirects to /booking/check-status
 *
 * Kept for backward compatibility with existing links and bookmarks.
 *
 * @route /check-booking → /booking/check-status
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/check-booking")({
  beforeLoad: () => {
    // Redirect to new check status location
    throw redirect({
      to: "/booking/check-status",
      replace: true,
    });
  },
});
