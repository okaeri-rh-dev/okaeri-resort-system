# High-Performance Availability System for Okaeri Resort System

## Overview

This document describes the optimized availability checking system designed for
Neon PostgreSQL in a serverless environment. The system delivers sub-100ms
response times, intelligent caching, and comprehensive conflict detection while
maintaining data consistency and scalability.

## Architecture Overview

### Core Components

1. **Database Enhancements** (`/database/availability-enhancements.sql`)
   - Advanced GiST indexes for date range queries
   - Stored procedures for complex availability logic
   - Automatic cache invalidation triggers
   - Blackout period management

2. **TypeScript Utilities** (`/src/lib/availability.ts`)
   - High-performance availability checking functions
   - Batch operations for multiple units
   - Cache management utilities
   - Date validation and formatting

3. **React Hooks** (`/src/hooks/useAvailability.ts`)
   - Reactive availability checking with caching
   - Real-time availability updates
   - Optimistic updates for better UX
   - Performance monitoring

4. **Enhanced Stores** (`/src/stores/useBookingStore.ts`)
   - Integration with existing booking flow
   - Optimized query patterns
   - Cache invalidation strategies

## Performance Optimizations

### Database Level

#### 1. Advanced Indexing Strategy

```sql
-- Primary availability index using GiST for date ranges
CREATE INDEX idx_bookings_availability_primary
ON bookings USING gist (
    unit_id,
    daterange(check_in, check_out, '[]')
) WHERE booking_status NOT IN ('Cancelled');

-- Supporting indexes for common query patterns
CREATE INDEX idx_bookings_status_dates
ON bookings (booking_status, check_in, check_out)
WHERE booking_status NOT IN ('Cancelled');
```

#### 2. Optimized Query Functions

- `check_unit_availability_fast()`: Sub-100ms single unit checks
- `check_multi_unit_availability()`: Batch availability with filtering
- `get_unit_availability_calendar()`: Calendar UI optimization

#### 3. Intelligent Caching

- Pre-computed availability for common date ranges
- Automatic cache invalidation on booking changes
- Configurable cache retention (default: 1 hour)

### Application Level

#### 1. Connection Pooling Optimization

```typescript
// Optimized for Neon PostgreSQL serverless
const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Connection pooling handled by Supabase client
});
```

#### 2. Query Deduplication

React Query automatically deduplicates identical availability requests within
the stale time window.

#### 3. Optimistic Updates

```typescript
const { updateOptimistically, revertOptimisticUpdate } = useOptimisticAvailability();

// Immediately update UI, revert on error
updateOptimistically(unitId, checkIn, checkOut, false);
```

## Usage Guide

### Basic Availability Check

```typescript
import { useUnitAvailabilityFast } from "@/stores/useBookingStore";

function BookingForm() {
  const { data: availability, isLoading } = useUnitAvailabilityFast(unitId, checkIn, checkOut);

  if (availability?.isAvailable) {
    // Unit is available for booking
  }
}
```

### Multi-Unit Search

```typescript
import { useMultiUnitAvailability } from '@/stores/useBookingStore';

function UnitSelector() {
  const { data: availableUnits } = useMultiUnitAvailability(
    checkIn,
    checkOut,
    {
      unitTypes: ['Studio', 'One Bedroom'],
      minOccupancy: 2,
      maxRate: 5000,
      limit: 10,
    }
  );

  return (
    <div>
      {availableUnits?.map(unit => (
        <UnitCard key={unit.unit_id} unit={unit} />
      ))}
    </div>
  );
}
```

### Calendar Integration

```typescript
import { useAvailabilityCalendar } from '@/stores/useBookingStore';

function AvailabilityCalendar({ unitId }: { unitId: string }) {
  const { data: calendar } = useAvailabilityCalendar(
    unitId,
    startDate,
    endDate
  );

  return (
    <Calendar>
      {calendar?.map(day => (
        <Day
          key={day.date}
          date={day.date}
          status={day.status}
          booking={day.bookingReference}
        />
      ))}
    </Calendar>
  );
}
```

### Blackout Period Management

```typescript
import { useCreateBlackout, useUnitBlackouts } from "@/stores/useBookingStore";

function MaintenanceScheduler() {
  const createBlackout = useCreateBlackout();
  const { data: blackouts } = useUnitBlackouts(unitId);

  const handleScheduleMaintenance = async () => {
    await createBlackout.mutateAsync({
      unitId,
      blackoutType: "Maintenance",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      reason: "AC repair",
      createdBy: "admin@example.com",
    });
  };
}
```

## Performance Monitoring

### Cache Metrics

```typescript
import { useAvailabilityCache } from '@/stores/useBookingStore';

function AdminDashboard() {
  const { getCacheMetrics } = useAvailabilityCache();
  const { data: metrics } = getCacheMetrics;

  return (
    <div>
      <p>Cache Hit Ratio: {metrics?.cache_hit_ratio_percent}%</p>
      <p>Valid Entries: {metrics?.valid_cache_entries}</p>
    </div>
  );
}
```

### Query Performance

```typescript
import { useAvailabilityPerformance } from '@/hooks/useAvailability';

function PerformanceMonitor() {
  const { getQueryStats } = useAvailabilityPerformance();
  const stats = getQueryStats();

  return (
    <div>
      <p>Average Query Time: {stats.averageQueryTime}ms</p>
      <p>Success Rate: {(stats.successfulQueries / stats.totalQueries * 100).toFixed(1)}%</p>
    </div>
  );
}
```

## Serverless Optimization

### Cold Start Mitigation

1. **Connection Warmup**: Supabase client maintains persistent connections
2. **Query Preparation**: Database functions are pre-compiled
3. **Index Warmup**: Frequently accessed indexes stay in memory

### Resource Efficiency

1. **Connection Pooling**: Managed automatically by Supabase
2. **Query Batching**: Multiple availability checks in single request
3. **Result Caching**: Reduces database load for repeated queries

### Monitoring Cold Starts

```typescript
// Track performance metrics
const startTime = performance.now();
const result = await checkUnitAvailability(unitId, checkIn, checkOut);
const duration = performance.now() - startTime;

// Log slow queries (>100ms)
if (duration > 100) {
  console.warn(`Slow availability check: ${duration}ms`);
}
```

## Migration Guide

### 1. Database Migration

```bash
# Apply availability enhancements
psql -f database/availability-enhancements.sql

# Verify indexes are created
\d+ bookings
```

### 2. Update Application Code

```typescript
// Replace old availability checks
- const { data } = await db.bookings.checkAvailability(unitId, checkIn, checkOut);
+ const { data } = useUnitAvailabilityFast(unitId, checkIn, checkOut);
```

### 3. Cache Initialization

```typescript
// Initialize cache for all units
import { refreshAvailabilityCache } from "@/lib/availability";

await refreshAvailabilityCache(); // Refresh all units
await refreshAvailabilityCache(unitId, 30); // Specific unit, 30 days
```

## Testing Strategy

### Unit Tests

```typescript
import { formatAvailabilityMessage, validateDateRange } from "@/lib/availability";

describe("Availability Utils", () => {
  test("validates date ranges correctly", () => {
    const result = validateDateRange("2024-01-15", "2024-01-17");
    expect(result.isValid).toBe(true);
  });

  test("formats availability messages", () => {
    const message = formatAvailabilityMessage({
      isAvailable: false,
      conflictingBookings: 1,
      blackoutPeriods: 0,
      unitStatus: "Available",
    });
    expect(message).toContain("1 conflicting booking");
  });
});
```

### Integration Tests

```typescript
import { renderHook, waitFor } from "@testing-library/react";

import { useUnitAvailabilityFast } from "@/stores/useBookingStore";

describe("Availability Hooks", () => {
  test("returns availability result", async () => {
    const { result } = renderHook(() =>
      useUnitAvailabilityFast("unit-1", "2024-01-15", "2024-01-17")
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(typeof result.current.data.isAvailable).toBe("boolean");
    });
  });
});
```

### Performance Tests

```typescript
describe("Performance Tests", () => {
  test("availability check completes within 100ms", async () => {
    const start = performance.now();

    await checkUnitAvailability("unit-1", "2024-01-15", "2024-01-17");

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test("batch availability check scales linearly", async () => {
    const units = ["unit-1", "unit-2", "unit-3"];
    const start = performance.now();

    await batchCheckUnitAvailability(units, "2024-01-15", "2024-01-17");

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200); // Should be faster than individual checks
  });
});
```

## Troubleshooting

### Common Issues

#### 1. Slow Query Performance

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE SELECT * FROM bookings
WHERE unit_id = 'unit-1'
AND daterange(check_in, check_out, '[]') && daterange('2024-01-15', '2024-01-17', '[]');
```

#### 2. Cache Miss Issues

```typescript
// Force cache refresh
const { refreshCache } = useAvailabilityCache();
await refreshCache.mutateAsync({ unitId: "unit-1" });
```

#### 3. Connection Pool Exhaustion

```typescript
// Monitor active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

### Performance Debugging

```typescript
// Enable query debugging
const debug = process.env.NODE_ENV === "development";

if (debug) {
  console.time("availability-check");
}

const result = await checkUnitAvailability(unitId, checkIn, checkOut);

if (debug) {
  console.timeEnd("availability-check");
}
```

## Best Practices

### 1. Date Validation

Always validate date ranges before making availability requests:

```typescript
const validation = validateDateRange(checkIn, checkOut);
if (!validation.isValid) {
  throw new Error(validation.error);
}
```

### 2. Error Handling

Implement proper error boundaries and retry logic:

```typescript
const { data, error, retry } = useUnitAvailabilityFast(
  unitId,
  checkIn,
  checkOut,
  undefined,
  { enabled: !!unitId && !!checkIn && !!checkOut }
);

if (error) {
  return <ErrorBoundary onRetry={retry} />;
}
```

### 3. Cache Management

Refresh cache after significant booking changes:

```typescript
const createBooking = useCreateBooking();
const { refreshCache } = useAvailabilityCache();

const handleBookingCreate = async (bookingData) => {
  await createBooking.mutateAsync(bookingData);
  await refreshCache.mutateAsync({ unitId: bookingData.unit_id });
};
```

### 4. Optimistic Updates

Use optimistic updates for immediate UI feedback:

```typescript
const { updateOptimistically } = useOptimisticAvailability();

// Immediately show as unavailable when booking starts
updateOptimistically(unitId, checkIn, checkOut, false);
```

## Security Considerations

### 1. Row Level Security

Ensure RLS policies are applied to new tables:

```sql
ALTER TABLE availability_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_cache ENABLE ROW LEVEL SECURITY;
```

### 2. Input Validation

Validate all date inputs on both client and server:

```typescript
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!datePattern.test(checkIn)) {
  throw new Error("Invalid date format");
}
```

### 3. Rate Limiting

Implement rate limiting for availability checks:

```typescript
// Using a simple in-memory rate limiter
const rateLimiter = new Map();

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const requests = rateLimiter.get(key) || [];
  const recentRequests = requests.filter((time) => now - time < 60000); // 1 minute

  if (recentRequests.length >= 60) {
    // 60 requests per minute
    throw new Error("Rate limit exceeded");
  }

  rateLimiter.set(key, [...recentRequests, now]);
};
```

## Conclusion

This optimized availability system provides:

- **Sub-100ms response times** for availability checks
- **Intelligent caching** with automatic invalidation
- **Scalable architecture** suitable for high-traffic scenarios
- **Real-time updates** with optimistic UI patterns
- **Comprehensive monitoring** and debugging tools

The system is designed to grow with your resort business while maintaining
excellent performance in Neon PostgreSQL's serverless environment.
