# Phase 2: Type Safety & Performance Optimization

## Implementation Guide

**Phase Duration:** 2 Days
**Priority:** HIGH - P1
**Prerequisites:** Phase 1 Complete
**Dependencies:** Bundle analyzer, React DevTools Profiler

---

## Overview

Phase 2 focuses on eliminating type safety violations and implementing performance optimizations. These improvements will prevent runtime errors, reduce bundle size, and enhance user experience through faster load times and smoother interactions.

---

## Type Safety Issues to Resolve

### 1. Remove All 'any' Types

#### Current Violations

```typescript
// CURRENT VIOLATIONS - Must be fixed
// File: /src/stores/useBookingStore.ts
Line 410: const updates: any = { payment_status: paymentStatus };
Line 426: if (paymentMethod) updates.payment_method = paymentMethod as any;
Line 695: return (data || []).map((unit: any) => ({
Line 736: return (data || []).map((day: any) => ({
Line 771: return data?.filter((blackout: any) => blackout.unit_id === unitId) || [];

// File: /src/lib/supabase.ts
Line 24: export const handleSupabaseError = (error: any): string => {

// File: /src/lib/auth.ts
Line 99: onAuthStateChange(callback: (event: string, session: any) => void) {

// File: /src/providers/QueryProvider.tsx
Lines 183-206: Generic utility functions using any[] and { [key: string]: any }
```

#### Solution: Proper Type Definitions

```typescript
// File: /src/types/supabase.ts - NEW FILE
// Define all Supabase response types

export interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  status?: number;
}

export interface UnitAvailabilityResponse {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string;
  max_occupancy: number;
  base_rate: number;
  weekend_rate: number;
  is_available: boolean;
  next_available_date?: string;
}

export interface CalendarDayResponse {
  calendar_date: string;
  status: 'available' | 'booked' | 'blackout';
  booking_id?: string;
  guest_name?: string;
  booking_reference?: string;
}

export interface BlackoutResponse {
  blackout_id: string;
  unit_id: string;
  blackout_type: 'Maintenance' | 'Renovation' | 'Seasonal' | 'Manual';
  start_date: string;
  end_date: string;
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  aud: string;
  role?: string;
  email?: string;
  email_confirmed_at?: string;
  created_at: string;
  updated_at?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

// File: /src/lib/supabase.ts - UPDATED
import { SupabaseError } from '@/types/supabase';

export const handleSupabaseError = (error: SupabaseError): string => {
  // Sanitized error messages for production
  if (process.env.NODE_ENV === 'production') {
    const errorMap: Record<string, string> = {
      '23505': 'This record already exists',
      '23503': 'Cannot delete due to existing references',
      '42P01': 'Resource not found',
      '42501': 'Permission denied',
      'PGRST301': 'Authentication required',
    };

    return errorMap[error.code] || 'An error occurred. Please try again.';
  }

  // Detailed errors for development
  return error.message || 'Unknown error occurred';
};

// File: /src/stores/useBookingStore.ts - UPDATED
import type {
  UnitAvailabilityResponse,
  CalendarDayResponse,
  BlackoutResponse,
} from '@/types/supabase';

// Line 410 fix
interface PaymentStatusUpdate {
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  updated_at?: string;
}

const updates: PaymentStatusUpdate = {
  payment_status: paymentStatus,
};

if (paymentMethod) {
  updates.payment_method = paymentMethod;
}

// Line 695 fix
return (data || []).map((unit: UnitAvailabilityResponse) => ({
  unit_id: unit.unit_id,
  unit_name: unit.unit_name,
  unit_code: unit.unit_code,
  unit_type: unit.unit_type,
  max_occupancy: unit.max_occupancy,
  base_rate: unit.base_rate,
  weekend_rate: unit.weekend_rate,
  unit_status: "Available" as const,
  created_at: "",
  updated_at: "",
  isAvailable: unit.is_available,
  nextAvailableDate: unit.next_available_date,
}));

// Line 736 fix
return (data || []).map((day: CalendarDayResponse) => ({
  date: day.calendar_date,
  status: day.status,
  bookingId: day.booking_id,
  guestName: day.guest_name,
  bookingReference: day.booking_reference,
}));

// Line 771 fix
return data?.filter((blackout: BlackoutResponse) =>
  blackout.unit_id === unitId
) || [];

// File: /src/lib/auth.ts - UPDATED
import { AuthSession } from '@/types/supabase';

onAuthStateChange(
  callback: (
    event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
    session: AuthSession | null
  ) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
```

---

## Performance Optimizations

### 2. React.memo Implementation

#### Current Issue: Unnecessary Re-renders

```typescript
// File: /src/components/bookings/BookingTable.tsx - NEW OPTIMIZATION
import React, { memo, useCallback, useMemo } from 'react';

// Memoized table row component
const BookingRow = memo(({
  booking,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  booking: Booking;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
}) => {
  const handleEdit = useCallback(() => onEdit(booking.booking_id), [booking.booking_id, onEdit]);
  const handleDelete = useCallback(() => onDelete(booking.booking_id), [booking.booking_id, onDelete]);

  return (
    <tr>
      {/* Row content */}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for deep equality
  return (
    prevProps.booking.booking_id === nextProps.booking.booking_id &&
    prevProps.booking.updated_at === nextProps.booking.updated_at
  );
});

BookingRow.displayName = 'BookingRow';

// Memoized data grid component
export const BookingTable = memo(({ bookings }: { bookings: Booking[] }) => {
  // Memoize sorted and filtered data
  const processedBookings = useMemo(() => {
    return bookings
      .filter(/* filtering logic */)
      .sort(/* sorting logic */);
  }, [bookings]);

  // Memoize callbacks
  const handleEdit = useCallback((id: string) => {
    // Edit logic
  }, []);

  const handleDelete = useCallback((id: string) => {
    // Delete logic
  }, []);

  return (
    <table>
      <tbody>
        {processedBookings.map(booking => (
          <BookingRow
            key={booking.booking_id}
            booking={booking}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        ))}
      </tbody>
    </table>
  );
});

BookingTable.displayName = 'BookingTable';
```

### 3. Bundle Size Optimization

#### Implement Code Splitting

```typescript
// File: /src/App.tsx - UPDATED
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';

// Lazy load routes
const Dashboard = lazy(() => import('@/routes/_authenticated/dashboard'));
const Bookings = lazy(() => import('@/routes/_authenticated/bookings'));
const Units = lazy(() => import('@/routes/_authenticated/units'));
const Guests = lazy(() => import('@/routes/_authenticated/guests'));
const Expenses = lazy(() => import('@/routes/_authenticated/expenses'));
const Payments = lazy(() => import('@/routes/_authenticated/payments'));

// Wrap routes with Suspense
function LazyRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
}

// File: /src/components/bookings/BookingForm.tsx - OPTIMIZE LARGE COMPONENT
// Split into smaller chunks

// BookingFormStep1.tsx - NEW FILE
export const BookingFormStep1 = memo(({ form, units, onNext }) => {
  // Step 1 implementation
});

// BookingFormStep2.tsx - NEW FILE
export const BookingFormStep2 = memo(({ form, onNext, onPrevious }) => {
  // Step 2 implementation
});

// BookingFormStep3.tsx - NEW FILE
export const BookingFormStep3 = memo(({ form, onNext, onPrevious }) => {
  // Step 3 implementation
});

// BookingFormReview.tsx - NEW FILE
export const BookingFormReview = memo(({ form, onSubmit, onPrevious }) => {
  // Review step implementation
});

// Main BookingForm.tsx - REFACTORED
const BookingFormSteps = {
  1: lazy(() => import('./BookingFormStep1')),
  2: lazy(() => import('./BookingFormStep2')),
  3: lazy(() => import('./BookingFormStep3')),
  4: lazy(() => import('./BookingFormReview')),
};

export function BookingForm({ ... }) {
  const CurrentStep = BookingFormSteps[currentStep];

  return (
    <Suspense fallback={<BookingFormSkeleton />}>
      <CurrentStep {...stepProps} />
    </Suspense>
  );
}
```

### 4. Query Optimization

```typescript
// File: /src/hooks/useOptimizedQueries.ts - NEW FILE

import { useQueries, useQuery } from "@tanstack/react-query";

// Batch multiple queries
export function useBatchedBookingData(bookingIds: string[]) {
  return useQueries({
    queries: bookingIds.map((id) => ({
      queryKey: ["booking", id],
      queryFn: () => fetchBooking(id),
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    })),
    combine: (results) => {
      return {
        data: results.map((r) => r.data).filter(Boolean),
        isLoading: results.some((r) => r.isLoading),
        isError: results.some((r) => r.isError),
      };
    },
  });
}

// Implement request deduplication
export function useDeduplicatedBookings() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      // Check if we already have recent data
      const cachedData = queryClient.getQueryData(["bookings"]);
      const cacheTime = queryClient.getQueryState(["bookings"])?.dataUpdatedAt;

      if (cachedData && cacheTime && Date.now() - cacheTime < 30000) {
        return cachedData;
      }

      return fetchBookings();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: "always",
  });
}
```

### 5. Virtualization for Large Lists

```typescript
// File: /src/components/virtualized/VirtualizedBookingList.tsx - NEW FILE
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualizedBookingList({ bookings }: { bookings: Booking[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: bookings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <BookingRow booking={bookings[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Performance Metrics

### Before Optimization

```javascript
// Measure current performance
const metrics = {
  firstContentfulPaint: "3.2s",
  largestContentfulPaint: "5.8s",
  timeToInteractive: "7.2s",
  bundleSize: "892KB",
  memoryUsage: "125MB after 1hr",
};
```

### Target Metrics

```javascript
const targetMetrics = {
  firstContentfulPaint: "< 1.8s",
  largestContentfulPaint: "< 2.5s",
  timeToInteractive: "< 3.5s",
  bundleSize: "< 400KB",
  memoryUsage: "< 80MB after 1hr",
};
```

---

## Implementation Checklist

### Type Safety

- [ ] Remove all `any` types from stores
- [ ] Type all Supabase responses
- [ ] Add strict TypeScript configuration
- [ ] Define all component prop types
- [ ] Type all event handlers
- [ ] Add return types to all functions

### Performance Optimizations

- [ ] Implement React.memo on all list components
- [ ] Add useCallback for event handlers
- [ ] Add useMemo for expensive calculations
- [ ] Implement code splitting for routes
- [ ] Split BookingForm into smaller components
- [ ] Add virtualization for large lists
- [ ] Optimize bundle with tree shaking
- [ ] Implement request deduplication
- [ ] Add proper cache management

### Bundle Analysis

```bash
# Add bundle analyzer
npm install --save-dev webpack-bundle-analyzer

# Update vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      open: true,
      filename: 'bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
};

# Run analysis
npm run build -- --analyze
```

---

## Testing Strategy

### Type Coverage Testing

```bash
# Install type coverage tool
npm install --save-dev type-coverage

# Add to package.json
"scripts": {
  "type-coverage": "type-coverage --at-least 95",
  "type-check:strict": "tsc --noEmit --strict"
}

# Run coverage
npm run type-coverage
```

### Performance Testing

```javascript
// File: /src/tests/performance.test.ts
import { measurePerformance } from "@/utils/performance";

describe("Performance Metrics", () => {
  it("should render BookingTable in < 100ms", async () => {
    const startTime = performance.now();
    render(<BookingTable bookings={mockBookings} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100);
  });

  it("should maintain 60fps during scroll", async () => {
    const fps = await measureScrollPerformance();
    expect(fps).toBeGreaterThanOrEqual(60);
  });
});
```

---

## Rollback Strategy

If performance degrades:

1. **Revert Code Splitting**

   ```typescript
   // Temporarily remove lazy loading
   import Dashboard from "@/routes/_authenticated/dashboard";

   // Instead of: const Dashboard = lazy(...)
   ```

2. **Disable Memoization**

   ```typescript
   // Remove memo wrapper if causing issues
   export const BookingTable = ({ bookings }) => {
     // Component without memo
   };
   ```

3. **Restore Original Types**
   ```bash
   git checkout HEAD~1 -- src/types/
   ```

---

## Success Criteria

### Phase 2 Complete When:

- [ ] Zero `any` types in codebase
- [ ] 100% type coverage achieved
- [ ] Bundle size < 500KB
- [ ] FCP < 2 seconds
- [ ] TTI < 4 seconds
- [ ] All components memoized appropriately
- [ ] No performance regressions
- [ ] Memory usage stable

---

## Next Steps

1. Run lighthouse audit
2. Profile with React DevTools
3. Measure bundle size reduction
4. Validate type safety with strict mode
5. Proceed to Phase 3

---

**Document Version:** 1.0.0
**Phase Owner:** Performance Engineer
**Review Required By:** Tech Lead, Frontend Architect
**Estimated Completion:** 2 days from start
