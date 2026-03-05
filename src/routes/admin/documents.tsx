import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireManager } from "@/lib/route-guards";

const DocumentGenerator = lazy(() =>
  import("@/components/documents/DocumentGenerator").then((m) => ({
    default: m.DocumentGenerator,
  }))
);

export const Route = createFileRoute("/admin/documents")({
  beforeLoad: async () => {
    await requireManager();
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <ErrorBoundary level="page">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        }
      >
        <DocumentGenerator />
      </Suspense>
    </ErrorBoundary>
  );
}
