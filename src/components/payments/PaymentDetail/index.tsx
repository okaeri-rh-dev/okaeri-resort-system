// src/components/payments/PaymentDetail/index.tsx

import { Calendar, DollarSign, FileText, Image } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatDateTime,
  formatFullDate,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import {
  Button,
  DetailField,
  DetailPageLayout,
  DetailSection,
  StatusBadge,
} from "@/components/patterns";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking, Guest, Payment } from "@/types";

/**
 * Props for PaymentDetailPage component
 * Data is passed from the route loader
 */
interface PaymentDetailPageProps {
  payment: Payment & {
    booking?: Booking & { guest?: Guest };
    payment_status?: string;
  };
  paymentId: string;
}

/**
 * Payment Detail Page Component
 *
 * Displays comprehensive payment information in a professional enterprise layout:
 * - Payment overview with amount, method, status, and date
 * - Related booking information with guest details
 * - Payment proof viewer (if uploaded)
 * - Transaction notes (if provided)
 * - Full audit trail history showing verification and status changes
 *
 * Uses Professional Enterprise Design System with:
 * - High information density with minimal whitespace
 * - Tabular figures for financial data
 * - Responsive 2-column desktop / 1-column mobile layouts
 * - Professional status badges
 * - Consistent spacing and typography
 *
 * Note: This component receives data from the route loader via props.
 * The route file handles useParams() and useLoaderData() calls.
 */
export function PaymentDetailPage({ payment, paymentId }: PaymentDetailPageProps) {
  // Format payment ID for display (show first 8 characters)
  const displayPaymentId = payment.payment_id.slice(0, 8);

  return (
    <DetailPageLayout
      title={`Payment #${displayPaymentId}`}
      subtitle={`Date: ${formatFullDate(payment.payment_date || payment.created_at || new Date().toISOString())}`}
      breadcrumbs={[
        { label: "Payments", to: "/admin/payments" },
        { label: `Payment #${displayPaymentId}` },
      ]}
      status={<StatusBadge {...statusBadgeProps(payment.payment_status, "Pending")} />}
      editRoute={{
        to: "/admin/payments/$paymentId/edit",
        params: { paymentId },
      }}
    >
      {/* 1. Payment Overview Section */}
      <DetailSection title="Payment Overview" icon={<DollarSign className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField label="Amount" value={formatCurrency(payment.amount)} emphasis="total" />
            <DetailField
              label="Payment Method"
              value={
                <span className="border-border bg-muted text-foreground inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium">
                  {payment.payment_method || "Not specified"}
                </span>
              }
            />
            <DetailField
              label="Status"
              value={<StatusBadge {...statusBadgeProps(payment.payment_status, "Pending")} />}
            />
            <DetailField
              label="Payment Date"
              value={formatDateTime(payment.payment_date || payment.created_at || "")}
              emphasis="strong"
            />
          </div>
        </div>
      </DetailSection>

      {/* 2. Related Booking Section */}
      {payment.booking && (
        <DetailSection title="Related Booking" icon={<Calendar className="h-5 w-5" />}>
          <div className="@container">
            <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
              <DetailField
                label="Booking Reference"
                value={
                  <RelatedEntityLink
                    type="booking"
                    id={payment.booking.booking_id}
                    label={payment.booking.booking_reference}
                  />
                }
              />
              <DetailField
                label="Guest Name"
                value={
                  payment.booking.guest_id && payment.booking.guest ? (
                    <RelatedEntityLink
                      type="guest"
                      id={payment.booking.guest_id}
                      label={payment.booking.guest_name}
                    />
                  ) : (
                    <span className="font-medium">{payment.booking.guest_name}</span>
                  )
                }
              />
              <DetailField
                label="Check-in Date"
                value={formatTableDate(payment.booking.check_in)}
                emphasis="strong"
              />
              <DetailField
                label="Check-out Date"
                value={formatTableDate(payment.booking.check_out)}
                emphasis="strong"
              />
            </div>
          </div>
        </DetailSection>
      )}

      {/* 3. Payment Proof Section (Conditional) */}
      {payment.proof_url && (
        <DetailSection title="Payment Proof" icon={<Image className="h-5 w-5" />}>
          <div className="space-y-4">
            <div className="relative w-full max-w-2xl">
              <img
                src={payment.proof_url}
                alt="Payment proof"
                width={672}
                height={1456}
                className="border-border h-auto w-full rounded-md border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href={payment.proof_url} target="_blank" rel="noopener noreferrer">
                  Open in New Tab
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={payment.proof_url} download>
                  Download
                </a>
              </Button>
            </div>
          </div>
        </DetailSection>
      )}

      {/* 4. Transaction Notes Section (Conditional) */}
      {payment.notes && (
        <DetailSection title="Transaction Notes" icon={<FileText className="h-5 w-5" />}>
          <p className="text-foreground text-sm whitespace-pre-wrap">{payment.notes}</p>
        </DetailSection>
      )}

      {/* 5. Audit Trail Section */}
      <DetailAuditSection entityType="payment" entityId={paymentId} />
    </DetailPageLayout>
  );
}
