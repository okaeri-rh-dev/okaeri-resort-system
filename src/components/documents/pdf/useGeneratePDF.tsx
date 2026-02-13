import { useCallback } from "react";

import { toast } from "sonner";

import type { GeneratedDocument } from "@/components/documents/types";
import { useDocumentStore } from "@/stores/useDocumentStore";

export function useGeneratePDF() {
  const setIsGenerating = useDocumentStore((s) => s.setIsGenerating);

  const generate = useCallback(
    async (doc: GeneratedDocument) => {
      setIsGenerating(true);
      try {
        // Lazy import — only loads vendor-pdf chunk when user clicks "Download PDF"
        const { pdf } = await import("@react-pdf/renderer");
        const { QuotationPDF } = await import("./QuotationPDF");

        const blob = await pdf(<QuotationPDF document={doc} />).toBlob();

        // Trigger browser download
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = `${doc.metadata.document_number}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Failed to generate PDF. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [setIsGenerating]
  );

  return { generate };
}
