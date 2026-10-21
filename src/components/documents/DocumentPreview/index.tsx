import { useState } from "react";

import { Minus, Plus } from "lucide-react";

import type { DocumentFormData, LetterheadConfig } from "@/components/documents/types";
import { Button } from "@/components/patterns";
import { cn } from "@/lib/utils";

import { DocumentPage } from "./DocumentPage";

interface DocumentPreviewProps {
  formData: DocumentFormData;
  letterhead: LetterheadConfig;
  documentNumber?: string;
  className?: string;
}

export function DocumentPreview({
  formData,
  letterhead,
  documentNumber,
  className,
}: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(0.85);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 1.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Zoom controls */}
      <div className="bg-muted/50 flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-muted-foreground text-xs">Preview</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-muted-foreground w-12 text-center text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Document area */}
      <div className="bg-muted flex-1 overflow-auto p-4">
        <div
          className="@container origin-top-left transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        >
          <DocumentPage
            formData={formData}
            letterhead={letterhead}
            documentNumber={documentNumber}
          />
        </div>
      </div>
    </div>
  );
}
