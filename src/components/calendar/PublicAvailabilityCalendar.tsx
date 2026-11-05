/**
 * Public Availability Calendar Component
 *
 * Main component for displaying real-time unit availability to guests.
 * Fetches aggregated availability data from public API endpoint with
 * 5-minute CDN caching.
 *
 * Features:
 * - Month navigation (previous, next, today)
 * - Color-coded availability grid
 * - Philippine Time (UTC+8) normalization
 * - Loading and error states
 * - Date validation (no past months, max 1 year ahead)
 * - TanStack Query with stale-while-revalidate
 * - Responsive mobile layout
 *
 * @component
 */

import { useState } from "react";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { isAfter, max } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button, Callout } from "@/components/patterns";
import {
  getMonthEnd,
  getMonthStart,
  getTodayPhilippineTime,
  toISODateString,
} from "@/lib/timezone";
import { validateMonth } from "@/lib/validation/calendar";

import { AvailabilityLegend } from "./AvailabilityLegend";
import { CalendarGrid, type AvailabilityDay } from "./CalendarGrid";
import { useSwipeGesture } from "./useSwipeGesture";

/**
 * API response structure from /api/public/v1/availability
 */
interface AvailabilityResponse {
  totalUnits: number;
  dateRange: {
    start: string;
    end: string;
  };
  availability: AvailabilityDay[];
  metadata: {
    generatedAt: string;
    cacheMaxAge: number;
    version: string;
  };
}

/**
 * Fetch availability data from public API endpoint
 * Fetches extended range to include adjacent month dates visible in calendar grid
 *
 * @param month - Date representing the month to fetch
 * @returns Promise resolving to availability response
 * @throws Error if API call fails
 */
async function fetchAvailability(month: Date): Promise<AvailabilityResponse> {
  // Get month boundaries in Philippine Time
  const firstDayOfMonth = getMonthStart(month);
  const lastDayOfMonth = getMonthEnd(month);

  // Calculate first day of calendar grid (may be in previous month)
  const startDayOfWeek = firstDayOfMonth.getDay();
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(calendarStart.getDate() - startDayOfWeek);

  // Calculate last day of calendar grid (may be in next month)
  // Grid always shows complete weeks (multiples of 7)
  const daysInMonthPlusPrefix = lastDayOfMonth.getDate() + startDayOfWeek;
  const totalWeeks = Math.ceil(daysInMonthPlusPrefix / 7);
  const totalDays = totalWeeks * 7;
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarStart.getDate() + totalDays - 1);

  // Smart clamping: never fetch before today, but allow future overflow dates
  const today = getTodayPhilippineTime();

  // For future months, include overflow dates if they're >= today
  // For current/past months, start from today
  const apiStartDate = isAfter(firstDayOfMonth, today)
    ? max([calendarStart, today]) // Future month: include overflow >= today
    : today; // Current month: start from today

  const startISO = toISODateString(apiStartDate);
  const endISO = toISODateString(calendarEnd);

  // Call public API endpoint with full calendar grid range
  const response = await fetch(`/api/public/v1/availability?start=${startISO}&end=${endISO}`);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to fetch availability");
  }

  return response.json();
}

const publicAvailabilityQuery = (month: Date) =>
  queryOptions<AvailabilityResponse>({
    queryKey: ["publicAvailability", month.toISOString()],
    queryFn: () => fetchAvailability(month),
    staleTime: 5 * 60 * 1000, // 5 minutes (matches CDN cache)
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    retry: 2,
  });

export function PublicAvailabilityCalendar() {
  // State: Current month being displayed (initialized to today in Philippine Time)
  const [currentMonth, setCurrentMonth] = useState(getTodayPhilippineTime());

  // Navigation: Go to previous month
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate to past month:", validation.error);
    }
  };

  // Navigation: Go to next month
  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate more than 1 year ahead:", validation.error);
    }
  };

  // Enable swipe gestures for mobile navigation
  useSwipeGesture({
    onSwipeLeft: goToNextMonth,
    onSwipeRight: goToPreviousMonth,
  });

  // Fetch availability data with TanStack Query
  // Uses 5-minute stale time to match CDN cache duration
  const { data, isLoading, error, isFetching } = useQuery({
    ...publicAvailabilityQuery(currentMonth),
    // Only fetch if month is valid (not past, not > 1 year ahead)
    enabled: validateMonth(currentMonth).valid,
    // Keep previous data visible while fetching new month (prevents flicker)
    placeholderData: (previousData) => previousData,
  });

  // Navigation: Return to today's month
  const goToToday = () => {
    setCurrentMonth(getTodayPhilippineTime());
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card shadow-card flex h-96 flex-col items-center justify-center rounded-lg p-8">
        <Loader2
          className="text-primary mb-4 h-12 w-12 animate-spin"
          role="progressbar"
          aria-label="Loading calendar"
        />
        <p className="text-muted-foreground">Loading availability calendar...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Callout tone="danger" className="mx-auto max-w-2xl">
        Failed to load availability data. Please try refreshing the page.
        {error instanceof Error && (
          <span className="mt-2 block text-sm">Error: {error.message}</span>
        )}
      </Callout>
    );
  }

  if (!data) {
    return null;
  }

  // Format month name for display
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Check if navigation buttons should be disabled based on validation
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const isPrevMonthValid = validateMonth(prevMonth).valid;

  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  const isNextMonthValid = validateMonth(nextMonth).valid;

  return (
    <div className="border-border bg-card @container overflow-hidden rounded-lg border">
      {/* Calendar Header with Title - Clean White with Border */}
      <div className="border-border bg-muted border-b">
        {/* Title Row */}
        <div className="border-border border-b px-4 pt-2.5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="text-muted-foreground h-5 w-5" />
              <h1 className="text-foreground text-lg font-semibold">Okaeri Availability</h1>
            </div>
            <span className="text-muted-foreground text-xs">{data.totalUnits} Cabins</span>
          </div>
        </div>

        {/* Month Navigation - Compact */}
        <div className="bg-card px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Previous Month Button */}
            <Button
              onClick={goToPreviousMonth}
              disabled={!isPrevMonthValid}
              variant="ghost"
              size="sm"
              className="text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {/* Current Month Display */}
            <div className="text-center">
              <h2 className="text-foreground text-xl font-bold">{monthName}</h2>
              {isFetching && (
                <span className="text-muted-foreground mt-1 flex items-center justify-center gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              )}
            </div>

            {/* Next Month Button */}
            <Button
              onClick={goToNextMonth}
              disabled={!isNextMonthValid}
              variant="ghost"
              size="sm"
              className="text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Today Button - Even Smaller */}
          <Button
            onClick={goToToday}
            variant="secondary"
            size="sm"
            className="border-border mt-1.5 h-7 w-full border text-sm"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Legend - More Compact */}
      <div className="border-border border-b px-4 py-2">
        <AvailabilityLegend />
      </div>

      {/* Calendar Grid - Reduced Padding */}
      <div className="p-2 @lg:p-3">
        <CalendarGrid
          availability={data.availability}
          currentMonth={currentMonth}
          onDateClick={(date) => {
            // Navigate to the clicked date's month
            const clickedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const validation = validateMonth(clickedMonth);
            if (validation.valid) {
              setCurrentMonth(clickedMonth);
            }
          }}
        />
      </div>

      {/* Last Updated Timestamp - Minimal Footer */}
      <div className="border-border bg-muted border-t px-4 py-2 text-center">
        <p className="text-muted-foreground text-xs">
          Updated{" "}
          {new Date(data.metadata.generatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </p>
      </div>
    </div>
  );
}
