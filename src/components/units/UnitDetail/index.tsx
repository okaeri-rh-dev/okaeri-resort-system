// src/components/units/UnitDetail/index.tsx

import { Link } from "@tanstack/react-router";
import { Calendar, DollarSign, Home, Info, Sparkles, TrendingUp } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatPercentage,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import { DetailField, DetailPageLayout, DetailSection, StatusBadge } from "@/components/patterns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { statusTone } from "@/lib/status-tone";
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
 * - Global pricing reference (unit-level pricing removed)
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
  // Fetch global pricing configuration
  const { data: pricingConfig } = usePricingConfig();

  return (
    <DetailPageLayout
      title={`${unit.unit_name} (${unit.unit_code})`}
      subtitle={unit.unit_type}
      breadcrumbs={[
        { label: "Cabins", to: "/admin/units" },
        { label: `${unit.unit_name} (${unit.unit_code})` },
      ]}
      status={
        <StatusBadge tone={statusTone(unit.unit_status || "Available")}>
          {unit.unit_status || "Available"}
        </StatusBadge>
      }
      editRoute={{
        to: "/admin/units/$unitId/edit",
        params: { unitId },
      }}
    >
      {/* 1. Unit Specifications Section */}
      <DetailSection title="Cabin Specifications" icon={<Home className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField label="Cabin Code" value={unit.unit_code} emphasis="strong" />
          <DetailField label="Cabin Type" value={unit.unit_type} emphasis="strong" />
          <DetailField
            label="Max Occupancy"
            value={`${unit.max_occupancy} guests`}
            emphasis="strong"
          />
          <DetailField
            label="Status"
            value={
              <StatusBadge tone={statusTone(unit.unit_status || "Available")}>
                {unit.unit_status || "Available"}
              </StatusBadge>
            }
          />
        </div>
      </DetailSection>

      {/* 2. Pricing Information Section */}
      <DetailSection title="Pricing Information" icon={<DollarSign className="h-5 w-5" />}>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-medium">This cabin uses global pricing configuration.</p>
              <p className="text-muted-foreground text-sm">
                All cabins automatically inherit rates from your resort-wide pricing settings to
                ensure consistent pricing across all units.
              </p>

              {pricingConfig && (
                <div className="mt-4 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-medium text-neutral-700">Current Global Rates:</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-neutral-500">Base Rate (Weekdays)</p>
                      <p className="font-mono text-base font-semibold text-neutral-900">
                        {formatCurrency(pricingConfig.base_rate)}
                      </p>
                      <p className="text-xs text-neutral-500">per night</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Weekend Rate</p>
                      <p className="font-mono text-base font-semibold text-neutral-900">
                        {formatCurrency(pricingConfig.weekend_rate)}
                      </p>
                      <p className="text-xs text-neutral-500">Fri-Sat per night</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Extra Person Rate</p>
                      <p className="font-mono text-base font-semibold text-neutral-900">
                        {formatCurrency(pricingConfig.extra_person_rate)}
                      </p>
                      <p className="text-xs text-neutral-500">per person per night</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Link to="/admin/units/pricing">
                  <Button variant="outline" size="sm" className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Manage Global Pricing Settings
                  </Button>
                </Link>
              </div>
            </div>
          </AlertDescription>
        </Alert>
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
                    <StatusBadge tone={statusTone(booking.booking_status || "Pending")}>
                      {booking.booking_status || "Pending"}
                    </StatusBadge>
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
              emphasis="figure"
            />
            <DetailField
              label="Total Revenue"
              value={formatCurrency(unit.revenue_stats.total_revenue)}
              emphasis="figure"
            />
            <DetailField
              label="Average Booking Value"
              value={formatCurrency(unit.revenue_stats.average_booking_value)}
              emphasis="strong"
            />
            {unit.revenue_stats.occupancy_rate !== undefined && (
              <DetailField
                label="Occupancy Rate"
                value={formatPercentage(unit.revenue_stats.occupancy_rate)}
                emphasis="figure"
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
