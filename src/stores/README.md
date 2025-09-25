# 🗂️ State Management Documentation

## Overview

The Okaeri Resort System uses a hybrid state management approach combining **Zustand** for client-side application state and **TanStack Query** for server state management. This architecture provides optimal performance, developer experience, and data consistency.

## 🏗️ Architecture

### State Management Layers

```
┌─────────────────────────────────────────┐
│          Application Layer              │
├─────────────────────────────────────────┤
│     Zustand Stores    │  TanStack Query │
│   (Client State)      │  (Server State)  │
├─────────────────────────────────────────┤
│            Supabase Client              │
└─────────────────────────────────────────┘
```

### Store Categories

1. **Domain Stores**: Business logic and entity management
   - `useBookingStore` - Booking operations (41KB)
   - `useGuestStore` - Guest management (17KB)
   - `usePaymentStore` - Payment processing (14KB)
   - `useExpenseStore` - Expense tracking (13KB)
   - `useUnitStore` - Property unit management (11KB)

2. **UI Stores**: Interface state and user interactions
   - `useUIStore` - UI state, modals, notifications (10KB)
   - `useSearchStore` - Search, filters, pagination (27KB)

3. **Workflow Stores**: Business process orchestration
   - `useWorkflowStore` - Phase 3-4 workflow automation (21KB)

## 📦 Store Implementations

### BookingStore (Most Complex)

The booking store manages the entire booking lifecycle with complex state interactions.

```typescript
// Store Structure
interface BookingStore {
  // State
  bookings: Booking[]
  selectedBooking: Booking | null
  filters: BookingFilters
  isLoading: boolean
  error: string | null

  // Actions
  fetchBookings: (projectId: string) => Promise<void>
  createBooking: (data: CreateBookingData) => Promise<Booking>
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>
  deleteBooking: (id: string) => Promise<void>

  // Computed
  getBookingsByStatus: (status: BookingStatus) => Booking[]
  getBookingsByDateRange: (start: Date, end: Date) => Booking[]

  // Workflow Actions
  confirmBooking: (id: string) => Promise<void>
  checkInGuest: (id: string) => Promise<void>
  checkOutGuest: (id: string) => Promise<void>
  cancelBooking: (id: string, reason: string) => Promise<void>

  // Optimistic Updates
  optimisticUpdate: (id: string, updates: Partial<Booking>) => void
  rollbackOptimisticUpdate: (id: string) => void
}
```

**Usage Example**:

```typescript
import { useBookingStore } from '@/stores/useBookingStore'

function BookingManager() {
  const {
    bookings,
    isLoading,
    fetchBookings,
    createBooking,
    getBookingsByStatus
  } = useBookingStore()

  // Fetch bookings on mount
  useEffect(() => {
    fetchBookings(projectId)
  }, [projectId])

  // Get pending bookings
  const pendingBookings = getBookingsByStatus('pending')

  // Create new booking with optimistic update
  const handleCreateBooking = async (data: CreateBookingData) => {
    try {
      await createBooking(data)
      toast.success('Booking created successfully')
    } catch (error) {
      toast.error('Failed to create booking')
    }
  }
}
```

### SearchStore (Complex Filtering)

Manages complex search, filtering, and pagination across multiple entities.

```typescript
interface SearchStore {
  // Global Search
  searchQuery: string
  searchResults: SearchResults
  searchFilters: GlobalFilters

  // Entity-specific Filters
  bookingFilters: BookingFilters
  guestFilters: GuestFilters
  unitFilters: UnitFilters

  // Pagination
  currentPage: number
  pageSize: number
  totalItems: number

  // Actions
  setSearchQuery: (query: string) => void
  performSearch: () => Promise<void>
  applyFilters: (filters: Partial<GlobalFilters>) => void
  clearFilters: () => void

  // Advanced Filtering
  addFilterCondition: (field: string, operator: string, value: any) => void
  removeFilterCondition: (id: string) => void
  saveFilterPreset: (name: string, filters: GlobalFilters) => void
  loadFilterPreset: (name: string) => void
}
```

### UIStore (Application UI State)

Centralized UI state management for consistent user experience.

```typescript
interface UIStore {
  // Modal Management
  modals: {
    [key: string]: {
      isOpen: boolean
      data?: any
    }
  }

  // Notifications
  notifications: Notification[]

  // Loading States
  loadingStates: Map<string, boolean>

  // View Preferences
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  density: 'comfortable' | 'compact' | 'spacious'

  // Actions
  openModal: (modalId: string, data?: any) => void
  closeModal: (modalId: string) => void
  showNotification: (notification: Notification) => void
  dismissNotification: (id: string) => void
  setLoading: (key: string, isLoading: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
}
```

## 🔄 TanStack Query Integration

Server state is managed through TanStack Query with custom hooks:

### Query Hooks

```typescript
// Booking Queries
export const useBookingsQuery = (projectId: string) => {
  return useQuery({
    queryKey: ['bookings', projectId],
    queryFn: () => bookingService.fetchBookings(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Mutation with Optimistic Updates
export const useUpdateBookingMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }) => bookingService.updateBooking(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries(['bookings'])

      // Snapshot previous value
      const previousBookings = queryClient.getQueryData(['bookings'])

      // Optimistically update
      queryClient.setQueryData(['bookings'], (old) => {
        return old.map(booking =>
          booking.id === id ? { ...booking, ...updates } : booking
        )
      })

      return { previousBookings }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['bookings'], context.previousBookings)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries(['bookings'])
    }
  })
}
```

## 🎯 Best Practices

### 1. Store Design Principles

- **Single Responsibility**: Each store manages one domain
- **Flat State Structure**: Avoid deeply nested state
- **Normalized Data**: Use IDs for relationships
- **Immutable Updates**: Never mutate state directly

### 2. Performance Optimization

```typescript
// Use selectors for computed values
const useBookingSelectors = () => {
  const bookings = useBookingStore(state => state.bookings)

  return useMemo(() => ({
    pendingCount: bookings.filter(b => b.status === 'pending').length,
    todayCheckIns: bookings.filter(b => isToday(b.checkInDate)),
    revenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0)
  }), [bookings])
}

// Subscribe to specific state slices
const status = useBookingStore(state => state.selectedBooking?.status)
```

### 3. Error Handling

```typescript
// Consistent error handling pattern
const createBooking = async (data: CreateBookingData) => {
  try {
    set({ isLoading: true, error: null })
    const booking = await bookingService.create(data)

    set(state => ({
      bookings: [...state.bookings, booking],
      isLoading: false
    }))

    return booking
  } catch (error) {
    set({
      error: error.message || 'Failed to create booking',
      isLoading: false
    })
    throw error
  }
}
```

### 4. Testing Stores

```typescript
// Test store actions
describe('BookingStore', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
  })

  it('should create a booking', async () => {
    const { createBooking } = useBookingStore.getState()
    const booking = await createBooking(mockBookingData)

    expect(booking).toBeDefined()
    expect(useBookingStore.getState().bookings).toContainEqual(booking)
  })
})
```

## 🔗 Store Relationships

### Data Flow Between Stores

```
User Action → Component → Store Action → API Call → State Update → Re-render

Example Flow:
1. User creates booking in BookingForm
2. BookingForm calls bookingStore.createBooking()
3. BookingStore:
   - Updates loading state
   - Calls Supabase API
   - Updates bookings array
   - Triggers notifications via UIStore
4. GuestStore automatically fetches new guest if needed
5. SearchStore clears filters to show new booking
6. Components re-render with new data
```

### Cross-Store Communication

```typescript
// BookingStore notifying UIStore
const createBooking = async (data) => {
  try {
    const booking = await api.createBooking(data)

    // Update own state
    set(state => ({ bookings: [...state.bookings, booking] }))

    // Notify UI store
    useUIStore.getState().showNotification({
      type: 'success',
      message: 'Booking created successfully'
    })

    // Update search store
    useSearchStore.getState().clearFilters()

    return booking
  } catch (error) {
    useUIStore.getState().showNotification({
      type: 'error',
      message: error.message
    })
  }
}
```

## 🚀 Advanced Patterns

### Middleware

```typescript
// Logging middleware
const logMiddleware = (config) => (set, get, api) =>
  config(
    (...args) => {
      console.log('State before:', get())
      set(...args)
      console.log('State after:', get())
    },
    get,
    api
  )

// Apply middleware
const useBookingStore = create(
  logMiddleware((set, get) => ({
    // store implementation
  }))
)
```

### Persistence

```typescript
import { persist } from 'zustand/middleware'

const useUIStore = create(
  persist(
    (set, get) => ({
      theme: 'light',
      density: 'comfortable',
      // ... other state
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        density: state.density
      })
    }
  )
)
```

## 📈 Performance Monitoring

```typescript
// Monitor store performance
if (process.env.NODE_ENV === 'development') {
  window.__STORE_METRICS__ = {
    updates: 0,
    subscriptions: new Map()
  }

  const originalSet = useBookingStore.setState
  useBookingStore.setState = (...args) => {
    window.__STORE_METRICS__.updates++
    console.log('Store update:', args)
    return originalSet(...args)
  }
}
```

## 🔧 Debugging

### DevTools Integration

```typescript
import { devtools } from 'zustand/middleware'

const useBookingStore = create(
  devtools(
    (set, get) => ({
      // store implementation
    }),
    {
      name: 'BookingStore',
      trace: true
    }
  )
)
```

### Common Issues

1. **Stale Closures**: Use `get()` to access latest state in async actions
2. **Memory Leaks**: Clean up subscriptions in useEffect
3. **Infinite Loops**: Avoid updating state that triggers the same update
4. **Race Conditions**: Use proper async handling and cancellation

## 📚 Additional Resources

- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [TanStack Query Documentation](https://tanstack.com/query)
- [State Management Best Practices](./docs/state-management-patterns.md)
- [Performance Optimization Guide](./docs/performance.md)