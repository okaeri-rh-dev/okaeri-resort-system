import { createFileRoute, redirect } from "@tanstack/react-router";

// Editing moved to the booking page's sheets; old links land there
export const Route = createFileRoute("/admin/bookings/$bookingId/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/bookings/$bookingId", params, replace: true });
  },
});
