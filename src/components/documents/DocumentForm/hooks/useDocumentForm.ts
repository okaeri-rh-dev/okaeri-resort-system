import { useEffect, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { DEFAULT_VAT_RATE, FORM_SYNC_DEBOUNCE_MS } from "@/components/documents/constants";
import { documentFormSchema, type DocumentFormValues } from "@/lib/validation/document-schemas";
import { useDocumentStore } from "@/stores/useDocumentStore";

export function useDocumentForm() {
  const { formData, setFormData } = useDocumentStore();

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: formData,
  });

  const lineItems = useWatch({ control: form.control, name: "line_items" });
  const discountAmount = useWatch({ control: form.control, name: "pricing.discount_amount" });
  const vatRate = useWatch({ control: form.control, name: "pricing.vat_rate" });

  // Debounced pricing recalculation
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (recalcTimeoutRef.current) {
      clearTimeout(recalcTimeoutRef.current);
    }

    recalcTimeoutRef.current = setTimeout(() => {
      if (!lineItems) return;

      const subtotal = lineItems.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
        0
      );
      const currentDiscount = discountAmount || 0;
      const currentVatRate = vatRate ?? DEFAULT_VAT_RATE;
      const taxableAmount = Math.max(0, subtotal - currentDiscount);
      const vatAmount = taxableAmount * currentVatRate;
      const totalAmount = taxableAmount + vatAmount;

      form.setValue("pricing.subtotal", subtotal, { shouldDirty: false });
      form.setValue("pricing.taxable_amount", taxableAmount, { shouldDirty: false });
      form.setValue("pricing.vat_amount", vatAmount, { shouldDirty: false });
      form.setValue("pricing.total_amount", totalAmount, { shouldDirty: false });
    }, FORM_SYNC_DEBOUNCE_MS);

    return () => {
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }
    };
  }, [lineItems, discountAmount, vatRate, form.setValue]);

  // Sync form changes to store (debounced)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        setFormData(values as DocumentFormValues);
      }, FORM_SYNC_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [form, setFormData]);

  return {
    form,
  };
}
