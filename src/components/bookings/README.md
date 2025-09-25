# 📅 Bookings Module Documentation

## Overview

The Bookings module is the most complex component system in the Okaeri Resort System, handling the entire booking lifecycle from creation to completion. This module consists of multiple interconnected components totaling over 2,500 lines of code.

## 🏗️ Module Architecture

```
bookings/
├── BookingForm.tsx         # 801 lines - Main booking creation/edit form
├── BookingsTable.tsx       # 797 lines - Advanced data table with filters
├── BookingWorkflowPanel.tsx # Workflow orchestration interface
├── PaymentUploadForm.tsx   # 482 lines - Payment receipt handling
├── BookingCalendar.tsx     # Interactive calendar view
├── BookingDetails.tsx      # Detailed booking view modal
├── BookingStatus.tsx       # Status management component
└── utils/
    ├── validation.ts       # Form validation schemas
    └── calculations.ts     # Price and date calculations
```

## 📦 Component Documentation

### BookingForm Component (801 lines)

The core form component for creating and editing bookings with complex business logic.

#### Props Interface

```typescript
interface BookingFormProps {
  mode: 'create' | 'edit'
  booking?: Booking
  projectId: string
  onSuccess?: (booking: Booking) => void
  onCancel?: () => void
  defaultValues?: Partial<BookingFormData>
}
```

#### Key Features

1. **Multi-Step Form Process**
   - Step 1: Guest Selection/Creation
   - Step 2: Unit and Date Selection
   - Step 3: Pricing and Add-ons
   - Step 4: Payment Information
   - Step 5: Confirmation

2. **Dynamic Pricing Calculation**
   ```typescript
   const calculateTotalPrice = (data: BookingFormData) => {
     const nights = differenceInDays(data.checkOut, data.checkIn)
     const basePrice = data.unit.pricePerNight * nights

     // Apply seasonal rates
     const seasonalMultiplier = getSeasonalRate(data.checkIn)
     const adjustedPrice = basePrice * seasonalMultiplier

     // Add extra guest charges
     const extraGuestFee = calculateExtraGuestFee(
       data.guestCount,
       data.unit.maxGuests
     )

     // Apply discounts
     const discount = calculateDiscount(data.discountCode, adjustedPrice)

     return adjustedPrice + extraGuestFee - discount
   }
   ```

3. **Real-time Availability Checking**
   ```typescript
   const checkAvailability = async (unitId: string, dates: DateRange) => {
     const { data: conflicts } = await supabase
       .from('bookings')
       .select('*')
       .eq('unit_id', unitId)
       .gte('check_out', dates.start)
       .lte('check_in', dates.end)
       .neq('status', 'cancelled')

     return conflicts.length === 0
   }
   ```

4. **Form Validation with Zod**
   ```typescript
   const bookingFormSchema = z.object({
     guestId: z.string().uuid('Invalid guest selection'),
     unitId: z.string().uuid('Unit selection required'),
     checkIn: z.date().min(new Date(), 'Check-in must be in the future'),
     checkOut: z.date(),
     guestCount: z.number().min(1).max(20),
     totalAmount: z.number().positive(),
     paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer', 'credit_card']),
     specialRequests: z.string().max(500).optional(),
   }).refine(data => data.checkOut > data.checkIn, {
     message: 'Check-out must be after check-in',
     path: ['checkOut']
   })
   ```

#### Usage Example

```tsx
import { BookingForm } from '@/components/bookings/BookingForm'

function CreateBookingPage() {
  const navigate = useNavigate()

  const handleSuccess = (booking: Booking) => {
    toast.success(`Booking ${booking.id} created successfully`)
    navigate(`/bookings/${booking.id}`)
  }

  return (
    <BookingForm
      mode="create"
      projectId={projectId}
      onSuccess={handleSuccess}
      defaultValues={{
        checkIn: addDays(new Date(), 1),
        checkOut: addDays(new Date(), 3)
      }}
    />
  )
}
```

### BookingsTable Component (797 lines)

Advanced data table with server-side pagination, filtering, and bulk actions.

#### Props Interface

```typescript
interface BookingsTableProps {
  projectId: string
  filters?: BookingFilters
  onBookingSelect?: (booking: Booking) => void
  enableBulkActions?: boolean
  customColumns?: ColumnDef<Booking>[]
}
```

#### Features

1. **Advanced Filtering System**
   - Date range filtering
   - Status filtering (multi-select)
   - Guest name search
   - Unit filtering
   - Amount range filtering

2. **Column Configuration**
   ```typescript
   const columns: ColumnDef<Booking>[] = [
     {
       id: 'select',
       header: ({ table }) => (
         <Checkbox
           checked={table.getIsAllPageRowsSelected()}
           onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
         />
       ),
       cell: ({ row }) => (
         <Checkbox
           checked={row.getIsSelected()}
           onCheckedChange={(value) => row.toggleSelected(!!value)}
         />
       ),
     },
     {
       accessorKey: 'bookingCode',
       header: ({ column }) => (
         <DataTableColumnHeader column={column} title="Booking Code" />
       ),
       cell: ({ row }) => (
         <div className="font-mono text-sm">
           {row.getValue('bookingCode')}
         </div>
       ),
     },
     {
       accessorKey: 'guest',
       header: 'Guest',
       cell: ({ row }) => (
         <div className="flex items-center gap-2">
           <Avatar className="h-8 w-8">
             <AvatarFallback>
               {getInitials(row.original.guest.name)}
             </AvatarFallback>
           </Avatar>
           <div>
             <p className="font-medium">{row.original.guest.name}</p>
             <p className="text-sm text-muted-foreground">
               {row.original.guest.email}
             </p>
           </div>
         </div>
       ),
     },
     // ... more columns
   ]
   ```

3. **Bulk Actions**
   ```typescript
   const bulkActions = {
     confirmBookings: async (bookingIds: string[]) => {
       await Promise.all(
         bookingIds.map(id =>
           updateBooking(id, { status: 'confirmed' })
         )
       )
     },
     exportToCSV: (bookings: Booking[]) => {
       const csv = generateCSV(bookings)
       downloadFile(csv, 'bookings.csv')
     },
     sendBulkEmails: async (bookingIds: string[]) => {
       await sendEmailBatch(bookingIds, emailTemplate)
     }
   }
   ```

4. **Performance Optimizations**
   - Virtual scrolling for large datasets
   - Debounced search inputs
   - Memoized column definitions
   - Lazy loading of related data

### BookingWorkflowPanel Component

Manages the booking status workflow and transitions.

#### Workflow States

```typescript
enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

const workflowTransitions = {
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CHECKED_IN,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW
  ],
  [BookingStatus.CHECKED_IN]: [
    BookingStatus.CHECKED_OUT
  ],
  [BookingStatus.CHECKED_OUT]: [
    BookingStatus.COMPLETED
  ]
}
```

#### Component Implementation

```tsx
function BookingWorkflowPanel({ booking, onStatusChange }) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const validTransitions = workflowTransitions[booking.status] || []

  const handleTransition = async (newStatus: BookingStatus) => {
    setIsTransitioning(true)

    try {
      // Validate transition
      if (!validTransitions.includes(newStatus)) {
        throw new Error('Invalid status transition')
      }

      // Perform status-specific actions
      switch (newStatus) {
        case BookingStatus.CONFIRMED:
          await sendConfirmationEmail(booking)
          break
        case BookingStatus.CHECKED_IN:
          await createGuestSession(booking)
          break
        case BookingStatus.COMPLETED:
          await finalizePayment(booking)
          await requestReview(booking)
          break
      }

      // Update status
      await onStatusChange(newStatus)

      toast.success(`Booking status updated to ${newStatus}`)
    } catch (error) {
      toast.error(`Failed to update status: ${error.message}`)
    } finally {
      setIsTransitioning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Workflow</CardTitle>
        <CardDescription>
          Current Status: {booking.status}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {validTransitions.map(status => (
            <Button
              key={status}
              onClick={() => handleTransition(status)}
              disabled={isTransitioning}
              variant={getStatusVariant(status)}
            >
              {getStatusLabel(status)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### PaymentUploadForm Component (482 lines)

Handles payment receipt uploads with validation and processing.

#### Key Features

1. **File Upload with Validation**
   ```typescript
   const fileValidation = {
     maxSize: 5 * 1024 * 1024, // 5MB
     acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
     validateImage: async (file: File) => {
       if (!file.type.startsWith('image/')) return true

       const img = new Image()
       const url = URL.createObjectURL(file)

       return new Promise((resolve) => {
         img.onload = () => {
           URL.revokeObjectURL(url)
           resolve(img.width >= 800 && img.height >= 600)
         }
         img.src = url
       })
     }
   }
   ```

2. **Receipt Processing**
   ```typescript
   const processReceipt = async (file: File, bookingId: string) => {
     // Upload to storage
     const fileName = `receipts/${bookingId}/${Date.now()}-${file.name}`
     const { data: upload } = await supabase.storage
       .from('payment-receipts')
       .upload(fileName, file)

     // Create payment record
     const payment = await createPayment({
       bookingId,
       amount: formData.amount,
       method: formData.paymentMethod,
       receiptUrl: upload.path,
       referenceNumber: formData.referenceNumber,
       paidAt: formData.paymentDate
     })

     // Update booking balance
     await updateBookingBalance(bookingId, payment.amount)

     return payment
   }
   ```

## 🔧 Utility Functions

### Date Calculations

```typescript
// utils/calculations.ts

export const calculateNights = (checkIn: Date, checkOut: Date): number => {
  return differenceInDays(checkOut, checkIn)
}

export const getSeasonalRate = (date: Date): number => {
  const month = date.getMonth()

  // Peak season (Dec-May)
  if (month >= 11 || month <= 4) return 1.3

  // Regular season
  return 1.0
}

export const calculateOccupancyRate = (
  bookings: Booking[],
  units: Unit[],
  dateRange: DateRange
): number => {
  const totalNights = units.length *
    differenceInDays(dateRange.end, dateRange.start)

  const bookedNights = bookings.reduce((sum, booking) => {
    const overlap = getDateOverlap(booking, dateRange)
    return sum + overlap
  }, 0)

  return (bookedNights / totalNights) * 100
}
```

### Validation Schemas

```typescript
// utils/validation.ts

export const guestValidation = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^(\+63|0)\d{10}$/, 'Invalid Philippine phone number'),
  idType: z.enum(['passport', 'drivers_license', 'national_id']),
  idNumber: z.string().min(6)
})

export const paymentValidation = z.object({
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'gcash', 'bank_transfer', 'credit_card']),
  referenceNumber: z.string().when('method', {
    is: (method) => method !== 'cash',
    then: z.string().min(1, 'Reference number required'),
    otherwise: z.string().optional()
  })
})
```

## 🎨 Styling Patterns

The booking components use consistent styling patterns:

```tsx
// Consistent card layouts
<Card className="border-border/50 shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-xl font-semibold">
      {title}
    </CardTitle>
    <CardDescription className="text-sm text-muted-foreground">
      {description}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {content}
  </CardContent>
</Card>

// Status badges
<Badge
  variant={getStatusVariant(booking.status)}
  className="font-mono text-xs"
>
  {booking.status.toUpperCase()}
</Badge>

// Data display patterns
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">Label</p>
    <p className="font-medium">{value}</p>
  </div>
</div>
```

## 🔄 State Management

The booking components integrate with Zustand stores:

```typescript
// Integration with booking store
const BookingComponent = () => {
  const {
    bookings,
    selectedBooking,
    isLoading,
    fetchBookings,
    updateBooking
  } = useBookingStore()

  const {
    showNotification,
    openModal
  } = useUIStore()

  // Optimistic updates
  const handleStatusUpdate = async (bookingId: string, status: string) => {
    // Optimistic update
    updateBooking(bookingId, { status })

    try {
      await api.updateBookingStatus(bookingId, status)
      showNotification({
        type: 'success',
        message: 'Booking updated successfully'
      })
    } catch (error) {
      // Rollback on error
      await fetchBookings()
      showNotification({
        type: 'error',
        message: 'Failed to update booking'
      })
    }
  }
}
```

## 🧪 Testing Guidelines

```typescript
// Test booking form validation
describe('BookingForm', () => {
  it('should validate guest selection', async () => {
    render(<BookingForm mode="create" />)

    const submitButton = screen.getByRole('button', { name: /submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/guest selection required/i)).toBeInTheDocument()
  })

  it('should calculate prices correctly', () => {
    const result = calculateTotalPrice({
      checkIn: new Date('2024-01-01'),
      checkOut: new Date('2024-01-05'),
      unit: { pricePerNight: 1000 },
      guestCount: 2
    })

    expect(result).toBe(4000)
  })
})
```

## 📊 Performance Considerations

1. **Lazy Loading**: Large forms are split into steps
2. **Memoization**: Complex calculations are memoized
3. **Virtual Scrolling**: Tables use virtual scrolling for large datasets
4. **Debouncing**: Search inputs are debounced
5. **Code Splitting**: Each major component is code-split

## 🔗 Related Documentation

- [State Management](../../stores/README.md)
- [Form Validation](../forms-documentation.md)
- [UI Components](../ui/README.md)
- [API Documentation](../../../api/README.md)