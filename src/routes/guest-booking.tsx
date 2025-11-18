/**
 * Legacy Guest Booking Route - Redirects to /booking
 *
 * Kept for backward compatibility with existing links and bookmarks.
 *
 * @route /guest-booking → /booking
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/guest-booking")({
  beforeLoad: () => {
    // Redirect to new booking location
    throw redirect({
      to: "/booking",
      replace: true,
    });
  },
});
