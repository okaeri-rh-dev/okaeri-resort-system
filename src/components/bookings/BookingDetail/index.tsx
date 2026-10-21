// src/components/bookings/BookingDetail/index.tsx

import { Calendar, DollarSign, FileText, Home, User } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatFullDate,
  formatPhoneNumber,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import { DetailField, DetailPageLayout, DetailSection, StatusBadge } from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { statusBadgeProps } from "@/lib/status-tone";
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
 * - Tabular figures for financial data
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
  const { canEdit } = useUserRole();

  return (
    <DetailPageLayout
      testId="booking-detail"
      title={`Booking #${booking.booking_reference}`}
      subtitle={`Created ${formatFullDate(booking.created_at || new Date().toISOString())}`}
      breadcrumbs={[
        { label: "Bookings", to: "/admin/bookings" },
        { label: booking.booking_reference },
      ]}
      status={<StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />}
      editRoute={
        canEdit ? { to: "/admin/bookings/$bookingId/edit", params: { bookingId } } : undefined
      }
    >
      {/* 1. Booking Overview Section */}
      <DetailSection title="Booking Overview" icon={<Calendar className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField
              label="Check-in Date"
              value={formatTableDate(booking.check_in)}
              emphasis="strong"
            />
            <DetailField
              label="Check-out Date"
              value={formatTableDate(booking.check_out)}
              emphasis="strong"
            />
            <DetailField label="Number of Guests" value={booking.num_guests} emphasis="strong" />
            <DetailField
              label="Total Amount"
              value={formatCurrency(booking.total_amount)}
              emphasis="figure"
            />
          </div>
        </div>
      </DetailSection>

      {/* 2. Guest Information Section */}
      <DetailSection title="Guest Information" icon={<User className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField
              label="Guest Name"
              value={
                booking.guest_id && booking.guest ? (
                  <RelatedEntityLink
                    type="guest"
                    id={booking.guest_id}
                    label={booking.guest_name}
                  />
                ) : (
                  <span className="font-medium">{booking.guest_name}</span>
                )
              }
            />
            {booking.email && <DetailField label="Email" value={booking.email} emphasis="strong" />}
            {booking.contact_number && (
              <DetailField
                label="Contact Number"
                value={formatPhoneNumber(booking.contact_number)}
                emphasis="strong"
              />
            )}
          </div>
        </div>
      </DetailSection>

      {/* 3. Cabin Information Section */}
      <DetailSection title="Cabin Information" icon={<Home className="h-5 w-5" />}>
        <div className="space-y-4">
          <DetailField
            label={`Cabin${(booking.booking_units?.length || 0) > 1 ? "s" : ""}`}
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
                        <StatusBadge tone="neutral">{bu.unit_id.slice(0, 8)}</StatusBadge>
                      )}
                      {(booking.booking_units?.length ?? 0) > 1 && (
                        <span className="text-muted-foreground text-xs">
                          ({bu.assigned_guests || 0} guests)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">No units assigned</span>
              )
            }
          />
          {booking.booking_units && booking.booking_units.length > 1 && (
            <DetailField
              label="Total Cabins"
              value={booking.unit_count || booking.booking_units.length}
              emphasis="strong"
            />
          )}
        </div>
      </DetailSection>

      {/* 4. Payment Details Section */}
      <DetailSection title="Payment Details" icon={<DollarSign className="h-5 w-5" />}>
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField
              label="Payment Method"
              value={booking.payment_method || "Not specified"}
              emphasis="strong"
            />
            <DetailField
              label="Payment Status"
              value={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
            />
          </div>
        </div>
      </DetailSection>

      {/* 5. Special Requests Section (Conditional) */}
      {booking.special_requests && (
        <DetailSection title="Special Requests" icon={<FileText className="h-5 w-5" />}>
          <p className="text-sm break-words whitespace-pre-wrap">{booking.special_requests}</p>
        </DetailSection>
      )}

      {/* 6. Audit Trail Section */}
      <DetailAuditSection entityType="booking" entityId={bookingId} />
    </DetailPageLayout>
  );
}
