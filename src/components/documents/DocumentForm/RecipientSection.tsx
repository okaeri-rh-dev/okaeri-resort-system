import type { UseFormReturn } from "react-hook-form";

import { FormField, Input } from "@/components/patterns";
import { PH_MOBILE_PLACEHOLDER } from "@/lib/contact-channel";
import type { DocumentFormValues } from "@/lib/validation/document-schemas";

interface RecipientSectionProps {
  form: UseFormReturn<DocumentFormValues>;
}

export function RecipientSection({ form }: RecipientSectionProps) {
  return (
    <div className="@container space-y-4">
      <h3 className="text-sm font-semibold tracking-wide uppercase">Recipient</h3>

      <div className="grid gap-4 @md:grid-cols-2">
        <FormField
          control={form.control}
          name="recipient.name"
          label="Name *"
          className="@md:col-span-2"
        >
          {(field) => <Input placeholder="Guest or company name" {...field} />}
        </FormField>

        <FormField control={form.control} name="recipient.email" label="Email">
          {(field) => <Input type="email" placeholder="email@example.com" {...field} />}
        </FormField>

        <FormField control={form.control} name="recipient.phone" label="Phone">
          {(field) => <Input placeholder={PH_MOBILE_PLACEHOLDER} {...field} />}
        </FormField>

        <FormField
          control={form.control}
          name="recipient.address"
          label="Address"
          className="@md:col-span-2"
        >
          {(field) => <Input placeholder="Street, City, Province" {...field} />}
        </FormField>

        <FormField control={form.control} name="recipient.company_name" label="Company">
          {(field) => <Input placeholder="Company name" {...field} />}
        </FormField>

        <FormField control={form.control} name="recipient.tin" label="TIN">
          {(field) => <Input placeholder="000-000-000-000" {...field} />}
        </FormField>
      </div>
    </div>
  );
}
