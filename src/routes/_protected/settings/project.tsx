import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage";

export const Route = createFileRoute("/_protected/settings/project")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch project details
    await queryClient.prefetchQuery({
      queryKey: ["projects", "detail", projectId],
      queryFn: () => fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return null;
  },
  component: ProjectSettingsPage,
});
