// src/components/units/UnitDetail/index.tsx

import { Calendar, DollarSign, Home, Sparkles, TrendingUp } from "lucide-react";

import {
  DetailAuditSection,
  DetailField,
  DetailPageLayout,
  DetailSection,
  formatCurrency,
  formatPercentage,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import { StatusBadge } from "@/components/tables/utils";
import type { Booking, Unit } from "@/types";

/**
 * Props for UnitDetailPage component
 * Data is passed from the route loader
 */
interface UnitDetailPageProps {
  unit: Unit & {
    bookings?: Booking[];
    revenue_stats?: {
      total_bookings: number;
      total_revenue: number;
      average_booking_value: number;
      occupancy_rate?: number;
    };
  };
  unitId: string;
}

/**
 * Unit Detail Page Component
 *
 * Displays comprehensive unit information in a professional enterprise layout:
 * - Unit specifications (code, type, occupancy, status)
 * - Pricing information with monospace formatting
 * - Amenities list
 * - Current/upcoming bookings with related entity links
 * - Revenue statistics and occupancy metrics
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
export function UnitDetailPage({ unit, unitId }: UnitDetailPageProps) {
  return (
    <DetailPageLayout
      title={`${unit.unit_name} (${unit.unit_code})`}
      subtitle={unit.unit_type}
      breadcrumbs={[
        { label: "Units", to: "/units" },
        { label: `${unit.unit_name} (${unit.unit_code})` },
      ]}
      status={<StatusBadge status={unit.unit_status || "Available"} />}
      editRoute={{
        to: "/units/$unitId/edit",
        params: { unitId },
      }}
    >
      {/* 1. Unit Specifications Section */}
      <DetailSection title="Unit Specifications" icon={<Home className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Unit Code"
            value={unit.unit_code}
            valueClassName="font-mono font-medium"
          />
          <DetailField label="Unit Type" value={unit.unit_type} valueClassName="font-medium" />
          <DetailField
            label="Max Occupancy"
            value={`${unit.max_occupancy} guests`}
            valueClassName="font-medium"
          />
          <DetailField
            label="Status"
            value={<StatusBadge status={unit.unit_status || "Available"} />}
          />
        </div>
      </DetailSection>

      {/* 2. Pricing Information Section */}
      <DetailSection title="Pricing Information" icon={<DollarSign className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField
            label="Base Rate (per night)"
            value={formatCurrency(unit.base_rate)}
            valueClassName="font-mono font-semibold text-lg text-neutral-900"
          />
          {unit.weekend_rate && unit.weekend_rate !== unit.base_rate && (
            <DetailField
              label="Weekend Rate (per night)"
              value={formatCurrency(unit.weekend_rate)}
              valueClassName="font-mono font-semibold text-lg text-neutral-900"
            />
          )}
          {unit.extra_person_rate && unit.extra_person_rate > 0 && (
            <DetailField
              label="Extra Person Rate"
              value={formatCurrency(unit.extra_person_rate)}
              valueClassName="font-mono font-medium text-neutral-900"
            />
          )}
          {unit.cleaning_fee && unit.cleaning_fee > 0 && (
            <DetailField
              label="Cleaning Fee"
              value={formatCurrency(unit.cleaning_fee)}
              valueClassName="font-mono font-medium text-neutral-900"
            />
          )}
        </div>
      </DetailSection>

      {/* 3. Amenities Section (Conditional) */}
      {unit.amenities && unit.amenities.length > 0 && (
        <DetailSection title="Amenities" icon={<Sparkles className="h-5 w-5" />}>
          <div className="flex flex-wrap gap-2">
            {unit.amenities.map((amenity, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700"
              >
                {amenity}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* 4. Current/Upcoming Bookings Section */}
      {unit.bookings && unit.bookings.length > 0 && (
        <DetailSection title="Current/Upcoming Bookings" icon={<Calendar className="h-5 w-5" />}>
          <div className="space-y-3">
            {unit.bookings.map((booking) => (
              <div
                key={booking.booking_id}
                className="flex flex-col rounded-md border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RelatedEntityLink
                      type="booking"
                      id={booking.booking_id}
                      label={booking.booking_reference}
                    />
                    <StatusBadge status={booking.booking_status || "Pending"} />
                  </div>
                  <p className="text-sm text-neutral-600">
                    {formatTableDate(booking.check_in)} - {formatTableDate(booking.check_out)}
                  </p>
                  <p className="text-sm text-neutral-600">{booking.guest_name}</p>
                </div>
                <div className="mt-2 text-right md:mt-0">
                  <p className="font-mono text-lg font-semibold text-neutral-900">
                    {formatCurrency(booking.total_amount)}
                  </p>
                  <p className="text-sm text-neutral-600">{booking.num_guests} guests</p>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* 5. Revenue Statistics Section */}
      {unit.revenue_stats && (
        <DetailSection title="Revenue Statistics" icon={<TrendingUp className="h-5 w-5" />}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <DetailField
              label="Total Bookings"
              value={unit.revenue_stats.total_bookings.toString()}
              valueClassName="font-semibold text-lg text-neutral-900"
            />
            <DetailField
              label="Total Revenue"
              value={formatCurrency(unit.revenue_stats.total_revenue)}
              valueClassName="font-mono font-semibold text-lg text-neutral-900"
            />
            <DetailField
              label="Average Booking Value"
              value={formatCurrency(unit.revenue_stats.average_booking_value)}
              valueClassName="font-mono font-medium text-neutral-900"
            />
            {unit.revenue_stats.occupancy_rate !== undefined && (
              <DetailField
                label="Occupancy Rate"
                value={formatPercentage(unit.revenue_stats.occupancy_rate)}
                valueClassName="font-semibold text-lg text-neutral-900"
              />
            )}
          </div>
        </DetailSection>
      )}

      {/* 6. Audit Trail Section */}
      <DetailAuditSection entityType="unit" entityId={unitId} />
    </DetailPageLayout>
  );
}
