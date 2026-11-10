import { createFileRoute, redirect } from "@tanstack/react-router";

// The Booking Queue page was removed (#337); old links land on the Needs action view.
export const Route = createFileRoute("/admin/bookings/queue")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bookings", search: { view: "needs-action" }, replace: true });
  },
});
