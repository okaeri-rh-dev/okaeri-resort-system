// src/components/guests/GuestDetail/index.tsx

import { Calendar, FileText, Mail, TrendingUp } from "lucide-react";

import {
  DetailAuditSection,
  DetailField,
  DetailPageLayout,
  DetailSection,
  formatCurrency,
  formatFullDate,
  formatPhoneNumber,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import { StatusBadge } from "@/components/tables/utils";
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
 * - Monospace fonts for financial data
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Email"
            value={
              guest.email ? (
                <a
                  href={`mailto:${guest.email}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {guest.email}
                </a>
              ) : (
                <span className="text-neutral-400">{"\u2014"}</span>
              )
            }
          />
          <DetailField
            label="Phone"
            value={
              guest.phone_number ? (
                <a
                  href={`tel:${guest.phone_number}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {formatPhoneNumber(guest.phone_number)}
                </a>
              ) : (
                <span className="text-neutral-400">{"\u2014"}</span>
              )
            }
          />
          {guest.address && (
            <DetailField
              label="Address"
              value={guest.address}
              valueClassName="text-sm text-neutral-700"
            />
          )}
        </div>
      </DetailSection>

      {/* 2. Guest Statistics Section */}
      <DetailSection title="Guest Statistics" icon={<TrendingUp className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DetailField
            label="Total Bookings"
            value={(guest.total_bookings || 0).toString()}
            valueClassName="font-semibold text-lg text-neutral-900"
          />
          <DetailField
            label="Total Spent"
            value={formatCurrency(guest.total_spent || 0)}
            valueClassName="font-mono font-semibold text-lg text-neutral-900"
          />
          <DetailField
            label="Average Booking Value"
            value={formatCurrency(averageBookingValue)}
            valueClassName="font-mono font-medium text-neutral-900"
          />
        </div>
      </DetailSection>

      {/* 3. Booking History Section */}
      {guest.bookings && guest.bookings.length > 0 && (
        <DetailSection title="Booking History" icon={<Calendar className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-100">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">
                    Booking Reference
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">
                    Check-out
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {guest.bookings.map((booking) => (
                  <tr key={booking.booking_id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm">
                      <RelatedEntityLink
                        type="booking"
                        id={booking.booking_id}
                        label={booking.booking_reference}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {formatTableDate(booking.check_in)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {formatTableDate(booking.check_out)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium text-neutral-900">
                      {formatCurrency(booking.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={booking.booking_status || "Pending"} />
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
          <div className="prose prose-sm max-w-none">
            <p className="text-sm whitespace-pre-wrap text-neutral-700">{guest.notes}</p>
          </div>
        </DetailSection>
      )}

      {/* 5. Audit Trail Section */}
      <DetailAuditSection entityType="guest" entityId={guestId} />
    </DetailPageLayout>
  );
}
