// src/components/bookings/BookingDetail/index.tsx

import { Calendar, DollarSign, FileText, Home, User } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import type { Booking } from "@/types";

/**
 * Props for BookingDetailPage component
 * Data is passed from the route loader
 */
interface BookingDetailPageProps {
  booking: Booking;
  bookingId: string;
}

/**
 * Booking Detail Page Component
 *
 * Displays comprehensive booking information in a professional enterprise layout:
 * - Booking overview with dates, guests, and total amount
 * - Guest contact information with formatted phone numbers
 * - Unit details with related entity links
 * - Payment status and method
 * - Special requests (if provided)
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
export function BookingDetailPage({ booking, bookingId }: BookingDetailPageProps) {
  // Data is received via props from the route component
  // No need for useParams() or useLoaderData() here

  return (
    <DetailPageLayout
      title={`Booking #${booking.booking_reference}`}
      subtitle={`Created ${formatFullDate(booking.created_at || new Date().toISOString())}`}
      breadcrumbs={[
        { label: "Bookings", to: "/admin/bookings" },
        { label: booking.booking_reference },
      ]}
      status={<StatusBadge status={booking.booking_status || "Pending"} />}
      editRoute={{
        to: "/bookings/$bookingId/edit",
        params: { bookingId },
      }}
    >
      {/* 1. Booking Overview Section */}
      <DetailSection title="Booking Overview" icon={<Calendar className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Check-in Date"
            value={formatTableDate(booking.check_in)}
            valueClassName="font-medium"
          />
          <DetailField
            label="Check-out Date"
            value={formatTableDate(booking.check_out)}
            valueClassName="font-medium"
          />
          <DetailField
            label="Number of Guests"
            value={booking.num_guests}
            valueClassName="font-medium"
          />
          <DetailField
            label="Total Amount"
            value={formatCurrency(booking.total_amount)}
            valueClassName="font-mono font-semibold text-lg text-neutral-900"
          />
        </div>
      </DetailSection>

      {/* 2. Guest Information Section */}
      <DetailSection title="Guest Information" icon={<User className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Guest Name"
            value={
              booking.guest_id && booking.guest ? (
                <RelatedEntityLink type="guest" id={booking.guest_id} label={booking.guest_name} />
              ) : (
                <span className="font-medium">{booking.guest_name}</span>
              )
            }
          />
          <DetailField label="Email" value={booking.email} valueClassName="font-medium" />
          <DetailField
            label="Contact Number"
            value={formatPhoneNumber(booking.contact_number)}
            valueClassName="font-medium"
          />
        </div>
      </DetailSection>

      {/* 3. Unit Information Section */}
      <DetailSection title="Unit Information" icon={<Home className="h-5 w-5" />}>
        <div className="space-y-4">
          <DetailField
            label={`Unit${(booking.booking_units?.length || 0) > 1 ? "s" : ""}`}
            value={
              booking.booking_units && booking.booking_units.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {booking.booking_units.map((bu) => (
                    <div key={bu.booking_unit_id} className="flex items-center gap-2">
                      {bu.unit && bu.unit_id ? (
                        <RelatedEntityLink
                          type="unit"
                          id={bu.unit_id}
                          label={bu.unit.unit_name}
                          badge={bu.unit.unit_code}
                        />
                      ) : (
                        <Badge variant="secondary" className="font-mono">
                          {bu.unit_id.slice(0, 8)}
                        </Badge>
                      )}
                      {booking.booking_units!.length > 1 && (
                        <span className="text-xs text-neutral-500">
                          ({bu.assigned_guests || 0} guests)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-neutral-500">No units assigned</span>
              )
            }
          />
          {booking.booking_units && booking.booking_units.length > 1 && (
            <DetailField
              label="Total Units"
              value={booking.unit_count || booking.booking_units.length}
              valueClassName="font-medium"
            />
          )}
        </div>
      </DetailSection>

      {/* 4. Payment Details Section */}
      <DetailSection title="Payment Details" icon={<DollarSign className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Payment Method"
            value={booking.payment_method || "Not specified"}
            valueClassName="font-medium"
          />
          <DetailField
            label="Payment Status"
            value={<StatusBadge status={booking.payment_status || "Pending"} />}
          />
        </div>
      </DetailSection>

      {/* 5. Special Requests Section (Conditional) */}
      {booking.special_requests && (
        <DetailSection title="Special Requests" icon={<FileText className="h-5 w-5" />}>
          <div className="prose prose-sm max-w-none">
            <p className="text-sm whitespace-pre-wrap text-neutral-700">
              {booking.special_requests}
            </p>
          </div>
        </DetailSection>
      )}

      {/* 6. Audit Trail Section */}
      <DetailAuditSection entityType="booking" entityId={bookingId} />
    </DetailPageLayout>
  );
}
