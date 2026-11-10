import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NEW_BOOKING_STEPS, NewBookingFlow } from "@/components/bookings/NewBookingFlow";

export const Route = createFileRoute("/admin/bookings/new")({
  validateSearch: z.object({ step: z.enum(NEW_BOOKING_STEPS).catch("stay").default("stay") }),
  component: NewBookingFlow,
});
