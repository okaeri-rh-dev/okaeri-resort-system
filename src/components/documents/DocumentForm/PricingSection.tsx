import type { UseFormReturn } from "react-hook-form";

import { FormField, Input } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import type { DocumentFormValues } from "@/lib/validation/document-schemas";

interface PricingSectionProps {
  form: UseFormReturn<DocumentFormValues>;
}

export function PricingSection({ form }: PricingSectionProps) {
  const subtotal = form.watch("pricing.subtotal") || 0;
  const discountAmount = form.watch("pricing.discount_amount") || 0;
  const vatRate = form.watch("pricing.vat_rate") ?? 0.12;
  const vatAmount = form.watch("pricing.vat_amount") || 0;
  const totalAmount = form.watch("pricing.total_amount") || 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-wide uppercase">Pricing</h3>

      <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
        </div>

        {/* Discount */}
        <div className="flex items-start gap-3">
          <FormField
            control={form.control}
            name="pricing.discount_label"
            label="Discount Label"
            className="flex-1"
          >
            {(field) => <Input placeholder="e.g. Early bird" className="h-8 text-sm" {...field} />}
          </FormField>
          <FormField
            control={form.control}
            name="pricing.discount_amount"
            label="Amount"
            className="w-32"
          >
            {(field) => (
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-right text-sm"
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          </FormField>
        </div>

        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Discount
              {form.watch("pricing.discount_label")
                ? ` (${form.watch("pricing.discount_label")})`
                : ""}
            </span>
            <span className="text-destructive tabular-nums">-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        {/* VAT */}
        <div className="flex items-end gap-3 border-t pt-3">
          <div className="flex h-8 flex-1 items-center">
            <span className="text-muted-foreground text-sm">
              VAT ({(vatRate * 100).toFixed(0)}%)
            </span>
          </div>
          <FormField control={form.control} name="pricing.vat_rate" label="Rate" className="w-20">
            {(field) => (
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                className="h-8 text-right text-sm"
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          </FormField>
          <span className="flex h-8 w-28 items-center justify-end text-sm tabular-nums">
            {formatCurrency(vatAmount)}
          </span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
