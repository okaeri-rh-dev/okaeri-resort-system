import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { PropertiesPage } from "@/pages/PropertiesPage";

export const Route = createFileRoute("/_protected/properties")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch properties list
    await queryClient.prefetchQuery({
      queryKey: ["properties", "list", projectId],
      queryFn: () => fetch(`/api/projects/${projectId}/properties`).then((r) => r.json()),
      staleTime: 10 * 60 * 1000, // 10 minutes (properties change less frequently)
    });

    return null;
  },
  component: PropertiesPage,
});
