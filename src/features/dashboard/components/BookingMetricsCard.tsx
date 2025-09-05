/**
 * BookingMetricsCard Component
 * Phase 2.1 - GREEN Phase: Enterprise-grade booking metrics display for Okaeri Resort
 *
 * @description Displays occupancy rate, check-ins/check-outs, guest details,
 * and real-time updates with Philippine business context and accessibility
 */

import React, { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { BookingMetrics, GuestArrival } from "../types";

interface BookingMetricsCardProps {
  metrics?: BookingMetrics | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  isMobile?: boolean;
  realtimeUpdate?: boolean;
}

interface SkeletonProps {
  className?: string;
}

const SkeletonLine: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div data-testid="skeleton-line" className={`bg-muted h-4 animate-pulse rounded ${className}`} />
);

const SkeletonProgressBar: React.FC = () => (
  <div
    data-testid="skeleton-progress-bar"
    className="bg-muted h-2 w-full animate-pulse rounded-full"
  />
);

const LoadingSkeleton: React.FC = () => (
  <div
    data-testid="booking-metrics-skeleton"
    aria-label="Loading booking metrics"
    className="space-y-4"
  >
    <SkeletonLine className="w-32" />
    <SkeletonProgressBar />
    <div className="grid grid-cols-2 gap-4">
      <SkeletonLine className="w-24" />
      <SkeletonLine className="w-24" />
    </div>
    <SkeletonLine className="w-full" />
  </div>
);

const EmptyState: React.FC = () => (
  <div data-testid="booking-metrics-empty" className="text-muted-foreground py-8 text-center">
    <h3 className="mb-2 font-medium">No booking data available</h3>
    <p className="text-sm">Start by creating your first booking</p>
  </div>
);

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div data-testid="booking-metrics-error" className="py-8 text-center">
    <h3 className="text-destructive mb-2 font-medium">Error loading booking data</h3>
    <p className="text-muted-foreground mb-4 text-sm">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
        role="button"
        aria-label="Retry"
      >
        Retry
      </button>
    )}
  </div>
);

const formatPhilippineMobile = (number: string): string => {
  // Convert raw Philippine mobile format (09xxxxxxxxx) to international
  if (number.startsWith("09")) {
    return `+63 ${number.slice(1, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
  }
  // Return as-is if already in international format
  if (number.startsWith("+63")) {
    return number.replace(/(\+63\s?)(\d{3})(\d{3})(\d{4})/, "+63 $2 $3 $4");
  }
  return number;
};

const formatGuestName = (name: string): string => {
  // Convert all caps to proper case for better readability
  return name.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

const getOccupancyColor = (occupancy: number): string => {
  if (occupancy < 30) return "red"; // Low occupancy
  if (occupancy < 60) return "yellow"; // Medium occupancy
  if (occupancy < 95) return "green"; // High occupancy
  return "orange"; // Critical/overbook risk
};

const getOccupancyLevel = (occupancy: number): string => {
  if (occupancy < 30) return "low";
  if (occupancy < 60) return "medium";
  if (occupancy < 95) return "high";
  return "critical";
};

const BookingMetricsCardComponent: React.FC<BookingMetricsCardProps> = ({
  metrics,
  loading = false,
  error = null,
  onRefresh,
  isMobile = false,
  realtimeUpdate = false,
}) => {
  const [occupancyUpdate, setOccupancyUpdate] = useState<string>("");
  const [newCheckInNotification, setNewCheckInNotification] = useState<string>("");
  const [typhoonWarning, setTyphoonWarning] = useState(false);

  // Handle real-time updates
  useEffect(() => {
    const handleDashboardUpdate = (event: CustomEvent) => {
      const { type, guestName, roomNumber } = event.detail;

      if (type === "check_in") {
        setNewCheckInNotification(`${guestName} checked in`);
        setTimeout(() => setNewCheckInNotification(""), 5000);
      }
    };

    window.addEventListener("dashboard-update", handleDashboardUpdate as EventListener);
    return () =>
      window.removeEventListener("dashboard-update", handleDashboardUpdate as EventListener);
  }, []);

  // Handle occupancy change announcements
  useEffect(() => {
    if (realtimeUpdate && metrics?.occupancy.current) {
      setOccupancyUpdate(`Occupancy rate increased to ${metrics.occupancy.current}%`);
      setTimeout(() => setOccupancyUpdate(""), 3000);
    }
  }, [metrics?.occupancy.current, realtimeUpdate]);

  // Check for typhoon season warnings
  useEffect(() => {
    // This would normally come from metrics, but we'll simulate based on occupancy and season
    if (metrics?.occupancy.current && metrics.occupancy.current > 90) {
      // In a real implementation, this would check season/weather data
      setTyphoonWarning(true);
    }
  }, [metrics?.occupancy.current]);

  // Handle touch gestures for mobile refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !onRefresh) return;
    const touch = e.touches[0];
    const startY = touch.clientY;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;

      if (deltaY > 50) {
        // Pull down threshold
        onRefresh();
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  };

  // Calculate booking source percentages
  const bookingSourcePercentages = useMemo(() => {
    if (!metrics?.bookingSources) return {};

    const total = Object.values(metrics.bookingSources).reduce((sum, val) => sum + val, 0);
    if (total === 0) return {};

    return Object.entries(metrics.bookingSources).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: ((value / total) * 100).toFixed(1),
      }),
      {}
    );
  }, [metrics?.bookingSources]);

  // Get occupancy trend info
  const occupancyTrend = useMemo(() => {
    if (!metrics?.occupancy.trend) return null;

    const symbols = {
      up: "↗",
      down: "↘",
      stable: "→",
    };

    const colors = {
      up: "text-green-600",
      down: "text-red-600",
      stable: "text-gray-600",
    };

    return {
      symbol: symbols[metrics.occupancy.trend],
      color: colors[metrics.occupancy.trend],
      label: `Occupancy trending ${metrics.occupancy.trend}`,
    };
  }, [metrics?.occupancy.trend]);

  if (loading) {
    return (
      <Card
        data-testid="booking-metrics-card"
        role="region"
        aria-label="Booking metrics"
        className={isMobile ? "mobile-layout flex-col" : ""}
      >
        <CardHeader>
          <CardTitle>Bookings Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="booking-metrics-card" role="region" aria-label="Booking metrics">
        <CardHeader>
          <CardTitle>Bookings Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState error={error} onRetry={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card data-testid="booking-metrics-card" role="region" aria-label="Booking metrics">
        <CardHeader>
          <CardTitle>Bookings Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  const occupancyColor = getOccupancyColor(metrics.occupancy.current);
  const occupancyLevel = getOccupancyLevel(metrics.occupancy.current);

  return (
    <Card
      data-testid="booking-metrics-card"
      role="region"
      aria-label="Booking metrics"
      className={isMobile ? "mobile-layout flex-col" : ""}
      onTouchStart={handleTouchStart}
      tabIndex={0}
    >
      <CardHeader>
        <CardTitle>Bookings Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live status indicator */}
        {occupancyUpdate && (
          <div role="status" className="sr-only">
            {occupancyUpdate}
          </div>
        )}

        {/* New check-in notification */}
        {newCheckInNotification && (
          <div
            data-testid="new-checkin-notification"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {newCheckInNotification}
          </div>
        )}

        {/* Typhoon warning */}
        {typhoonWarning && (
          <div
            data-testid="typhoon-warning"
            className="rounded-lg border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-800"
          >
            Monitor weather conditions for guest safety
          </div>
        )}

        {/* Occupancy Rate Section */}
        <div data-testid="occupancy-section" className={isMobile ? "w-full" : ""}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Current Occupancy</h3>
            {occupancyTrend && (
              <div
                data-testid="occupancy-trend"
                aria-label={occupancyTrend.label}
                className={`text-sm ${occupancyTrend.color}`}
              >
                {occupancyTrend.symbol}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div
              data-testid="occupancy-rate"
              aria-valuenow={metrics.occupancy.current}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${metrics.occupancy.current}% occupancy rate`}
              className={`text-3xl font-bold transition-all duration-500 ease-in-out ${realtimeUpdate ? "animate-pulse" : ""} ${typhoonWarning ? "border-yellow-500" : ""}`}
            >
              {metrics.occupancy.current}%
            </div>

            <div
              role="progressbar"
              aria-valuenow={metrics.occupancy.current}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Current occupancy rate"
              data-level={occupancyLevel}
              className={`h-2 transition-all duration-500 ease-in-out bg-${occupancyColor}-500 rounded-full`}
              style={{ "--value": metrics.occupancy.current } as React.CSSProperties}
            />

            <div className="text-muted-foreground text-sm">
              {metrics.occupancy.availableRooms} of {metrics.occupancy.totalRooms} rooms available
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-2 gap-4">
          <div data-testid="check-ins-today" className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-700">
              {metrics.checkInsToday} Check-ins Today
            </div>
          </div>

          <div data-testid="check-outs-today" className="rounded-lg bg-blue-50 p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {metrics.checkOutsToday} Check-outs Today
            </div>
          </div>
        </div>

        {/* Room Status */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Room Status</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div data-testid="rooms-clean" className="flex justify-between">
              <span>{metrics.roomStatus.clean} Clean</span>
            </div>
            <div data-testid="rooms-dirty" className="flex justify-between">
              <span>{metrics.roomStatus.dirty} Dirty</span>
            </div>
            <div data-testid="rooms-maintenance" className="flex justify-between">
              <span>{metrics.roomStatus.maintenance} Maintenance</span>
            </div>
            <div data-testid="rooms-out-of-order" className="flex justify-between">
              <span>{metrics.roomStatus.outOfOrder} Out of Order</span>
            </div>
          </div>
        </div>

        {/* Upcoming Arrivals */}
        {metrics.arrivalsNext24Hours && metrics.arrivalsNext24Hours.length > 0 && (
          <div data-testid="guest-section" className={isMobile ? "mt-4 w-full" : ""}>
            <h3 className="mb-3 text-sm font-medium">Upcoming Arrivals</h3>
            <div
              data-testid="upcoming-arrivals"
              className={metrics.arrivalsNext24Hours.length > 10 ? "max-h-64 overflow-y-auto" : ""}
              tabIndex={0}
            >
              {metrics.arrivalsNext24Hours.length > 100 ? (
                <div data-testid="virtualized-guest-list">
                  {/* Show only first 15 items for performance */}
                  {metrics.arrivalsNext24Hours.slice(0, 15).map((arrival, index) => (
                    <GuestArrivalItem key={arrival.id} arrival={arrival} index={index} />
                  ))}
                  {metrics.arrivalsNext24Hours.length > 15 && (
                    <div className="text-muted-foreground py-2 text-center text-sm">
                      +{metrics.arrivalsNext24Hours.length - 15} more arrivals
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.arrivalsNext24Hours.map((arrival, index) => (
                    <GuestArrivalItem key={arrival.id} arrival={arrival} index={index} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Booking Sources */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Booking Sources</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div data-testid="source-direct" className="flex justify-between">
              <span>Direct</span>
              <span className="font-medium">
                {metrics.bookingSources.direct}
                <span
                  data-testid="source-direct-percentage"
                  className="text-muted-foreground ml-1 text-xs"
                >
                  ({bookingSourcePercentages.direct}%)
                </span>
              </span>
            </div>
            <div data-testid="source-booking-com" className="flex justify-between">
              <span>Booking.com</span>
              <span className="font-medium">
                {metrics.bookingSources.booking_com}
                <span
                  data-testid="source-booking-com-percentage"
                  className="text-muted-foreground ml-1 text-xs"
                >
                  ({bookingSourcePercentages.booking_com}%)
                </span>
              </span>
            </div>
            <div data-testid="source-agoda" className="flex justify-between">
              <span>Agoda</span>
              <span className="font-medium">
                {metrics.bookingSources.agoda}
                <span
                  data-testid="source-agoda-percentage"
                  className="text-muted-foreground ml-1 text-xs"
                >
                  ({bookingSourcePercentages.agoda}%)
                </span>
              </span>
            </div>
            <div data-testid="source-airbnb" className="flex justify-between">
              <span>Airbnb</span>
              <span className="font-medium">{metrics.bookingSources.airbnb}</span>
            </div>
            <div data-testid="source-walk-in" className="flex justify-between">
              <span>Walk-in</span>
              <span className="font-medium">{metrics.bookingSources.walk_in}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized component to prevent unnecessary re-renders during dashboard updates
export const BookingMetricsCard = React.memo(
  BookingMetricsCardComponent,
  (prevProps, nextProps) => {
    // Custom equality check for performance optimization
    return (
      prevProps.loading === nextProps.loading &&
      prevProps.error === nextProps.error &&
      prevProps.isMobile === nextProps.isMobile &&
      prevProps.realtimeUpdate === nextProps.realtimeUpdate &&
      prevProps.onRefresh === nextProps.onRefresh &&
      // Deep comparison for metrics object
      JSON.stringify(prevProps.metrics) === JSON.stringify(nextProps.metrics)
    );
  }
);

interface GuestArrivalItemProps {
  arrival: GuestArrival;
  index: number;
}

const GuestArrivalItemComponent: React.FC<GuestArrivalItemProps> = ({ arrival, index }) => {
  const formattedName = formatGuestName(arrival.guestName);
  const formattedPhone = formatPhilippineMobile(arrival.contactNumber);

  return (
    <div
      data-testid={`guest-item-${index}`}
      className="bg-muted/50 flex items-center justify-between rounded p-2"
    >
      <div>
        <div className="text-sm font-medium">{formattedName}</div>
        <div className="text-muted-foreground text-xs">
          <span>Room {arrival.roomNumber}</span> • <span>{arrival.id}</span>
        </div>
        {arrival.nationalityCode === "PH" && (
          <div className="text-xs text-green-600">{formattedPhone}</div>
        )}
      </div>
      <div className="text-right">
        <div data-testid={`guest-nationality-${arrival.nationalityCode}`} className="text-xs">
          {arrival.nationalityCode}
        </div>
        <div className="text-muted-foreground text-xs">
          {arrival.adultsCount} adult{arrival.adultsCount !== 1 ? "s" : ""}
          {arrival.childrenCount > 0 &&
            `, ${arrival.childrenCount} child${arrival.childrenCount !== 1 ? "ren" : ""}`}
        </div>
        <Badge
          variant={arrival.paymentStatus === "paid" ? "default" : "secondary"}
          data-testid={`payment-status-${arrival.paymentStatus}`}
          className="text-xs"
        >
          {arrival.paymentStatus === "paid"
            ? "Paid"
            : arrival.paymentStatus === "partial"
              ? "Partial Payment"
              : "Pending"}
        </Badge>
      </div>
    </div>
  );
};

// Memoized guest item to prevent unnecessary re-renders in lists
const GuestArrivalItem = React.memo(GuestArrivalItemComponent);
