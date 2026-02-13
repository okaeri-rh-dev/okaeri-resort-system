import { ChevronDown } from "lucide-react";
import { FormProvider } from "react-hook-form";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { useDocumentForm } from "./hooks/useDocumentForm";
import { LineItemsSection } from "./LineItemsSection";
import { NotesSection } from "./NotesSection";
import { PricingSection } from "./PricingSection";
import { RecipientSection } from "./RecipientSection";

interface DocumentFormProps {
  className?: string;
}

export function DocumentForm({ className }: DocumentFormProps) {
  const { form } = useDocumentForm();

  return (
    <FormProvider {...form}>
      <form className={cn("space-y-6", className)} onSubmit={(e) => e.preventDefault()}>
        {/* Recipient - collapsible after filling */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm font-semibold">
            <span>Recipient Details</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <RecipientSection form={form} />
          </CollapsibleContent>
        </Collapsible>

        {/* Line items - always visible */}
        <div className="rounded-lg border p-4">
          <LineItemsSection form={form} />
        </div>

        {/* Pricing */}
        <PricingSection form={form} />

        {/* Notes - collapsible */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm font-semibold">
            <span>Terms & Notes</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <NotesSection form={form} />
          </CollapsibleContent>
        </Collapsible>
      </form>
    </FormProvider>
  );
}
