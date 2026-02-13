import { useCallback, useState } from "react";

import { Download, Eye, FileText, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentStore } from "@/stores/useDocumentStore";

import { DocumentForm } from "./DocumentForm";
import { DocumentPreview } from "./DocumentPreview";
import { LetterheadSettings } from "./LetterheadSettings";
import { useGeneratePDF } from "./pdf/useGeneratePDF";
import type { GeneratedDocument } from "./types";

export function DocumentGenerator() {
  const {
    letterhead,
    formData,
    isGenerating,
    setDocumentType,
    generateDocumentNumber,
    setFormData,
  } = useDocumentStore();

  const { generate } = useGeneratePDF();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    const docNumber = generateDocumentNumber(formData.document_type);
    const doc: GeneratedDocument = {
      metadata: {
        document_number: docNumber,
        document_type: formData.document_type,
        document_date: formData.document_date,
        valid_until: formData.valid_until,
      },
      letterhead,
      recipient: formData.recipient,
      line_items: formData.line_items,
      pricing: formData.pricing,
      notes: formData.notes,
      payment_terms: formData.payment_terms,
      cancellation_policy: formData.cancellation_policy,
    };
    await generate(doc);
  }, [formData, letterhead, generate, generateDocumentNumber]);

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText className="text-muted-foreground h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Document Generator</h1>
            <p className="text-muted-foreground text-sm">Create quotations and invoices</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Document type toggle */}
          <div className="flex gap-1">
            <Button
              variant={formData.document_type === "quotation" ? "default" : "outline"}
              size="sm"
              onClick={() => setDocumentType("quotation")}
              aria-pressed={formData.document_type === "quotation"}
            >
              Quotation
            </Button>
            <Button
              variant={formData.document_type === "invoice" ? "default" : "outline"}
              size="sm"
              onClick={() => setDocumentType("invoice")}
              aria-pressed={formData.document_type === "invoice"}
            >
              Invoice
            </Button>
          </div>

          {/* Date input */}
          <input
            type="date"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={formData.document_date}
            onChange={(e) => setFormData({ document_date: e.target.value })}
            aria-label="Document date"
          />

          {/* Settings */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSettingsOpen(true)}
            aria-label="Letterhead settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Download PDF — visible on tablet+ */}
          <Button
            className="hidden md:inline-flex"
            onClick={handleDownloadPDF}
            disabled={isGenerating || formData.line_items.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* ========== Desktop Layout (≥1024px): Side-by-side ========== */}
      <div className="hidden flex-1 gap-4 overflow-hidden lg:flex">
        {/* Left panel: Form */}
        <div className="w-[45%] overflow-y-auto rounded-lg border p-4">
          <DocumentForm />
        </div>
        {/* Right panel: Preview */}
        <div className="flex-1 overflow-hidden rounded-lg border">
          <DocumentPreview formData={formData} letterhead={letterhead} />
        </div>
      </div>

      {/* ========== Tablet Layout (768–1023px): Tabs ========== */}
      <div className="hidden flex-1 overflow-hidden md:block lg:hidden">
        <Tabs defaultValue="edit" className="flex h-full flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="edit" className="flex-1">
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">
              Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="flex-1 overflow-y-auto p-4">
            <DocumentForm />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <DocumentPreview formData={formData} letterhead={letterhead} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ========== Mobile Layout (<768px): Form + Preview Sheet ========== */}
      <div className="flex-1 overflow-y-auto md:hidden">
        <DocumentForm />
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="bg-background safe-area-bottom fixed right-0 bottom-0 left-0 z-40 flex items-center gap-2 border-t p-3 md:hidden">
        <Button
          variant="outline"
          className="min-h-[44px] flex-1"
          onClick={() => setMobilePreviewOpen(true)}
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button
          className="min-h-[44px] flex-1"
          onClick={handleDownloadPDF}
          disabled={isGenerating || formData.line_items.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      {/* Mobile Preview Sheet */}
      <Sheet open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Document Preview</SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-auto">
            <DocumentPreview formData={formData} letterhead={letterhead} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Letterhead Settings Dialog */}
      <LetterheadSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
