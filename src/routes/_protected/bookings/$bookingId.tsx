import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { BookingDetailPage } from "@/pages/BookingDetailPage";

export const Route = createFileRoute("/_protected/bookings/$bookingId")({
  loader: async ({ params }) => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch booking details
    await queryClient.prefetchQuery({
      queryKey: ["bookings", "detail", projectId, params.bookingId],
      queryFn: () =>
        fetch(`/api/projects/${projectId}/bookings/${params.bookingId}`).then((r) => r.json()),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return null;
  },
  component: BookingDetailPage,
});
