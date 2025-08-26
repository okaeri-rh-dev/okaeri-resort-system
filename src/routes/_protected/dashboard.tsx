import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { DashboardPage } from "@/pages/DashboardPage";

export const Route = createFileRoute("/_protected/dashboard")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch dashboard data in parallel
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["dashboard", "stats", projectId],
        queryFn: () => fetch(`/api/projects/${projectId}/dashboard/stats`).then((r) => r.json()),
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),
      queryClient.prefetchQuery({
        queryKey: ["dashboard", "recent", projectId],
        queryFn: () => fetch(`/api/projects/${projectId}/dashboard/recent`).then((r) => r.json()),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),
    ]);

    return null;
  },
  component: DashboardPage,
});
