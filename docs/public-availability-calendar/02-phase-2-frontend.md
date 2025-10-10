# Phase 2: Frontend Implementation

> **React components, UI, and user experience for public availability calendar**

**Estimated Time**: 3-4 days (24-32 hours)
**Prerequisites**: Phase 1 backend complete, API endpoint accessible
**Deliverables**: Functional, mobile-responsive public calendar page

---

## Overview

> **📌 CRITICAL: VIEW-ONLY Calendar**
>
> This calendar displays availability ONLY. NO booking forms, NO pricing display, NO payment processing, NO CTA buttons or contact prompts.
> Link is shared privately to interested guests only. Manager approves all bookings after direct communication.

Phase 2 builds the user-facing calendar interface with:

1. **Route**: `/calendar` - Public page (no authentication)
2. **Components**: Calendar grid, legend, month navigation
3. **Data Fetching**: TanStack Query with 5-minute caching (no Realtime updates)
4. **Date Validation**: Frontend validation (no past dates, max 1 year future)
5. **Timezone Handling**: Asia/Manila (UTC+8) normalization with date-fns-tz
6. **Styling**: Tailwind CSS v4 + shadcn/ui
7. **Mobile UX**: Touch gestures, responsive layout
8. **SEO**: Meta tags, structured data, Open Graph

`★ Insight ─────────────────────────────────────`
**TanStack Query is perfect for this use case**: Automatic background refetching, stale-while-revalidate pattern, and built-in loading states make the calendar feel instant even with 5-minute CDN caching.
`─────────────────────────────────────────────────`

---

## Step 1: Create Public Route

### 1.1 Create Route File

Create `/src/routes/calendar.tsx`:

```typescript
import { createFileRoute } from '@tanstack/router';
import { PublicAvailabilityCalendar } from '@/components/calendar/PublicAvailabilityCalendar';
import { Calendar as CalendarIcon } from 'lucide-react';

export const Route = createFileRoute('/calendar')({
  component: AvailabilityPage,
  meta: () => [
    {
      title: 'Okaeri Resort - Availability Calendar | Check Real-Time Availability',
    },
    {
      name: 'description',
      content: 'Check real-time availability for Okaeri Resort in Taboc, La Union. View available dates and plan your beachfront getaway. 3 units available.',
    },
    {
      name: 'keywords',
      content: 'Okaeri Resort, La Union resort availability, beach resort calendar, Taboc accommodations, Philippines beachfront booking',
    },
    {
      property: 'og:title',
      content: 'Okaeri Resort Availability Calendar',
    },
    {
      property: 'og:description',
      content: 'View real-time availability for our 3 beachfront units in Taboc, La Union',
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      property: 'og:url',
      content: 'https://okaeri-resort.com/calendar',
    },
    {
      property: 'og:image',
      content: 'https://okaeri-resort.com/images/calendar-og.jpg',
    },
    {
      property: 'og:site_name',
      content: 'Okaeri Resort',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:title',
      content: 'Okaeri Resort Availability Calendar',
    },
    {
      name: 'twitter:description',
      content: 'View real-time availability for our 3 beachfront units',
    },
    {
      name: 'twitter:image',
      content: 'https://okaeri-resort.com/images/calendar-og.jpg',
    },
  ],
});

function AvailabilityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CalendarIcon className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Okaeri Availability Calendar
            </h1>
            <p className="text-lg text-gray-600">
              Check real-time availability for our 3 beachfront units in Taboc, La Union
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PublicAvailabilityCalendar />

        {/* Information Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>View-Only Calendar:</strong> This calendar shows real-time availability for planning purposes only.
            To make a booking, please contact us through our main website.
            Our manager will confirm availability, discuss pricing and requirements, and guide you through the booking process.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-gray-100 border-t border-gray-200">
        <div className="container mx-auto px-4 max-w-4xl text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Okaeri Resort. All rights reserved.</p>
          <p className="mt-1">
            <a href="/" className="text-blue-600 hover:underline">Home</a>
            {' • '}
            <a href="/contact" className="text-blue-600 hover:underline">Contact</a>
            {' • '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
```

---

## Step 2: Create Calendar Component

### 2.1 Main Calendar Component

Create `/src/components/calendar/PublicAvailabilityCalendar.tsx`:

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CalendarGrid } from './CalendarGrid';
import { AvailabilityLegend } from './AvailabilityLegend';

export interface AvailabilityDay {
  date: string;
  availableCount: number;
  status: 'full' | 'moderate' | 'limited' | 'booked';
}

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

export function PublicAvailabilityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch availability data
  const { data, isLoading, error, isFetching } = useQuery<AvailabilityResponse>({
    queryKey: ['publicAvailability', currentMonth.toISOString()],
    queryFn: () => fetchAvailability(currentMonth),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    retry: 2,
  });

  // Navigation handlers
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-lg p-8">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Loading availability calendar...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Failed to load availability data. Please try refreshing the page.
          {error instanceof Error && (
            <span className="block mt-2 text-sm opacity-75">
              Error: {error.message}
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Disable previous month button if it's before current month
  const now = new Date();
  const isCurrentOrFutureMonth =
    currentMonth.getFullYear() > now.getFullYear() ||
    (currentMonth.getFullYear() === now.getFullYear() &&
      currentMonth.getMonth() >= now.getMonth());

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={goToPreviousMonth}
            disabled={!isCurrentOrFutureMonth}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-500/20 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="text-center">
            <h3 className="text-2xl font-bold">{monthName}</h3>
            {isFetching && (
              <span className="text-sm text-blue-200 flex items-center justify-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>

          <Button
            onClick={goToNextMonth}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-500/20"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <Button
          onClick={goToToday}
          variant="secondary"
          size="sm"
          className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
        >
          Today
        </Button>
      </div>

      {/* Legend */}
      <div className="px-6 pt-6">
        <AvailabilityLegend />
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <CalendarGrid
          availability={data.availability}
          currentMonth={currentMonth}
        />
      </div>

      {/* Last Updated */}
      <div className="px-6 pb-4 text-center text-xs text-gray-500">
        Last updated: {new Date(data.metadata.generatedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}
      </div>
    </div>
  );
}

// Fetch availability data from API
async function fetchAvailability(month: Date): Promise<AvailabilityResponse> {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const response = await fetch(
    `/api/public/v1/availability?start=${startDate}&end=${endDate}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch availability');
  }

  return response.json();
}
```

### 2.2 Calendar Grid Component

Create `/src/components/calendar/CalendarGrid.tsx`:

```typescript
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { AvailabilityDay } from './PublicAvailabilityCalendar';

interface CalendarGridProps {
  availability: AvailabilityDay[];
  currentMonth: Date;
}

export function CalendarGrid({ availability, currentMonth }: CalendarGridProps) {
  // Build availability map for quick lookup
  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    availability.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [availability]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build array of days
    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      availability?: AvailabilityDay;
    }> = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      const date = new Date(year, month, -startDayOfWeek + i + 1);
      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: false,
        isPast: true,
      });
    }

    // Add days of current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const isPast = date < today;

      days.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isPast,
        availability: availabilityMap.get(dateStr),
      });
    }

    return days;
  }, [currentMonth, availabilityMap]);

  return (
    <div className="calendar-grid">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-600 uppercase py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => (
          <DayCell
            key={index}
            date={day.date}
            dayNumber={day.dayNumber}
            isCurrentMonth={day.isCurrentMonth}
            isPast={day.isPast}
            availability={day.availability}
          />
        ))}
      </div>
    </div>
  );
}

// Individual day cell component
interface DayCellProps {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  availability?: AvailabilityDay;
}

function DayCell({ date, dayNumber, isCurrentMonth, isPast, availability }: DayCellProps) {
  // Get color based on availability status
  const getStatusColor = () => {
    if (!isCurrentMonth || isPast) return 'bg-gray-100 text-gray-400';
    if (!availability) return 'bg-gray-50 text-gray-700';

    switch (availability.status) {
      case 'full':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'moderate':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      case 'limited':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'booked':
        return 'bg-red-500 text-white hover:bg-red-600';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getStatusLabel = () => {
    if (!availability) return undefined;

    switch (availability.availableCount) {
      case 3:
        return '3 available';
      case 2:
        return '2 available';
      case 1:
        return '1 available';
      case 0:
        return 'Fully booked';
      default:
        return undefined;
    }
  };

  const isToday =
    date.toDateString() === new Date().toDateString();

  return (
    <div
      className={cn(
        'relative aspect-square rounded-lg flex flex-col items-center justify-center',
        'transition-all duration-200 cursor-default',
        getStatusColor(),
        isToday && 'ring-2 ring-blue-600 ring-offset-2',
        !isPast && isCurrentMonth && 'hover:shadow-md',
        isPast && 'cursor-not-allowed'
      )}
      title={getStatusLabel()}
    >
      <span className={cn(
        'text-lg font-semibold',
        !isCurrentMonth && 'opacity-30'
      )}>
        {dayNumber}
      </span>

      {availability && isCurrentMonth && !isPast && (
        <span className="text-xs font-medium mt-0.5 opacity-90">
          {availability.availableCount}
        </span>
      )}

      {isToday && (
        <div className="absolute -bottom-1 w-1.5 h-1.5 bg-blue-600 rounded-full" />
      )}
    </div>
  );
}
```

### 2.3 Legend Component

Create `/src/components/calendar/AvailabilityLegend.tsx`:

```typescript
export function AvailabilityLegend() {
  const legendItems = [
    { color: 'bg-green-500', label: '3 units available', status: 'Full availability' },
    { color: 'bg-yellow-500', label: '2 units available', status: 'Moderate' },
    { color: 'bg-orange-500', label: '1 unit available', status: 'Limited' },
    { color: 'bg-red-500', label: 'Fully booked', status: 'No availability' },
  ];

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Availability Legend</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', item.color)} />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-900">{item.label}</span>
              <span className="text-xs text-gray-500">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.4 Timezone Handling & Date Validation

The Okaeri Resort operates in **Philippine Time (Asia/Manila, UTC+8)**. All dates must be normalized to this timezone before API calls and display.

#### Install date-fns-tz

```bash
npm install date-fns date-fns-tz
```

#### Create Timezone Utility

Create `/src/lib/timezone.ts`:

```typescript
import { format, parseISO } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

// Philippine timezone
const TIMEZONE = "Asia/Manila"; // UTC+8

/**
 * Convert user's local Date to Philippine Time
 * Used for displaying dates in the calendar
 */
export function toPhilippineTime(date: Date): Date {
  return utcToZonedTime(date, TIMEZONE);
}

/**
 * Format date for display in Philippine Time
 */
export function formatPhilippineDate(date: Date, formatStr: string = "PPP"): string {
  const zonedDate = toPhilippineTime(date);
  return format(zonedDate, formatStr);
}

/**
 * Convert Philippine Time to ISO date string for API calls
 * Normalizes to YYYY-MM-DD format (timezone-neutral)
 */
export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get today's date in Philippine Time (normalized to midnight)
 */
export function getTodayPhilippineTime(): Date {
  const now = new Date();
  const zonedNow = toPhilippineTime(now);
  zonedNow.setHours(0, 0, 0, 0);
  return zonedNow;
}

/**
 * Check if a date is in the past (Philippine Time)
 */
export function isPastDate(date: Date): boolean {
  const today = getTodayPhilippineTime();
  const zonedDate = toPhilippineTime(date);
  zonedDate.setHours(0, 0, 0, 0);
  return zonedDate < today;
}

/**
 * Check if a date exceeds 1 year from today (Philippine Time)
 */
export function isTooFarInFuture(date: Date): boolean {
  const today = getTodayPhilippineTime();
  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const zonedDate = toPhilippineTime(date);
  zonedDate.setHours(0, 0, 0, 0);
  return zonedDate > oneYearFromNow;
}

/**
 * Get first day of month in Philippine Time
 */
export function getMonthStart(date: Date): Date {
  const zonedDate = toPhilippineTime(date);
  return new Date(zonedDate.getFullYear(), zonedDate.getMonth(), 1);
}

/**
 * Get last day of month in Philippine Time
 */
export function getMonthEnd(date: Date): Date {
  const zonedDate = toPhilippineTime(date);
  return new Date(zonedDate.getFullYear(), zonedDate.getMonth() + 1, 0);
}
```

#### Update fetchAvailability with Timezone Handling

Update `/src/components/calendar/PublicAvailabilityCalendar.tsx`:

```typescript
import { toISODateString, getMonthStart, getMonthEnd } from "@/lib/timezone";

// Update fetchAvailability function
async function fetchAvailability(month: Date): Promise<AvailabilityResponse> {
  // Convert to Philippine Time and get month boundaries
  const startDate = getMonthStart(month);
  const endDate = getMonthEnd(month);

  // Convert to ISO date strings for API (YYYY-MM-DD, timezone-neutral)
  const startISO = toISODateString(startDate);
  const endISO = toISODateString(endDate);

  const response = await fetch(`/api/public/v1/availability?start=${startISO}&end=${endISO}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch availability");
  }

  return response.json();
}
```

#### Frontend Date Validation

Add validation utility in `/src/lib/validation/calendar.ts`:

```typescript
import { isPastDate, isTooFarInFuture } from "@/lib/timezone";

export interface DateValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a date for calendar queries
 * - Cannot be in the past
 * - Cannot be more than 1 year in the future
 */
export function validateCalendarDate(date: Date): DateValidationResult {
  if (isPastDate(date)) {
    return {
      valid: false,
      error: "Cannot query past dates. Please select a date from today onwards.",
    };
  }

  if (isTooFarInFuture(date)) {
    return {
      valid: false,
      error: "Cannot query more than 1 year in the future.",
    };
  }

  return { valid: true };
}

/**
 * Validate a month for calendar navigation
 */
export function validateMonth(month: Date): DateValidationResult {
  // Check first day of month
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  return validateCalendarDate(firstDay);
}
```

#### Update Calendar Component with Validation

Update `/src/components/calendar/PublicAvailabilityCalendar.tsx`:

```typescript
import { validateMonth } from "@/lib/validation/calendar";
import { getTodayPhilippineTime } from "@/lib/timezone";

export function PublicAvailabilityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(getTodayPhilippineTime());

  // Fetch availability data with timezone handling
  const { data, isLoading, error, isFetching } = useQuery<AvailabilityResponse>({
    queryKey: ["publicAvailability", currentMonth.toISOString()],
    queryFn: () => fetchAvailability(currentMonth),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    retry: 2,
    // Only fetch if month is valid
    enabled: validateMonth(currentMonth).valid,
  });

  // Navigation handlers with validation
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate to past month:", validation.error);
    }
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate more than 1 year ahead:", validation.error);
    }
  };

  const goToToday = () => {
    setCurrentMonth(getTodayPhilippineTime());
  };

  // ... rest of component
}
```

**Key Points**:

- All dates are converted to Philippine Time (UTC+8) before display
- ISO date strings (`YYYY-MM-DD`) are used for API calls (timezone-neutral)
- Frontend validation prevents queries for past dates and dates >1 year ahead
- Calendar automatically uses Philippine Time for "today" detection
- User's browser timezone is irrelevant - all dates normalized to Asia/Manila

---

## Step 3: Mobile Optimization

### 3.1 Add Touch Gestures (Optional Enhancement)

Create `/src/components/calendar/useSwipeGesture.ts`:

```typescript
import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
}: SwipeGestureOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (touchStartX.current === null || touchEndX.current === null) return;

      const distance = touchStartX.current - touchEndX.current;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }

      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }

      // Reset
      touchStartX.current = null;
      touchEndX.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance]);
}
```

Update `PublicAvailabilityCalendar.tsx` to use swipe gestures:

```typescript
// Add to imports
import { useSwipeGesture } from "./useSwipeGesture";

// Inside component, after useState declarations
useSwipeGesture({
  onSwipeLeft: goToNextMonth,
  onSwipeRight: goToPreviousMonth,
});
```

---

## Step 4: Styling & Polish

### 4.1 Add Custom CSS (Optional)

Create `/src/styles/calendar.css`:

```css
/* Calendar animations */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.calendar-grid {
  animation: fade-in 0.3s ease-out;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .calendar-grid {
    font-size: 0.875rem;
  }
}

/* Accessibility: High contrast mode */
@media (prefers-contrast: high) {
  .bg-green-500 {
    @apply bg-green-700;
  }
  .bg-yellow-500 {
    @apply bg-yellow-700;
  }
  .bg-orange-500 {
    @apply bg-orange-700;
  }
  .bg-red-500 {
    @apply bg-red-700;
  }
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }
}
```

Import in `/src/App.tsx`:

```typescript
import "./styles/calendar.css";
```

---

## Step 4.5: SEO & Structured Data

### Add JSON-LD Structured Data

Add structured data to help search engines understand the calendar page. Update `/src/routes/calendar.tsx`:

```typescript
function AvailabilityPage() {
  // JSON-LD structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "name": "Okaeri Resort",
    "description": "Beachfront resort in Taboc, La Union with 3 available units",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Taboc",
      "addressRegion": "La Union",
      "addressCountry": "PH"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "16.6158",  // Replace with actual coordinates
      "longitude": "120.3209"
    },
    "url": "https://okaeri-resort.com",
    "image": "https://okaeri-resort.com/images/resort-main.jpg",
    "amenityFeature": [
      { "@type": "LocationFeatureSpecification", "name": "Beach Access" },
      { "@type": "LocationFeatureSpecification", "name": "WiFi" }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Add structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* ... rest of component ... */}
    </div>
  );
}
```

### SEO Checklist

Before deploying, verify:

- [ ] **Title tag** is descriptive and < 60 characters
- [ ] **Meta description** is compelling and < 160 characters
- [ ] **Keywords meta tag** includes relevant search terms
- [ ] **Open Graph tags** for Facebook/LinkedIn sharing
- [ ] **Twitter Card tags** for Twitter sharing
- [ ] **Canonical URL** to prevent duplicate content issues
- [ ] **Structured data** validates on [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] **Mobile-friendly** test passes
- [ ] **Page speed** > 90 on Lighthouse

**Note:** This MVP uses client-side rendering with strong meta tags. SSR/SSG upgrade can be added post-MVP if SEO metrics require it.

### robots.txt Configuration

Ensure `/public/robots.txt` allows indexing:

```
User-agent: *
Allow: /calendar
Sitemap: https://okaeri-resort.com/sitemap.xml
```

### sitemap.xml Entry

Add to `/public/sitemap.xml`:

```xml
<url>
  <loc>https://okaeri-resort.com/calendar</loc>
  <lastmod>2025-01-10</lastmod>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>
```

---

## Step 5: Testing

### 5.1 Manual Testing Checklist

**Desktop (Chrome, Firefox, Safari)**:

- [ ] Calendar loads without errors
- [ ] Current month displays correctly in Philippine Time
- [ ] Colors match availability counts (green/yellow/orange/red)
- [ ] Month navigation works (previous/next)
- [ ] "Today" button returns to current month (Philippine Time)
- [ ] Past dates are grayed out (based on Philippine Time)
- [ ] Today's date has blue ring indicator
- [ ] Hover states work on day cells
- [ ] Legend displays correctly
- [ ] Cannot navigate to past months (validation works)
- [ ] Cannot navigate >1 year in future (validation works)
- [ ] View-only information box displays correctly
- [ ] Footer links work correctly
- [ ] Loading state shows spinner
- [ ] Error state displays message

**Mobile (iOS Safari, Android Chrome)**:

- [ ] Calendar is fully visible without horizontal scroll
- [ ] Day cells have adequate touch targets (min 44x44px)
- [ ] Swipe gestures work for month navigation
- [ ] Calendar renders correctly in portrait and landscape
- [ ] Text is readable without zooming
- [ ] No layout shift (CLS < 0.1)
- [ ] View-only message clearly visible
- [ ] Footer links are tappable (min 44x44px touch target)

**Accessibility**:

- [ ] Keyboard navigation works (Tab through buttons, Arrow keys between days)
- [ ] Screen reader announces month and availability
- [ ] Calendar uses `role="grid"` with proper ARIA attributes
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Color-blind indicators (icons + patterns, not just colors)
- [ ] Focus indicators visible (2px outline minimum)
- [ ] Alt text on all icons and interactive elements

---

## Step 6: Performance Optimization

### 6.1 Lazy Load Calendar Component

Update `/src/routes/calendar.tsx`:

```typescript
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load calendar component
const PublicAvailabilityCalendar = lazy(() =>
  import('@/components/calendar/PublicAvailabilityCalendar').then((mod) => ({
    default: mod.PublicAvailabilityCalendar,
  }))
);

function AvailabilityPage() {
  return (
    <div>
      {/* ... header ... */}

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <PublicAvailabilityCalendar />
      </Suspense>

      {/* ... CTAs ... */}
    </div>
  );
}
```

---

## Next Steps

✅ **Phase 2 Complete!** Frontend is now functional.

**Move to**: [Phase 3: Deployment & Testing](./03-phase-3-deployment.md)

---

**Estimated Completion Time**: 3-4 days
**Actual Time Spent**: _[Track here]_
**Blockers**: _[Document any issues]_
**Sign-off**: _[Tech lead approval]_
