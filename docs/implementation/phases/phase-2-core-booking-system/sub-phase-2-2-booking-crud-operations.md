# Sub-Phase 2.2: Booking CRUD Operations

## Overview
This sub-phase implements the complete CRUD (Create, Read, Update, Delete) operations for bookings, including API endpoints, TanStack Query hooks, Zustand store for UI state, and optimistic updates using React 19 features.

## Objectives
1. Implement all booking API endpoints with proper middleware
2. Create TanStack Query hooks with intelligent caching
3. Setup Zustand store for booking UI state management
4. Implement optimistic updates with React 19's useOptimistic
5. Build comprehensive error handling and recovery

## Technical Requirements

### Core Dependencies
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.71.10",
    "zustand": "^5.0.2",
    "axios": "^1.7.0",
    "react": "^19.1.0"
  }
}
```

## API Implementation

### Booking API Routes
```typescript
// api/projects/[projectId]/bookings/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, authenticate, validate, errorHandler } from '@/api/_lib/middleware'
import { CreateBookingSchema, BookingFilterSchema } from '@/lib/validations/booking'
import { createProjectDb } from '@/api/_lib/db'
import { nanoid } from 'nanoid'

async function handler(req: VercelRequest, res: VercelResponse) {
  const { projectId } = req.query
  const user = (req as any).user
  const db = createProjectDb(projectId as string)

  switch (req.method) {
    case 'GET': {
      const filters = (req as any).validatedQuery
      const { page, limit, sortBy, sortOrder, ...where } = filters
      
      const offset = (page - 1) * limit
      
      const bookings = await db.query(`
        SELECT * FROM bookings
        WHERE ($1::text IS NULL OR booking_status = $1)
          AND ($2::text IS NULL OR source = $2)
          AND ($3::date IS NULL OR checkin_date >= $3)
          AND ($4::date IS NULL OR checkin_date <= $4)
          AND ($5::text IS NULL OR guest_name ILIKE $5)
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $6 OFFSET $7
      `, [
        where.status,
        where.source,
        where.checkinDateFrom,
        where.checkinDateTo,
        where.guestName ? `%${where.guestName}%` : null,
        limit,
        offset
      ])
      
      const [{ total }] = await db.query(`
        SELECT COUNT(*) as total FROM bookings
        WHERE ($1::text IS NULL OR booking_status = $1)
          AND ($2::text IS NULL OR source = $2)
      `, [where.status, where.source])
      
      return res.json({
        data: bookings,
        meta: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit)
        }
      })
    }
    
    case 'POST': {
      const data = (req as any).validatedBody
      const bookingReference = `BK-${nanoid(10)}`
      
      const [booking] = await db.query(`
        INSERT INTO bookings (
          booking_reference, source, guest_name, guest_email, guest_phone,
          checkin_date, checkout_date, guest_count, adult_count, child_count,
          base_amount, total_amount, deposit_required, booking_status,
          special_requests, internal_notes, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        bookingReference,
        data.source,
        data.guestName,
        data.guestEmail,
        data.guestPhone,
        data.checkinDate,
        data.checkoutDate,
        data.guestCount,
        data.adultCount || data.guestCount,
        data.childCount || 0,
        data.baseAmount || data.totalAmount,
        data.totalAmount,
        data.depositRequired || data.totalAmount * 0.5,
        'pending',
        data.specialRequests,
        data.internalNotes,
        data.tags || [],
        user.id
      ])
      
      // Create timeline event
      await db.query(`
        INSERT INTO booking_timeline (booking_id, event_type, event_title, created_by)
        VALUES ($1, 'booking_created', 'Booking created', $2)
      `, [booking.id, user.id])
      
      return res.status(201).json(booking)
    }
    
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

export default compose(
  errorHandler,
  authenticate,
  req => req.method === 'GET' 
    ? validate(BookingFilterSchema, 'query')(req)
    : validate(CreateBookingSchema, 'body')(req)
)(handler)
```

## TanStack Query Hooks

### Query Hooks Implementation
```typescript
// src/hooks/queries/useBookings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useProjectStore } from '@/stores/projectStore'
import { bookingApi } from '@/api/bookings'
import type { Booking, CreateBookingDto, UpdateBookingDto, BookingFilterDto } from '@/types/booking'

// Query keys factory
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (projectId: string, filters?: BookingFilterDto) => 
    [...bookingKeys.lists(), projectId, filters] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (projectId: string, id: string) => 
    [...bookingKeys.details(), projectId, id] as const,
}

// List bookings
export function useBookings(filters?: BookingFilterDto) {
  const projectId = useProjectStore(state => state.currentProjectId)
  
  return useQuery({
    queryKey: bookingKeys.list(projectId!, filters),
    queryFn: () => bookingApi.list(projectId!, filters),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  })
}

// Get single booking
export function useBooking(bookingId: string) {
  const projectId = useProjectStore(state => state.currentProjectId)
  
  return useQuery({
    queryKey: bookingKeys.detail(projectId!, bookingId),
    queryFn: () => bookingApi.get(projectId!, bookingId),
    enabled: !!projectId && !!bookingId,
  })
}

// Create booking with optimistic update
export function useCreateBooking() {
  const queryClient = useQueryClient()
  const projectId = useProjectStore(state => state.currentProjectId)
  
  return useMutation({
    mutationFn: (data: CreateBookingDto) => 
      bookingApi.create(projectId!, data),
    
    onMutate: async (newBooking) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: bookingKeys.lists() 
      })
      
      // Snapshot previous value
      const previousBookings = queryClient.getQueriesData({ 
        queryKey: bookingKeys.lists() 
      })
      
      // Optimistically update all list queries
      queryClient.setQueriesData(
        { queryKey: bookingKeys.lists() },
        (old: any) => {
          if (!old) return old
          return {
            ...old,
            data: [{
              ...newBooking,
              id: `temp-${Date.now()}`,
              bookingReference: 'PENDING',
              bookingStatus: 'pending',
              paymentStatus: 'pending',
              createdAt: new Date().toISOString(),
            }, ...old.data]
          }
        }
      )
      
      return { previousBookings }
    },
    
    onError: (err, newBooking, context) => {
      // Rollback on error
      if (context?.previousBookings) {
        context.previousBookings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ 
        queryKey: bookingKeys.lists() 
      })
    },
  })
}

// Update booking
export function useUpdateBooking() {
  const queryClient = useQueryClient()
  const projectId = useProjectStore(state => state.currentProjectId)
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingDto }) =>
      bookingApi.update(projectId!, id, data),
    
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: bookingKeys.detail(projectId!, id),
      })
      
      const previousBooking = queryClient.getQueryData(
        bookingKeys.detail(projectId!, id)
      )
      
      queryClient.setQueryData(
        bookingKeys.detail(projectId!, id),
        (old: Booking | undefined) => {
          if (!old) return old
          return { ...old, ...data }
        }
      )
      
      return { previousBooking }
    },
    
    onError: (err, variables, context) => {
      if (context?.previousBooking) {
        queryClient.setQueryData(
          bookingKeys.detail(projectId!, variables.id),
          context.previousBooking
        )
      }
    },
    
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: bookingKeys.detail(projectId!, variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: bookingKeys.lists(),
      })
    },
  })
}

// Delete booking
export function useDeleteBooking() {
  const queryClient = useQueryClient()
  const projectId = useProjectStore(state => state.currentProjectId)
  
  return useMutation({
    mutationFn: (id: string) => bookingApi.delete(projectId!, id),
    
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: bookingKeys.lists(),
      })
    },
  })
}
```

## Zustand Store for Booking UI

### Booking UI Store
```typescript
// src/stores/bookingStore.ts
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { BookingSource, BookingStatus } from '@/types/booking'

interface BookingUIState {
  // Selection
  selectedBookingId: string | null
  selectedBookings: string[]
  
  // Filters
  filters: {
    status: BookingStatus | null
    source: BookingSource | null
    dateRange: [Date | null, Date | null]
    searchQuery: string
    paymentStatus: string | null
    tags: string[]
  }
  
  // View settings
  viewMode: 'list' | 'calendar' | 'timeline'
  sortBy: 'checkinDate' | 'createdAt' | 'guestName' | 'totalAmount'
  sortOrder: 'asc' | 'desc'
  
  // Modals
  modals: {
    createBooking: boolean
    editBooking: boolean
    paymentModal: boolean
    importCSV: boolean
    bookingDetails: boolean
  }
  
  // Import state
  csvImport: {
    isImporting: boolean
    progress: number
    errors: string[]
    mappedFields: Record<string, string>
  }
}

interface BookingUIActions {
  // Selection actions
  selectBooking: (id: string | null) => void
  toggleBookingSelection: (id: string) => void
  clearSelection: () => void
  
  // Filter actions
  setFilter: <K extends keyof BookingUIState['filters']>(
    key: K,
    value: BookingUIState['filters'][K]
  ) => void
  resetFilters: () => void
  
  // View actions
  setViewMode: (mode: BookingUIState['viewMode']) => void
  setSortBy: (field: BookingUIState['sortBy']) => void
  toggleSortOrder: () => void
  
  // Modal actions
  openModal: (modal: keyof BookingUIState['modals']) => void
  closeModal: (modal: keyof BookingUIState['modals']) => void
  closeAllModals: () => void
  
  // Import actions
  setImportProgress: (progress: number) => void
  setImportError: (error: string) => void
  setFieldMapping: (mapping: Record<string, string>) => void
  resetImport: () => void
}

export const useBookingStore = create<BookingUIState & BookingUIActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => ({
          // Initial state
          selectedBookingId: null,
          selectedBookings: [],
          
          filters: {
            status: null,
            source: null,
            dateRange: [null, null],
            searchQuery: '',
            paymentStatus: null,
            tags: [],
          },
          
          viewMode: 'list',
          sortBy: 'checkinDate',
          sortOrder: 'asc',
          
          modals: {
            createBooking: false,
            editBooking: false,
            paymentModal: false,
            importCSV: false,
            bookingDetails: false,
          },
          
          csvImport: {
            isImporting: false,
            progress: 0,
            errors: [],
            mappedFields: {},
          },
          
          // Actions
          selectBooking: (id) => set((state) => {
            state.selectedBookingId = id
          }),
          
          toggleBookingSelection: (id) => set((state) => {
            const index = state.selectedBookings.indexOf(id)
            if (index > -1) {
              state.selectedBookings.splice(index, 1)
            } else {
              state.selectedBookings.push(id)
            }
          }),
          
          clearSelection: () => set((state) => {
            state.selectedBookingId = null
            state.selectedBookings = []
          }),
          
          setFilter: (key, value) => set((state) => {
            (state.filters as any)[key] = value
          }),
          
          resetFilters: () => set((state) => {
            state.filters = {
              status: null,
              source: null,
              dateRange: [null, null],
              searchQuery: '',
              paymentStatus: null,
              tags: [],
            }
          }),
          
          setViewMode: (mode) => set((state) => {
            state.viewMode = mode
          }),
          
          setSortBy: (field) => set((state) => {
            if (state.sortBy === field) {
              state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
            } else {
              state.sortBy = field
              state.sortOrder = 'asc'
            }
          }),
          
          toggleSortOrder: () => set((state) => {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
          }),
          
          openModal: (modal) => set((state) => {
            state.modals[modal] = true
          }),
          
          closeModal: (modal) => set((state) => {
            state.modals[modal] = false
          }),
          
          closeAllModals: () => set((state) => {
            Object.keys(state.modals).forEach((key) => {
              state.modals[key as keyof typeof state.modals] = false
            })
          }),
          
          setImportProgress: (progress) => set((state) => {
            state.csvImport.progress = progress
          }),
          
          setImportError: (error) => set((state) => {
            state.csvImport.errors.push(error)
          }),
          
          setFieldMapping: (mapping) => set((state) => {
            state.csvImport.mappedFields = mapping
          }),
          
          resetImport: () => set((state) => {
            state.csvImport = {
              isImporting: false,
              progress: 0,
              errors: [],
              mappedFields: {},
            }
          }),
        }))
      ),
      {
        name: 'booking-ui-store',
        partialize: (state) => ({
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          filters: state.filters,
        }),
      }
    ),
    {
      name: 'BookingUIStore',
    }
  )
)
```

## React 19 Optimistic Updates

### useOptimistic Implementation
```typescript
// src/hooks/useOptimisticBookings.ts
import { useOptimistic, useTransition, useActionState } from 'react'
import { useBookings, useCreateBooking, useUpdateBooking } from './queries/useBookings'
import type { Booking, CreateBookingDto, UpdateBookingDto } from '@/types/booking'

export function useOptimisticBookings(filters?: any) {
  const { data: bookingsData, isLoading } = useBookings(filters)
  const createMutation = useCreateBooking()
  const updateMutation = useUpdateBooking()
  const [isPending, startTransition] = useTransition()
  
  const bookings = bookingsData?.data || []
  
  // Optimistic state for bookings list
  const [optimisticBookings, addOptimisticBooking] = useOptimistic(
    bookings,
    (state: Booking[], action: { type: 'add' | 'update' | 'delete'; data: any }) => {
      switch (action.type) {
        case 'add':
          return [{
            ...action.data,
            id: `optimistic-${Date.now()}`,
            bookingReference: 'PENDING...',
            bookingStatus: 'pending',
            createdAt: new Date().toISOString(),
          } as Booking, ...state]
        
        case 'update':
          return state.map(booking =>
            booking.id === action.data.id
              ? { ...booking, ...action.data.updates }
              : booking
          )
        
        case 'delete':
          return state.filter(booking => booking.id !== action.data.id)
        
        default:
          return state
      }
    }
  )
  
  // Create booking with optimistic update
  const createBooking = (data: CreateBookingDto) => {
    startTransition(async () => {
      addOptimisticBooking({ type: 'add', data })
      try {
        await createMutation.mutateAsync(data)
      } catch (error) {
        // Error will trigger rollback via TanStack Query
        console.error('Failed to create booking:', error)
      }
    })
  }
  
  // Update booking with optimistic update
  const updateBooking = (id: string, updates: UpdateBookingDto) => {
    startTransition(async () => {
      addOptimisticBooking({ type: 'update', data: { id, updates } })
      try {
        await updateMutation.mutateAsync({ id, data: updates })
      } catch (error) {
        console.error('Failed to update booking:', error)
      }
    })
  }
  
  return {
    bookings: optimisticBookings,
    isLoading: isLoading || isPending,
    createBooking,
    updateBooking,
  }
}
```

### Form with useActionState
```typescript
// src/components/booking/CreateBookingForm.tsx
import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateBookingSchema } from '@/lib/validations/booking'
import { useOptimisticBookings } from '@/hooks/useOptimisticBookings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'

export function CreateBookingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { createBooking } = useOptimisticBookings()
  
  const [state, submitAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      try {
        const data = Object.fromEntries(formData.entries())
        const validated = CreateBookingSchema.parse(data)
        
        await createBooking(validated)
        
        toast({
          title: 'Booking created',
          description: 'The booking has been created successfully.',
        })
        
        onSuccess?.()
        
        return { success: true }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to create booking' 
        }
      }
    },
    { success: false }
  )
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateBookingSchema),
  })
  
  return (
    <form action={submitAction} className="space-y-4">
      <div>
        <Input
          {...register('guestName')}
          placeholder="Guest Name"
          disabled={isPending}
        />
        {errors.guestName && (
          <p className="text-sm text-destructive">{errors.guestName.message}</p>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Input
          {...register('checkinDate')}
          type="date"
          disabled={isPending}
        />
        <Input
          {...register('checkoutDate')}
          type="date"
          disabled={isPending}
        />
      </div>
      
      <div>
        <Input
          {...register('totalAmount', { valueAsNumber: true })}
          type="number"
          placeholder="Total Amount"
          disabled={isPending}
        />
      </div>
      
      {state.error && (
        <div className="text-sm text-destructive">{state.error}</div>
      )}
      
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Booking'}
      </Button>
    </form>
  )
}
```

## Agent Validation Checklist

### react-redux-resort-architect Validation
- [ ] TanStack Query hooks properly structured with caching strategies
- [ ] Zustand store follows best practices for state separation
- [ ] Optimistic updates implemented correctly with rollback
- [ ] Query invalidation strategies comprehensive
- [ ] Mutation error handling with retry logic
- [ ] State synchronization between local and server state
- [ ] Performance optimization for large datasets
- [ ] Offline support considerations

### typescript-react-quality-expert Validation
- [ ] 100% TypeScript coverage with no `any` types
- [ ] React 19 hooks (useOptimistic, useActionState) used correctly
- [ ] Type-safe API client implementation
- [ ] Proper generic types for reusable hooks
- [ ] Discriminated unions for complex state
- [ ] Error boundaries implemented
- [ ] Component props fully typed
- [ ] Form validation with type safety

## Success Criteria
1. **CRUD Operations** - All booking operations functional
2. **Query Hooks** - TanStack Query hooks with caching
3. **UI State** - Zustand store managing UI state
4. **Optimistic Updates** - React 19 hooks for instant feedback
5. **Error Handling** - Comprehensive error recovery
6. **Type Safety** - 100% TypeScript coverage
7. **Performance** - Response times < 200ms
8. **Testing** - 85% test coverage

## Deliverables
- [ ] Complete CRUD API endpoints
- [ ] TanStack Query hooks
- [ ] Zustand UI store
- [ ] Optimistic update implementation
- [ ] Error handling system
- [ ] Form components
- [ ] Unit and integration tests
- [ ] API documentation

## Completion Checklist
- [ ] All CRUD endpoints implemented and tested
- [ ] TanStack Query hooks with proper caching
- [ ] Zustand store managing UI state
- [ ] Optimistic updates working smoothly
- [ ] Error handling comprehensive
- [ ] Forms with validation
- [ ] All tests passing
- [ ] Agent validations passed
- [ ] Documentation complete
- [ ] Ready for Sub-Phase 2.3

---

*Sub-Phase 2.2 implements the core booking operations with modern state management and optimistic UI patterns.*