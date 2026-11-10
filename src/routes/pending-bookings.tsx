import { createFileRoute, redirect } from "@tanstack/react-router";

// Kept for old links and bookmarks.
export const Route = createFileRoute("/pending-bookings")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bookings", search: { view: "needs-action" }, replace: true });
  },
});
