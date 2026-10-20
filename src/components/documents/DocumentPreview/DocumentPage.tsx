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
      className={cn(
        "mx-auto w-full max-w-[210mm] bg-white text-black shadow-lg",
        "text-[10px] leading-relaxed",
        "p-8 sm:p-10",
        className
      )}
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      {/* Letterhead */}
      <div className="mb-6 flex items-start justify-between border-b-2 border-gray-800 pb-4">
        <div className="flex items-center gap-4">
          {isValidImageDataUri(letterhead.logo_base64) && (
            <img src={letterhead.logo_base64} alt="Logo" className="h-14 w-14 object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{letterhead.resort_name}</h1>
            {letterhead.tagline && (
              <p className="text-[9px] text-gray-500 italic">{letterhead.tagline}</p>
            )}
          </div>
        </div>
        <div className="text-right text-[9px] text-gray-600">
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
          <h2 className="text-2xl font-bold tracking-wider text-gray-900">{docTypeLabel}</h2>
          <p className="mt-1 font-mono text-xs text-gray-600">{displayNumber}</p>
        </div>
        <div className="text-right text-[10px]">
          <p>
            <span className="text-gray-500">Date: </span>
            {formData.document_date ? formatFullDate(formData.document_date) : "—"}
          </p>
          {formData.valid_until && (
            <p>
              <span className="text-gray-500">Valid Until: </span>
              {formatFullDate(formData.valid_until)}
            </p>
          )}
        </div>
      </div>

      {/* Recipient */}
      {formData.recipient.name && (
        <div className="mb-6 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-[9px] font-semibold tracking-wider text-gray-400 uppercase">
            Bill To
          </p>
          <p className="font-semibold text-gray-900">{formData.recipient.name}</p>
          {formData.recipient.company_name && (
            <p className="text-gray-600">{formData.recipient.company_name}</p>
          )}
          {formData.recipient.address && (
            <p className="text-gray-600">{formData.recipient.address}</p>
          )}
          <div className="mt-1 flex gap-4 text-gray-500">
            {formData.recipient.email && <span>{formData.recipient.email}</span>}
            {formData.recipient.phone && <span>{formData.recipient.phone}</span>}
          </div>
          {formData.recipient.tin && (
            <p className="mt-1 text-gray-500">TIN: {formData.recipient.tin}</p>
          )}
        </div>
      )}

      {/* Line Items Table */}
      {formData.line_items.length > 0 && (
        <div className="mb-6">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="w-8 py-2 text-left font-semibold text-gray-600">#</th>
                <th className="py-2 text-left font-semibold text-gray-600">Description</th>
                <th className="w-14 py-2 text-right font-semibold text-gray-600">Qty</th>
                <th className="w-14 py-2 text-center font-semibold text-gray-600">Unit</th>
                <th className="w-24 py-2 text-right font-semibold text-gray-600">Unit Price</th>
                <th className="w-24 py-2 text-right font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50")}
                >
                  <td className="py-2 text-gray-500">{idx + 1}</td>
                  <td className="py-2">{item.description || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-center text-gray-500">{item.unit_label}</td>
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
        <div className="w-64 space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(formData.pricing.subtotal)}</span>
          </div>
          {formData.pricing.discount_amount > 0 && (
            <div className="flex justify-between text-red-600">
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
              <span className="text-gray-500">
                VAT ({(formData.pricing.vat_rate * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums">{formatCurrency(formData.pricing.vat_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-gray-800 pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCurrency(formData.pricing.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Notes */}
      <div className="space-y-3 border-t border-gray-200 pt-4 text-[9px] text-gray-600">
        {formData.payment_terms && (
          <div>
            <p className="font-semibold text-gray-700">Payment Terms</p>
            <p className="whitespace-pre-line">{formData.payment_terms}</p>
          </div>
        )}
        {formData.cancellation_policy && (
          <div>
            <p className="font-semibold text-gray-700">Cancellation Policy</p>
            <p className="whitespace-pre-line">{formData.cancellation_policy}</p>
          </div>
        )}
        {formData.notes && (
          <div>
            <p className="font-semibold text-gray-700">Notes</p>
            <p className="whitespace-pre-line">{formData.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[8px] text-gray-600 italic">
        This is a computer-generated document. No signature is required.
      </div>
    </div>
  );
});
