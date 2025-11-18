/**
 * Calendar Route - Redirects to Homepage
 *
 * This route now redirects to the root (/) where the calendar is displayed.
 * Kept for backward compatibility with existing links and bookmarks.
 *
 * @route /calendar → /
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/calendar")({
  beforeLoad: () => {
    // Redirect to root where calendar is now displayed
    throw redirect({
      to: "/",
      replace: true, // Replace history entry to avoid back button issues
    });
  },
});
