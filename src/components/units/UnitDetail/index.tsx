// src/components/units/UnitDetail/index.tsx

import { Link } from "@tanstack/react-router";
import { Calendar, DollarSign, Home, Sparkles, TrendingUp } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatPercentage,
  formatTableDate,
  RelatedEntityLink,
} from "@/components/entity-detail";
import {
  Button,
  Callout,
  DetailField,
  DetailPageLayout,
  DetailSection,
  StatusBadge,
} from "@/components/patterns";
import { CabinTonight } from "@/components/units/CabinTonight";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { statusBadgeProps } from "@/lib/status-tone";
import { useCabinStatesTonight } from "@/stores/useUnitStore";
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
 * - Unit specifications (code, type, occupancy, state tonight)
 * - Global pricing reference (unit-level pricing removed)
 * - Amenities list
 * - Current/upcoming bookings with related entity links
 * - Revenue statistics and occupancy metrics
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
export function UnitDetailPage({ unit, unitId }: UnitDetailPageProps) {
  // Fetch global pricing configuration
  const { data: pricingConfig } = usePricingConfig();
  const { data: cabinStates } = useCabinStatesTonight();
  const tonight = cabinStates?.get(unitId);

  return (
    <DetailPageLayout
      title={`${unit.unit_name} (${unit.unit_code})`}
      subtitle={unit.unit_type}
      breadcrumbs={[
        { label: "Cabins", to: "/admin/units" },
        { label: `${unit.unit_name} (${unit.unit_code})` },
      ]}
      status={tonight && <StatusBadge {...statusBadgeProps(tonight.state, "Free")} />}
      editRoute={{
        to: "/admin/units/$unitId/edit",
        params: { unitId },
      }}
    >
      {/* 1. Unit Specifications Section */}
      <DetailSection
        title="Cabin Specifications"
        icon={<Home className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <DetailField label="Cabin Code" value={unit.unit_code} emphasis="strong" />
            <DetailField label="Cabin Type" value={unit.unit_type} emphasis="strong" />
            <DetailField
              label="Max Occupancy"
              value={`${unit.max_occupancy} guests`}
              emphasis="strong"
            />
            <DetailField label="Tonight" value={tonight && <CabinTonight cabinNight={tonight} />} />
          </div>
        </div>
      </DetailSection>

      {/* 2. Pricing Information Section */}
      <DetailSection
        title="Pricing Information"
        icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="@container space-y-4">
          <Callout tone="info" title="This cabin uses global pricing configuration.">
            All cabins automatically inherit rates from your resort-wide pricing settings to ensure
            consistent pricing across all units.
          </Callout>

          {pricingConfig && (
            <div className="bg-muted space-y-2 rounded-md border p-4">
              <p className="text-sm font-medium">Current Global Rates:</p>
              <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-xs">Base Rate (Weekdays)</p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatCurrency(pricingConfig.base_rate)}
                  </p>
                  <p className="text-muted-foreground text-xs">per night</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Weekend Rate</p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatCurrency(pricingConfig.weekend_rate)}
                  </p>
                  <p className="text-muted-foreground text-xs">Fri-Sat per night</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Extra Person Rate</p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatCurrency(pricingConfig.extra_person_rate)}
                  </p>
                  <p className="text-muted-foreground text-xs">per person per night</p>
                </div>
              </div>
            </div>
          )}

          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/admin/units/pricing">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
              Manage Global Pricing Settings
            </Link>
          </Button>
        </div>
      </DetailSection>

      {/* 3. Amenities Section (Conditional) */}
      {unit.amenities && unit.amenities.length > 0 && (
        <DetailSection title="Amenities" icon={<Sparkles className="h-5 w-5" />}>
          <div className="flex flex-wrap gap-2">
            {unit.amenities.map((amenity, index) => (
              <span
                key={index}
                className="border-border bg-muted text-foreground inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium"
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
          <div className="@container space-y-3">
            {unit.bookings.map((booking) => (
              <div
                key={booking.booking_id}
                className="bg-muted flex flex-col rounded-md border p-4 @lg:flex-row @lg:items-center @lg:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <RelatedEntityLink
                      type="booking"
                      id={booking.booking_id}
                      label={booking.booking_reference}
                    />
                    <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatTableDate(booking.check_in)} - {formatTableDate(booking.check_out)}
                  </p>
                  <p className="text-muted-foreground text-sm break-words">{booking.guest_name}</p>
                </div>
                <div className="mt-2 text-right @lg:mt-0">
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {formatCurrency(booking.total_amount)}
                  </p>
                  <p className="text-muted-foreground text-sm">{booking.num_guests} guests</p>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* 5. Revenue Statistics Section */}
      {unit.revenue_stats && (
        <DetailSection title="Revenue Statistics" icon={<TrendingUp className="h-5 w-5" />}>
          <div className="@container">
            <div className="grid grid-cols-1 gap-6 @lg:grid-cols-3">
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
          </div>
        </DetailSection>
      )}

      {/* 6. Audit Trail Section */}
      <DetailAuditSection entityType="unit" entityId={unitId} />
    </DetailPageLayout>
  );
}
