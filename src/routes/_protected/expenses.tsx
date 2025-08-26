import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { ExpensesPage } from "@/pages/ExpensesPage";

export const Route = createFileRoute("/_protected/expenses")({
  loader: async () => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch expenses list
    await queryClient.prefetchQuery({
      queryKey: ["expenses", "list", projectId],
      queryFn: () => fetch(`/api/projects/${projectId}/expenses`).then((r) => r.json()),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return null;
  },
  component: ExpensesPage,
});
