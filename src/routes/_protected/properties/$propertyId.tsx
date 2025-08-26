import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { PropertyDetailPage } from "@/pages/PropertyDetailPage";

export const Route = createFileRoute("/_protected/properties/$propertyId")({
  loader: async ({ params }) => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch property details
    await queryClient.prefetchQuery({
      queryKey: ["properties", "detail", projectId, params.propertyId],
      queryFn: () =>
        fetch(`/api/projects/${projectId}/properties/${params.propertyId}`).then((r) => r.json()),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });

    return null;
  },
  component: PropertyDetailPage,
});
