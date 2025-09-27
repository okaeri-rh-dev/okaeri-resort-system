# 🪝 Custom React Hooks

## Overview

The `/src/hooks/` directory contains custom React hooks that encapsulate complex logic, state management, and side effects for the Okaeri Resort System. These hooks provide reusable functionality across components while maintaining clean separation of concerns.

## 📁 Directory Structure

```
hooks/
├── index.ts                    # Hook exports
├── useAvailability.ts         # Availability checking hook
├── useCalendarBookings.ts     # Calendar data management
├── useCleanup.ts              # Resource cleanup utilities
├── useResponsiveView.ts       # Responsive design helpers
├── useSearch.ts               # Advanced search functionality
└── useWorkflowSearch.phase3-4.ts # Workflow search (Phase 3-4)
```

## 📦 Hook Documentation

### `useAvailability` - Real-time Availability Management
**File Size**: 11.8KB
**Purpose**: Manages unit availability checking with real-time updates

**Features**:
- Real-time availability status
- Caching with TanStack Query
- Optimistic updates
- Conflict detection

**Usage**:
```typescript
import { useAvailability } from '@/hooks/useAvailability'

function BookingForm() {
  const {
    checkAvailability,
    availableUnits,
    isChecking,
    conflicts,
    refreshAvailability
  } = useAvailability({
    unitId: 'unit-123',
    dateRange: { start: checkIn, end: checkOut }
  })

  // Check availability for specific dates
  const handleDateChange = async (dates) => {
    const available = await checkAvailability(dates)
    if (!available) {
      toast.error('Unit not available for selected dates')
    }
  }

  // Real-time updates
  useEffect(() => {
    const unsubscribe = refreshAvailability()
    return unsubscribe
  }, [])

  return (
    <div>
      {isChecking && <Spinner />}
      {availableUnits.map(unit => (
        <UnitCard key={unit.id} {...unit} />
      ))}
    </div>
  )
}
```

**Return Type**:
```typescript
interface UseAvailabilityReturn {
  checkAvailability: (dates: DateRange) => Promise<boolean>
  availableUnits: Unit[]
  isChecking: boolean
  conflicts: BookingConflict[]
  refreshAvailability: () => () => void
  clearCache: () => void
}
```

### `useSearch` - Advanced Search & Filtering
**File Size**: 20KB
**Purpose**: Comprehensive search functionality with debouncing and caching

**Features**:
- Full-text search
- Multi-criteria filtering
- Search history
- Result caching
- Debounced input

**Usage**:
```typescript
import { useSearch } from '@/hooks/useSearch'

function SearchPanel() {
  const {
    searchQuery,
    setSearchQuery,
    results,
    isSearching,
    filters,
    updateFilter,
    clearFilters,
    searchHistory,
    saveSearch
  } = useSearch({
    searchType: 'bookings',
    debounceMs: 300,
    minQueryLength: 2
  })

  return (
    <div>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search bookings..."
      />

      <FilterPanel>
        <Select
          value={filters.status}
          onChange={(value) => updateFilter('status', value)}
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </Select>
      </FilterPanel>

      {isSearching ? (
        <LoadingSpinner />
      ) : (
        <ResultsList results={results} />
      )}
    </div>
  )
}
```

**Configuration Options**:
```typescript
interface UseSearchOptions {
  searchType: 'bookings' | 'guests' | 'units' | 'payments'
  debounceMs?: number        // Default: 300
  minQueryLength?: number    // Default: 2
  maxResults?: number        // Default: 50
  cacheResults?: boolean     // Default: true
  persistHistory?: boolean  // Default: true
}
```

### `useCalendarBookings` - Calendar View Management
**File Size**: 4KB
**Purpose**: Manages booking data for calendar visualization

**Features**:
- Calendar event formatting
- Date range calculations
- Booking overlap detection
- Drag-and-drop support

**Usage**:
```typescript
import { useCalendarBookings } from '@/hooks/useCalendarBookings'

function BookingCalendar() {
  const {
    calendarEvents,
    selectedDate,
    setSelectedDate,
    bookingsByDate,
    moveBooking,
    isLoading
  } = useCalendarBookings({
    startDate: firstDayOfMonth,
    endDate: lastDayOfMonth,
    unitFilter: selectedUnit
  })

  const handleBookingDrop = (bookingId, newDate) => {
    moveBooking(bookingId, newDate)
  }

  return (
    <Calendar
      events={calendarEvents}
      selected={selectedDate}
      onSelect={setSelectedDate}
      onEventDrop={handleBookingDrop}
      loading={isLoading}
    />
  )
}
```

### `useResponsiveView` - Responsive Design Utilities
**File Size**: 4.6KB
**Purpose**: Manages responsive behavior and mobile optimizations

**Features**:
- Breakpoint detection
- Orientation tracking
- Touch gesture support
- Viewport utilities

**Usage**:
```typescript
import { useResponsiveView } from '@/hooks/useResponsiveView'

function ResponsiveComponent() {
  const {
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    viewportSize,
    breakpoint
  } = useResponsiveView()

  // Conditional rendering based on device
  if (isMobile) {
    return <MobileView />
  }

  return (
    <div className={`layout-${breakpoint}`}>
      {isTablet ? <TabletLayout /> : <DesktopLayout />}
      <span>Viewport: {viewportSize.width}x{viewportSize.height}</span>
    </div>
  )
}
```

**Breakpoint Configuration**:
```typescript
// Default breakpoints (customizable)
{
  mobile: 640,   // < 640px
  tablet: 1024,  // 640px - 1024px
  desktop: 1280, // > 1024px
  wide: 1536     // > 1536px
}
```

### `useCleanup` - Resource Management
**File Size**: 5.6KB
**Purpose**: Handles cleanup of subscriptions, timers, and resources

**Features**:
- Automatic subscription cleanup
- Timer management
- Memory leak prevention
- Debug mode for tracking

**Usage**:
```typescript
import { useCleanup } from '@/hooks/useCleanup'

function RealtimeComponent() {
  const { register, cleanup, isActive } = useCleanup()

  useEffect(() => {
    // Register subscription for cleanup
    const subscription = supabase
      .channel('bookings')
      .on('*', handleChange)
      .subscribe()

    register('booking-subscription', () => subscription.unsubscribe())

    // Register timer for cleanup
    const timer = setInterval(pollData, 5000)
    register('poll-timer', () => clearInterval(timer))

    // Cleanup on unmount
    return cleanup
  }, [])

  return <div>Component with managed resources</div>
}
```

### `useWorkflowSearch.phase3-4` - Workflow Search (Future)
**File Size**: 19.7KB
**Purpose**: Advanced workflow search for Phase 3-4 features

**Note**: This hook is prepared for future workflow features and is not active in Phase 2.

## 🏗️ Hook Patterns

### State Management Pattern
Hooks integrate with Zustand stores:
```typescript
export function useBookingState() {
  const store = useBookingStore()
  const query = useBookingQuery()

  return {
    ...store,
    ...query,
    isLoading: store.isLoading || query.isLoading
  }
}
```

### Error Handling Pattern
Consistent error handling across hooks:
```typescript
export function useDataFetch() {
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      const data = await apiCall()
      return { data, error: null }
    } catch (err) {
      setError(err.message)
      return { data: null, error: err.message }
    }
  }

  return { fetchData, error }
}
```

### Cleanup Pattern
All hooks properly clean up resources:
```typescript
export function useSubscription() {
  useEffect(() => {
    const subscription = createSubscription()

    return () => {
      subscription.unsubscribe()
    }
  }, [dependencies])
}
```

## 🚀 Best Practices

1. **Always Handle Loading States**
   ```typescript
   const { data, isLoading, error } = useCustomHook()
   if (isLoading) return <Spinner />
   if (error) return <ErrorMessage />
   ```

2. **Memoize Expensive Computations**
   ```typescript
   const computedValue = useMemo(() =>
     expensiveComputation(data), [data]
   )
   ```

3. **Use Cleanup Hooks**
   ```typescript
   const cleanup = useCleanup()
   // Register all subscriptions and timers
   ```

4. **Prefer Composition**
   ```typescript
   // Compose smaller hooks
   const useBookingForm = () => {
     const availability = useAvailability()
     const search = useSearch()
     return { ...availability, ...search }
   }
   ```

## 🔒 Security Considerations

- Hooks sanitize user inputs before API calls
- Authentication checks in data-fetching hooks
- Rate limiting for search operations
- Secure token handling in auth hooks

## 📊 Performance Optimizations

- Debounced search inputs (300ms default)
- Memoized calculations
- Lazy loading for heavy components
- Virtual scrolling for large lists
- Request deduplication

## 🧪 Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-hooks'
import { useSearch } from '@/hooks/useSearch'

test('search hook debounces input', async () => {
  const { result } = renderHook(() => useSearch())

  act(() => {
    result.current.setSearchQuery('test')
  })

  // Wait for debounce
  await waitFor(() => {
    expect(result.current.results).toHaveLength(5)
  })
})
```

## 📚 Related Documentation

- [Component Documentation](/src/components/README.md) - Components using these hooks
- [State Management](/src/stores/README.md) - Zustand stores
- [Utils Documentation](/src/utils/README.md) - Utility functions used by hooks
- [Type Definitions](/src/types/README.md) - Hook type definitions

## 🔧 Development Notes

- **TypeScript**: All hooks are fully typed with generics where applicable
- **React 19**: Hooks utilize React 19 features like `use()` and transitions
- **Phase 2**: Core hooks complete and tested
- **Phase 3-4**: Workflow hooks prepared for future implementation