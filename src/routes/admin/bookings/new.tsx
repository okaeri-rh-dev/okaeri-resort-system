import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NewBookingFlow } from "@/components/bookings/NewBookingFlow";
import { NEW_BOOKING_STEPS } from "@/components/bookings/NewBookingFlow/draft";

export const Route = createFileRoute("/admin/bookings/new")({
  validateSearch: z.object({ step: z.enum(NEW_BOOKING_STEPS).catch("stay").default("stay") }),
  component: NewBookingFlow,
});
