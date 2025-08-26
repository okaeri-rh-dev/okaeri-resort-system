import { createFileRoute } from "@tanstack/react-router";
import { useProjectStore } from "@/stores/projectStore";
import { queryClient } from "@/lib/query-client";
import { ExpenseDetailPage } from "@/pages/ExpenseDetailPage";

export const Route = createFileRoute("/_protected/expenses/$expenseId")({
  loader: async ({ params }) => {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return null;

    // Prefetch expense details
    await queryClient.prefetchQuery({
      queryKey: ["expenses", "detail", projectId, params.expenseId],
      queryFn: () =>
        fetch(`/api/projects/${projectId}/expenses/${params.expenseId}`).then((r) => r.json()),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return null;
  },
  component: ExpenseDetailPage,
});
