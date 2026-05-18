import { useBookings } from "@/stores/useBookingStore";

import { DesktopDashboard } from "./DesktopDashboard";
import { MobileDashboard } from "./MobileDashboard";

export function Dashboard() {
  const { data: bookings, isLoading } = useBookings();
  return (
    <>
      <div className="md:hidden">
        <MobileDashboard bookings={bookings} isLoading={isLoading} />
      </div>
      <div className="hidden md:block">
        <DesktopDashboard bookings={bookings} isLoading={isLoading} />
      </div>
    </>
  );
}
