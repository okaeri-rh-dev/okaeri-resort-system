import { useCallback } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { guestKeys } from "@/lib/query-keys";
import { useBookings } from "@/stores/useBookingStore";

import { DesktopDashboard } from "./DesktopDashboard";
import { MobileDashboard } from "./MobileDashboard";

export function Dashboard() {
  const { data: bookings, isLoading, dataUpdatedAt, isFetching } = useBookings();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: guestKeys.all });
  }, [queryClient]);

  return (
    <>
      <div className="md:hidden">
        <MobileDashboard
          bookings={bookings}
          isLoading={isLoading}
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={refresh}
        />
      </div>
      <div className="hidden md:block">
        <DesktopDashboard
          bookings={bookings}
          isLoading={isLoading}
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}
