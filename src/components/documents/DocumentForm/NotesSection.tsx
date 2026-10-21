import type { UseFormReturn } from "react-hook-form";

import { FormField, Textarea } from "@/components/patterns";
import type { DocumentFormValues } from "@/lib/validation/document-schemas";

interface NotesSectionProps {
  form: UseFormReturn<DocumentFormValues>;
}

export function NotesSection({ form }: NotesSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-wide uppercase">Terms & Notes</h3>

      <div className="space-y-4">
        <FormField control={form.control} name="payment_terms" label="Payment Terms">
          {(field) => (
            <Textarea
              placeholder="Enter payment terms..."
              className="min-h-[80px] resize-y text-sm"
              {...field}
            />
          )}
        </FormField>

        <FormField control={form.control} name="cancellation_policy" label="Cancellation Policy">
          {(field) => (
            <Textarea
              placeholder="Enter cancellation policy..."
              className="min-h-[80px] resize-y text-sm"
              {...field}
            />
          )}
        </FormField>

        <FormField control={form.control} name="notes" label="Additional Notes">
          {(field) => (
            <Textarea
              placeholder="Any other notes to include..."
              className="min-h-[60px] resize-y text-sm"
              {...field}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
