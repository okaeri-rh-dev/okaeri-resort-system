/**
 * Multi-Unit Booking Creation Route
 *
 * Provides the interface for creating multi-unit bookings with:
 * - 4-step wizard workflow
 * - Real-time availability checking
 * - Optimistic UI updates
 * - Form validation
 *
 * @module NewMultiUnitBookingRoute
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MultiUnitBookingForm } from "@/components/bookings/MultiUnitBookingForm";

export const Route = createFileRoute("/_authenticated/bookings-new-multi")({
  component: MultiUnitBookingPage,
});

function MultiUnitBookingPage() {
  const navigate = useNavigate();

  const handleSuccess = (bookingId: string) => {
    navigate({ to: "/bookings/$bookingId", params: { bookingId } });
  };

  const handleCancel = () => {
    navigate({ to: "/bookings" });
  };

  return (
    <div className="container mx-auto py-8">
      <MultiUnitBookingForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
