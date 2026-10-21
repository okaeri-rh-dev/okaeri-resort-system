// src/components/guests/GuestDetail/index.tsx

import { Calendar, FileText, Mail, TrendingUp } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatFullDate,
  formatPhoneNumber,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import { DetailField, DetailPageLayout, DetailSection, StatusBadge } from "@/components/patterns";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking, Guest } from "@/types";

/**
 * Props for GuestDetailPage component
 * Data is passed from the route loader
 */
interface GuestDetailPageProps {
  guest: Guest & {
    bookings?: Pick<
      Booking,
      | "booking_id"
      | "booking_reference"
      | "booking_status"
      | "check_in"
      | "check_out"
      | "total_amount"
    >[];
    address?: string;
    notes?: string;
  };
  guestId: string;
}

/**
 * Guest Detail Page Component
 *
 * Displays comprehensive guest information in a professional enterprise layout:
 * - Contact information with formatted phone numbers and email
 * - Guest statistics (total bookings, total spent, average booking value)
 * - Complete booking history with related entity links
 * - Internal notes (if provided)
 * - Full audit trail history
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
export function GuestDetailPage({ guest, guestId }: GuestDetailPageProps) {
  const averageBookingValue =
    guest.total_spent && guest.total_bookings && guest.total_bookings > 0
      ? guest.total_spent / guest.total_bookings
      : 0;

  return (
    <DetailPageLayout
      title={guest.guest_name}
      subtitle={`Member since ${formatFullDate(guest.created_at || new Date().toISOString())}`}
      breadcrumbs={[{ label: "Guests", to: "/admin/guests" }, { label: guest.guest_name }]}
      editRoute={{
        to: "/admin/guests/$guestId/edit",
        params: { guestId },
      }}
    >
      {/* 1. Contact Information Section */}
      <DetailSection title="Contact Information" icon={<Mail className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField
              label="Email"
              value={
                guest.email ? (
                  <a
                    href={`mailto:${guest.email}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {guest.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{"\u2014"}</span>
                )
              }
            />
            <DetailField
              label="Phone"
              value={
                guest.phone_number ? (
                  <a
                    href={`tel:${guest.phone_number}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {formatPhoneNumber(guest.phone_number)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{"\u2014"}</span>
                )
              }
            />
            {guest.address && <DetailField label="Address" value={guest.address} />}
          </div>
        </div>
      </DetailSection>

      {/* 2. Guest Statistics Section */}
      <DetailSection title="Guest Statistics" icon={<TrendingUp className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-3">
            <DetailField
              label="Total Bookings"
              value={(guest.total_bookings || 0).toString()}
              emphasis="figure"
            />
            <DetailField
              label="Total Spent"
              value={formatCurrency(guest.total_spent || 0)}
              emphasis="figure"
            />
            <DetailField
              label="Average Booking Value"
              value={formatCurrency(averageBookingValue)}
              emphasis="strong"
            />
          </div>
        </div>
      </DetailSection>

      {/* 3. Booking History Section */}
      {guest.bookings && guest.bookings.length > 0 && (
        <DetailSection title="Booking History" icon={<Calendar className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-border bg-muted border-b">
                  <th className="text-foreground px-4 py-3 text-left text-sm font-semibold">
                    Booking Reference
                  </th>
                  <th className="text-foreground px-4 py-3 text-left text-sm font-semibold">
                    Check-in
                  </th>
                  <th className="text-foreground px-4 py-3 text-left text-sm font-semibold">
                    Check-out
                  </th>
                  <th className="text-foreground px-4 py-3 text-right text-sm font-semibold">
                    Amount
                  </th>
                  <th className="text-foreground px-4 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {guest.bookings.map((booking) => (
                  <tr key={booking.booking_id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm">
                      <RelatedEntityLink
                        type="booking"
                        id={booking.booking_id}
                        label={booking.booking_reference}
                      />
                    </td>
                    <td className="text-foreground px-4 py-3 text-sm tabular-nums">
                      {formatTableDate(booking.check_in)}
                    </td>
                    <td className="text-foreground px-4 py-3 text-sm tabular-nums">
                      {formatTableDate(booking.check_out)}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(booking.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      )}

      {/* 4. Notes Section (Conditional) */}
      {guest.notes && (
        <DetailSection title="Notes" icon={<FileText className="h-5 w-5" />}>
          <p className="text-sm break-words whitespace-pre-wrap">{guest.notes}</p>
        </DetailSection>
      )}

      {/* 5. Audit Trail Section */}
      <DetailAuditSection entityType="guest" entityId={guestId} />
    </DetailPageLayout>
  );
}
