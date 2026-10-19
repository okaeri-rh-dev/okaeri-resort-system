import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import { isValidImageDataUri } from "@/components/documents/constants";
import type { GeneratedDocument } from "@/components/documents/types";
import { formatCurrency, formatFullDate } from "@/lib/formatters";

import { styles } from "./pdf-styles";

interface QuotationPDFProps {
  document: GeneratedDocument;
}

export function QuotationPDF({ document: doc }: QuotationPDFProps) {
  const { metadata, letterhead, recipient, line_items, pricing } = doc;
  const docTypeLabel = metadata.document_type === "quotation" ? "QUOTATION" : "INVOICE";

  return (
    <Document title={`${docTypeLabel} ${metadata.document_number}`} author={letterhead.resort_name}>
      <Page size="A4" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.letterhead}>
          <View style={styles.letterheadLeft}>
            {isValidImageDataUri(letterhead.logo_base64) && (
              <Image src={letterhead.logo_base64} style={styles.logo} />
            )}
            <View>
              <Text style={styles.resortName}>{letterhead.resort_name}</Text>
              {letterhead.tagline && <Text style={styles.tagline}>{letterhead.tagline}</Text>}
            </View>
          </View>
          <View style={styles.letterheadRight}>
            <Text>{letterhead.address_line_1}</Text>
            {letterhead.address_line_2 && <Text>{letterhead.address_line_2}</Text>}
            <Text>
              {letterhead.city}, {letterhead.province} {letterhead.zip_code}
            </Text>
            <Text>{letterhead.phone}</Text>
            <Text>{letterhead.email}</Text>
            {letterhead.website && <Text>{letterhead.website}</Text>}
            {letterhead.tin && <Text>TIN: {letterhead.tin}</Text>}
          </View>
        </View>

        {/* Document Header */}
        <View style={styles.documentHeader}>
          <View>
            <Text style={styles.docTypeTitle}>{docTypeLabel}</Text>
            <Text style={styles.docNumber}>{metadata.document_number}</Text>
          </View>
          <View style={styles.docMeta}>
            <Text>
              <Text style={styles.docMetaLabel}>Date: </Text>
              {formatFullDate(metadata.document_date)}
            </Text>
            {metadata.valid_until && (
              <Text>
                <Text style={styles.docMetaLabel}>Valid Until: </Text>
                {formatFullDate(metadata.valid_until)}
              </Text>
            )}
          </View>
        </View>

        {/* Recipient */}
        {recipient.name && (
          <View style={styles.recipientBox}>
            <Text style={styles.recipientLabel}>Bill To</Text>
            <Text style={styles.recipientName}>{recipient.name}</Text>
            {recipient.company_name && (
              <Text style={styles.recipientDetail}>{recipient.company_name}</Text>
            )}
            {recipient.address && <Text style={styles.recipientDetail}>{recipient.address}</Text>}
            {recipient.email && <Text style={styles.recipientDetail}>{recipient.email}</Text>}
            {recipient.phone && <Text style={styles.recipientDetail}>{recipient.phone}</Text>}
            {recipient.tin && <Text style={styles.recipientDetail}>TIN: {recipient.tin}</Text>}
          </View>
        )}

        {/* Line Items Table */}
        {line_items.length > 0 && (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colNum, styles.thText]}>#</Text>
              <Text style={[styles.colDesc, styles.thText]}>Description</Text>
              <Text style={[styles.colQty, styles.thText]}>Qty</Text>
              <Text style={[styles.colUnit, styles.thText]}>Unit</Text>
              <Text style={[styles.colPrice, styles.thText]}>Unit Price</Text>
              <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
            </View>

            {/* Table Body */}
            {line_items.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.colNum}>{idx + 1}</Text>
                <Text style={styles.colDesc}>{item.description || "—"}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colUnit}>{item.unit_label}</Text>
                <Text style={styles.colPrice}>{formatCurrency(item.unit_price)}</Text>
                <Text style={styles.colAmount}>
                  {formatCurrency(item.quantity * item.unit_price)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Pricing Summary */}
        <View style={styles.pricingContainer}>
          <View style={styles.pricingBox}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Subtotal</Text>
              <Text>{formatCurrency(pricing.subtotal)}</Text>
            </View>
            {pricing.discount_amount > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingDiscount}>
                  Discount{pricing.discount_label ? ` (${pricing.discount_label})` : ""}
                </Text>
                <Text style={styles.pricingDiscount}>
                  -{formatCurrency(pricing.discount_amount)}
                </Text>
              </View>
            )}
            {pricing.vat_rate > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>
                  VAT ({(pricing.vat_rate * 100).toFixed(0)}%)
                </Text>
                <Text>{formatCurrency(pricing.vat_amount)}</Text>
              </View>
            )}
            <View style={styles.pricingTotal}>
              <Text>TOTAL</Text>
              <Text>{formatCurrency(pricing.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Terms & Notes */}
        <View style={styles.termsSection}>
          {doc.payment_terms && (
            <View style={styles.termsBlock}>
              <Text style={styles.termsTitle}>Payment Terms</Text>
              <Text style={styles.termsText}>{doc.payment_terms}</Text>
            </View>
          )}
          {doc.cancellation_policy && (
            <View style={styles.termsBlock}>
              <Text style={styles.termsTitle}>Cancellation Policy</Text>
              <Text style={styles.termsText}>{doc.cancellation_policy}</Text>
            </View>
          )}
          {doc.notes && (
            <View style={styles.termsBlock}>
              <Text style={styles.termsTitle}>Notes</Text>
              <Text style={styles.termsText}>{doc.notes}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated document. No signature is required.</Text>
        </View>

        {/* Page Number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
