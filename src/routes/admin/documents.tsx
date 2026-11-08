import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/patterns";
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
      <Suspense fallback={<PageLoader />}>
        <DocumentGenerator />
      </Suspense>
    </ErrorBoundary>
  );
}
