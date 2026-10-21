import { memo } from "react";

import { DOCUMENT_PREFIX_MAP, isValidImageDataUri } from "@/components/documents/constants";
import type { DocumentFormData, LetterheadConfig } from "@/components/documents/types";
import { formatCurrency, formatFullDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface DocumentPageProps {
  formData: DocumentFormData;
  letterhead: LetterheadConfig;
  documentNumber?: string;
  className?: string;
}

export const DocumentPage = memo(function DocumentPage({
  formData,
  letterhead,
  documentNumber,
  className,
}: DocumentPageProps) {
  const docTypeLabel = formData.document_type === "quotation" ? "QUOTATION" : "INVOICE";
  const displayNumber =
    documentNumber ||
    `${DOCUMENT_PREFIX_MAP[formData.document_type]}-${new Date().getFullYear()}-DRAFT`;

  return (
    <div
      data-theme="light"
      className={cn(
        "bg-card text-card-foreground mx-auto w-full max-w-[210mm] shadow-lg",
        "text-xs leading-relaxed",
        "p-8 @2xl:p-10",
        className
      )}
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      {/* Letterhead */}
      <div className="border-foreground mb-6 flex items-start justify-between border-b-2 pb-4">
        <div className="flex items-center gap-4">
          {isValidImageDataUri(letterhead.logo_base64) && (
            <img
              src={letterhead.logo_base64}
              alt="Logo"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
          )}
          <div>
            <h1 className="text-xl font-bold">{letterhead.resort_name}</h1>
            {letterhead.tagline && (
              <p className="text-muted-foreground italic">{letterhead.tagline}</p>
            )}
          </div>
        </div>
        <div className="text-muted-foreground text-right">
          <p>{letterhead.address_line_1}</p>
          {letterhead.address_line_2 && <p>{letterhead.address_line_2}</p>}
          <p>
            {letterhead.city}, {letterhead.province} {letterhead.zip_code}
          </p>
          <p>{letterhead.phone}</p>
          <p>{letterhead.email}</p>
          {letterhead.website && <p>{letterhead.website}</p>}
          {letterhead.tin && <p className="mt-1">TIN: {letterhead.tin}</p>}
        </div>
      </div>

      {/* Document Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-wider">{docTypeLabel}</h2>
          <p className="text-muted-foreground mt-1 tabular-nums">{displayNumber}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="text-muted-foreground">Date: </span>
            {formData.document_date ? formatFullDate(formData.document_date) : "—"}
          </p>
          {formData.valid_until && (
            <p>
              <span className="text-muted-foreground">Valid Until: </span>
              {formatFullDate(formData.valid_until)}
            </p>
          )}
        </div>
      </div>

      {/* Recipient */}
      {formData.recipient.name && (
        <div className="bg-muted mb-6 rounded border p-3">
          <p className="text-muted-foreground mb-1 font-semibold tracking-wider uppercase">
            Bill To
          </p>
          <p className="font-semibold">{formData.recipient.name}</p>
          {formData.recipient.company_name && (
            <p className="text-muted-foreground">{formData.recipient.company_name}</p>
          )}
          {formData.recipient.address && (
            <p className="text-muted-foreground">{formData.recipient.address}</p>
          )}
          <div className="text-muted-foreground mt-1 flex gap-4">
            {formData.recipient.email && <span>{formData.recipient.email}</span>}
            {formData.recipient.phone && <span>{formData.recipient.phone}</span>}
          </div>
          {formData.recipient.tin && (
            <p className="text-muted-foreground mt-1">TIN: {formData.recipient.tin}</p>
          )}
        </div>
      )}

      {/* Line Items Table */}
      {formData.line_items.length > 0 && (
        <div className="mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-foreground border-b-2">
                <th className="text-muted-foreground w-8 py-2 text-left font-semibold">#</th>
                <th className="text-muted-foreground py-2 text-left font-semibold">Description</th>
                <th className="text-muted-foreground w-14 py-2 text-right font-semibold">Qty</th>
                <th className="text-muted-foreground w-14 py-2 text-center font-semibold">Unit</th>
                <th className="text-muted-foreground w-24 py-2 text-right font-semibold">
                  Unit Price
                </th>
                <th className="text-muted-foreground w-24 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr key={item.id} className={cn("border-b", idx % 2 === 1 && "bg-muted")}>
                  <td className="text-muted-foreground py-2 tabular-nums">{idx + 1}</td>
                  <td className="py-2">{item.description || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="text-muted-foreground py-2 text-center">{item.unit_label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pricing Summary */}
      <div className="mb-6 flex justify-end">
        <div className="w-64 space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(formData.pricing.subtotal)}</span>
          </div>
          {formData.pricing.discount_amount > 0 && (
            <div className="text-danger-foreground flex justify-between">
              <span>
                Discount
                {formData.pricing.discount_label ? ` (${formData.pricing.discount_label})` : ""}
              </span>
              <span className="tabular-nums">
                -{formatCurrency(formData.pricing.discount_amount)}
              </span>
            </div>
          )}
          {formData.pricing.vat_rate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                VAT ({(formData.pricing.vat_rate * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums">{formatCurrency(formData.pricing.vat_amount)}</span>
            </div>
          )}
          <div className="border-foreground flex justify-between border-t-2 pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCurrency(formData.pricing.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Notes */}
      <div className="text-muted-foreground space-y-3 border-t pt-4">
        {formData.payment_terms && (
          <div>
            <p className="text-foreground font-semibold">Payment Terms</p>
            <p className="whitespace-pre-line">{formData.payment_terms}</p>
          </div>
        )}
        {formData.cancellation_policy && (
          <div>
            <p className="text-foreground font-semibold">Cancellation Policy</p>
            <p className="whitespace-pre-line">{formData.cancellation_policy}</p>
          </div>
        )}
        {formData.notes && (
          <div>
            <p className="text-foreground font-semibold">Notes</p>
            <p className="whitespace-pre-line">{formData.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-muted-foreground mt-8 border-t pt-3 text-center italic">
        This is a computer-generated document. No signature is required.
      </div>
    </div>
  );
});
