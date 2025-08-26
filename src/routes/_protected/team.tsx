import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { TeamPage } from "@/pages/TeamPage";

export const Route = createFileRoute("/_protected/team")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch team members
    await queryClient.prefetchQuery({
      queryKey: ["projects", "members", projectId],
      queryFn: () => fetch(`/api/projects/${projectId}/members`).then((r) => r.json()),
      staleTime: 10 * 60 * 1000, // 10 minutes (team changes less frequently)
    });

    return null;
  },
  component: TeamPage,
});
