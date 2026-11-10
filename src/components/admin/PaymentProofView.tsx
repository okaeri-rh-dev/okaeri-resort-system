import { useState } from "react";

import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button, Callout } from "@/components/patterns";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

interface PaymentProofViewProps {
  url: string;
  kind: "pdf" | "image";
}

/** A payment proof at full size: a zoomable image, or a PDF with page controls. */
export function PaymentProofView({ url, kind }: PaymentProofViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState(false);

  if (kind === "image") {
    return (
      <TransformWrapper initialScale={1} minScale={0.5} maxScale={3} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => zoomIn()} size="sm" variant="outline">
                <ZoomIn className="h-4 w-4" />
                Zoom In
              </Button>
              <Button onClick={() => zoomOut()} size="sm" variant="outline">
                <ZoomOut className="h-4 w-4" />
                Zoom Out
              </Button>
              <Button onClick={() => resetTransform()} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            <div className="bg-muted overflow-hidden rounded-lg border">
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "min(600px, 70dvh)" }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={url}
                  alt="Payment proof"
                  width={800}
                  height={600}
                  className="max-h-full max-w-full object-contain"
                />
              </TransformComponent>
            </div>
          </div>
        )}
      </TransformWrapper>
    );
  }

  if (pdfError) return <Callout tone="danger">Failed to load PDF. Please try again.</Callout>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage <= 1}
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          Page {currentPage} of {numPages || "?"}
        </span>
        <Button
          onClick={() => setCurrentPage((prev) => Math.min(numPages || prev, prev + 1))}
          disabled={currentPage >= (numPages || 1)}
          size="sm"
          variant="outline"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="bg-muted overflow-auto rounded-lg border">
        <div className="flex justify-center p-4">
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setCurrentPage(1);
            }}
            onLoadError={(error) => {
              console.error("PDF load error:", error);
              setPdfError(true);
            }}
          >
            <Page pageNumber={currentPage} width={800} />
          </Document>
        </div>
      </div>
    </div>
  );
}
