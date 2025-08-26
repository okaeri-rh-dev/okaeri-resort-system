import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { BookingsPage } from "@/pages/BookingsPage";

export const Route = createFileRoute("/_protected/bookings")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch bookings list
    await queryClient.prefetchQuery({
      queryKey: ["bookings", "list", projectId],
      queryFn: () => fetch(`/api/projects/${projectId}/bookings`).then((r) => r.json()),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return null;
  },
  component: BookingsPage,
});
