# 📋 Advanced Bookings Table Documentation

## Overview

The Advanced Bookings Table is a **feature-rich, enterprise-grade data table** for managing resort bookings with comprehensive filtering, sorting, pagination, and action capabilities. Built on **TanStack Table v8**, this module provides professional booking management with mobile-responsive design, real-time updates, and Philippine business formatting standards.

The table supports multiple views (desktop table, mobile cards), advanced filtering (status, date range, search), bulk actions, CSV export, and integrates seamlessly with the booking state management system.

## 🏗️ Module Architecture

```
BookingsTable/
├── index.tsx                        # Main table component (4.7KB, 148 lines)
├── types.ts                         # TypeScript interfaces (688 bytes)
├── components/
│   ├── BookingCard.tsx             # Mobile card view (2.5KB, ~70 lines)
│   ├── BookingColumns.tsx          # Column definitions (5.5KB, ~160 lines)
│   └── BookingFilters.tsx          # Advanced filters (5.5KB, ~160 lines)
├── hooks/
│   └── useBookingsTable.ts         # Table state management (4.9KB, ~140 lines)
└── utils/
    └── export.ts                    # CSV export utilities (~2KB, ~60 lines)
```

Total Lines of Code: **~738 lines** across 7 files

## 📦 Component Documentation

### BookingsTable Component (Main)

The orchestrating component managing table rendering and responsive views.

#### Features

1. **Responsive Design**
   - Desktop: Enterprise table layout
   - Mobile: Card-based layout
   - Automatic view detection
   - CSS-only responsiveness

2. **Data Management**
   - TanStack Query integration
   - Real-time updates
   - Optimistic UI updates
   - Error boundary wrapped

3. **User Actions**
   - View booking details
   - Edit booking
   - Upload payment proof
   - Cancel booking
   - Delete booking
   - Export to CSV

4. **Loading States**
   - Skeleton loading (BookingsTableSkeleton)
   - Empty state handling
   - Error state display
   - Disabled states during mutations

#### Usage Example

```tsx
import { BookingsTable } from '@/components/bookings/BookingsTable'
import { useState } from 'react'

function BookingsManagementPage() {
  const [selectedBooking, setSelectedBooking] = useState(null)

  return (
    <div className="space-y-6">
      <h1>Bookings Management</h1>

      <BookingsTable
        onViewBooking={(booking) => {
          setSelectedBooking(booking)
          // Open detail modal
        }}
        onEditBooking={(booking) => {
          navigate(`/bookings/edit/${booking.booking_id}`)
        }}
        className="booking-table-container"
      />
    </div>
  )
}
```

#### Props Interface

```typescript
interface BookingsTableProps {
  onViewBooking?: (booking: Booking) => void  // View booking callback
  onEditBooking?: (booking: Booking) => void  // Edit booking callback
  className?: string                           // Custom CSS class
}
```

### useBookingsTable Hook

**Comprehensive hook managing table state, filtering, sorting, and actions**.

#### Hook Features

1. **TanStack Table Integration**
   - Column definitions
   - Sorting state
   - Filtering state
   - Pagination state
   - Column visibility

2. **State Management**
   - Zustand store for filters
   - Local state for table UI
   - Persisted search query
   - Filter presets

3. **Mutations**
   - Update booking status
   - Upload payment proof
   - Cancel booking
   - Delete booking

4. **Export Functionality**
   - CSV export with Philippine formatting
   - Filtered data export
   - Sanitized data output

5. **Responsive View**
   - Mobile detection
   - Automatic view switching
   - Conditional rendering

#### Usage

```typescript
const {
  // Table instance
  table,

  // Data
  bookings,
  isLoading,
  error,

  // View state
  isMobile,

  // Filter state
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  resetFilters,

  // Actions
  handleExport,
  handleUploadPayment,
  cancelBooking,
} = useBookingsTable({
  onViewBooking: (booking) => console.log('View:', booking),
  onEditBooking: (booking) => console.log('Edit:', booking),
})
```

#### TanStack Table Configuration

```typescript
const table = useReactTable({
  data: filteredBookings,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onColumnVisibilityChange: setColumnVisibility,
  state: {
    sorting,
    columnFilters,
    columnVisibility,
    pagination: {
      pageIndex: 0,
      pageSize: 10,
    },
  },
})
```

### BookingColumns Component

**Column definitions for the booking table** with sorting, formatting, and actions.

#### Column Configuration

```typescript
const columns = [
  // Guest column (sortable, with contact info)
  columnHelper.accessor("guest_name", {
    header: ({ header }) => <SortableHeader header={header}>Guest</SortableHeader>,
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-medium">{row.original.guest_name}</div>
        <div className="text-xs text-neutral-600">
          {formatPhoneNumber(row.original.contact_number)}
        </div>
      </div>
    ),
    size: 180,
  }),

  // Unit column
  columnHelper.accessor("unit.unit_name", {
    header: "Unit",
    cell: ({ getValue }) => <div className="font-medium">{getValue()}</div>,
    size: 120,
  }),

  // Dates column (check-in and check-out)
  columnHelper.accessor("check_in", {
    header: ({ header }) => <SortableHeader header={header}>Dates</SortableHeader>,
    cell: ({ getValue, row }) => (
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{formatTableDate(getValue())}</div>
        <div className="text-xs text-neutral-500">
          {formatTableDate(row.original.check_out)}
        </div>
      </div>
    ),
    size: 100,
  }),

  // Guests column (number)
  columnHelper.accessor("num_guests", {
    header: "Guests",
    cell: ({ getValue }) => (
      <div className="text-center font-mono">{getValue()}</div>
    ),
    size: 80,
  }),

  // Amount column (sortable, Philippine peso)
  columnHelper.accessor("total_amount", {
    header: ({ header }) => (
      <SortableHeader header={header} className="text-right">Amount</SortableHeader>
    ),
    cell: ({ getValue }) => (
      <div className="text-right font-mono font-semibold">
        {formatCurrency(getValue())}
      </div>
    ),
    size: 120,
  }),

  // Status column
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    size: 120,
  }),

  // Actions column
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <ActionMenu
        actions={[
          { label: 'View', onClick: () => onViewBooking(row.original) },
          { label: 'Edit', onClick: () => onEditBooking(row.original) },
          { label: 'Upload Payment', onClick: () => handleUploadPayment(row.original) },
          { label: 'Cancel', onClick: () => cancelBooking.mutate(row.original.booking_id), variant: 'destructive' },
        ]}
      />
    ),
    size: 80,
  }),
]
```

#### Column Features

- **Sortable headers** for guest, dates, and amount
- **Multi-line cells** for guest info and dates
- **Monospace fonts** for numbers (guests, amount)
- **StatusBadge** for visual status indication
- **Action menu** with contextual actions
- **Fixed widths** for consistent layout
- **Philippine peso** formatting

### BookingCard Component

**Mobile-optimized card view** for bookings.

#### Features

- Compact card layout
- All essential booking info
- Action buttons (View, Edit, Upload, Cancel)
- Status badge
- Formatted currency
- Formatted dates
- Formatted phone numbers

#### Usage

```tsx
<BookingCard
  booking={booking}
  onView={() => handleView(booking)}
  onEdit={() => handleEdit(booking)}
  onUploadPayment={() => handleUploadPayment(booking)}
  onCancel={() => handleCancel(booking.booking_id)}
/>
```

#### Card Structure

```tsx
<Card className="p-4 space-y-3">
  {/* Header: Guest name + Status */}
  <div className="flex justify-between items-start">
    <h3 className="font-medium">{booking.guest_name}</h3>
    <StatusBadge status={booking.status} />
  </div>

  {/* Details Grid */}
  <div className="grid grid-cols-2 gap-2 text-sm">
    <div>
      <span className="text-neutral-600">Unit:</span>
      <span className="font-medium">{booking.unit.unit_name}</span>
    </div>
    <div>
      <span className="text-neutral-600">Guests:</span>
      <span className="font-mono">{booking.num_guests}</span>
    </div>
    <div>
      <span className="text-neutral-600">Check-in:</span>
      <span>{formatTableDate(booking.check_in)}</span>
    </div>
    <div>
      <span className="text-neutral-600">Check-out:</span>
      <span>{formatTableDate(booking.check_out)}</span>
    </div>
    <div className="col-span-2">
      <span className="text-neutral-600">Amount:</span>
      <span className="font-mono font-semibold">
        {formatCurrency(booking.total_amount)}
      </span>
    </div>
  </div>

  {/* Action Buttons */}
  <div className="flex gap-2">
    <Button size="sm" onClick={onView}>View</Button>
    <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
    {/* More actions... */}
  </div>
</Card>
```

### BookingFilters Component

**Advanced filtering interface** with search, status filters, date ranges, and export.

#### Features

1. **Search**
   - Booking reference search
   - Guest name search
   - Email search
   - Phone number search
   - Real-time filtering

2. **Status Filter**
   - Confirmed
   - Pending
   - Checked In
   - Checked Out
   - Cancelled
   - Multi-select support

3. **Date Range Filter**
   - Check-in date range
   - Check-out date range
   - Calendar picker
   - Quick presets (Today, This Week, This Month)

4. **Quick Actions**
   - Reset all filters
   - Export to CSV
   - Filter active indicator

#### Usage

```tsx
<BookingFilters
  filters={filters}
  setFilters={setFilters}
  searchQuery={searchQuery}
  setSearchQuery={setSearchQuery}
  resetFilters={resetFilters}
  onExport={handleExport}
/>
```

#### Filter State

```typescript
interface BookingFilters {
  status?: BookingStatus[]     // Selected statuses
  checkInFrom?: Date           // Check-in range start
  checkInTo?: Date             // Check-in range end
  checkOutFrom?: Date          // Check-out range start
  checkOutTo?: Date            // Check-out range end
}
```

#### Filter Implementation

```tsx
// Status filter
<FilterPopover
  isActive={filters.status && filters.status.length > 0}
  onClear={() => setFilters({ ...filters, status: [] })}
  content={
    <div className="space-y-2">
      {['Confirmed', 'Pending', 'Checked In', 'Cancelled'].map(status => (
        <label key={status} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.status?.includes(status)}
            onChange={(e) => {
              const newStatuses = e.target.checked
                ? [...(filters.status || []), status]
                : filters.status?.filter(s => s !== status)
              setFilters({ ...filters, status: newStatuses })
            }}
          />
          {status}
        </label>
      ))}
    </div>
  }
>
  Status
</FilterPopover>

// Date range filter
<FilterPopover
  isActive={!!filters.checkInFrom || !!filters.checkInTo}
  showActions={true}
  onApply={() => console.log('Apply date filter')}
  onClear={() => setFilters({ ...filters, checkInFrom: undefined, checkInTo: undefined })}
  content={
    <Calendar
      mode="range"
      selected={{ from: filters.checkInFrom, to: filters.checkInTo }}
      onSelect={(range) => setFilters({
        ...filters,
        checkInFrom: range?.from,
        checkInTo: range?.to,
      })}
    />
  }
>
  Check-in Date
</FilterPopover>
```

## 🔄 Data Flow

### Query & Mutations

```typescript
// Data fetching with TanStack Query
const { data: bookings, isLoading, error } = useBookings()

// Mutations
const updateBookingStatus = useUpdateBookingStatus()
const uploadPaymentProof = useUploadPaymentProof()
const cancelBooking = useCancelBooking()

// Update booking status
updateBookingStatus.mutate({
  bookingId: 'booking-123',
  status: 'confirmed',
})

// Upload payment proof
uploadPaymentProof.mutate({
  bookingId: 'booking-123',
  file: uploadedFile,
})

// Cancel booking
cancelBooking.mutate('booking-123')
```

### Optimistic Updates

```typescript
// Payment upload with optimistic update
const uploadPaymentProof = useMutation({
  mutationFn: ({ bookingId, file }) => uploadFile(bookingId, file),
  onMutate: async ({ bookingId }) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries(['bookings'])

    // Snapshot current state
    const previousBookings = queryClient.getQueryData(['bookings'])

    // Optimistically update
    queryClient.setQueryData(['bookings'], (old) =>
      old.map((booking) =>
        booking.booking_id === bookingId
          ? { ...booking, payment_status: 'pending' }
          : booking
      )
    )

    return { previousBookings }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['bookings'], context.previousBookings)
  },
  onSettled: () => {
    // Refetch after mutation
    queryClient.invalidateQueries(['bookings'])
  },
})
```

## 📊 Export Functionality

### CSV Export

Export filtered bookings with Philippine formatting:

```typescript
const handleExport = useCallback(() => {
  const filteredBookings = applyFilters(bookings, filters)

  exportBookings(filteredBookings, {
    filename: `bookings-${format(new Date(), 'yyyy-MM-dd')}`,
    philippineFormat: true,
    includeTimestamp: true,
  })

  toast.success(`Exported ${filteredBookings.length} bookings`)
}, [bookings, filters])
```

### Export Format

```csv
Booking Reference,Guest Name,Unit,Check-in,Check-out,Guests,Amount,Status,Payment Status
BKG-2024-001,John Doe,Beach Cottage,Dec 20 2024,Dec 22 2024,2,"₱4,500",Confirmed,Paid
BKG-2024-002,Jane Smith,Mountain Villa,Dec 23 2024,Dec 25 2024,4,"₱6,000",Pending,Unpaid
```

### Export Features

- CSV formula injection prevention
- UTF-8 BOM for Excel compatibility
- Philippine peso formatting
- Date formatting (MMM DD YYYY)
- Timestamp in filename
- Filtered data only

## 🎨 Professional Design System

### Enterprise Table Styling

```css
/* Dense, information-rich layout */
.booking-table tbody tr {
  height: 56px;  /* 14px vertical padding per row */
}

/* Monospace for numbers */
.font-mono {
  font-family: 'SF Mono', Monaco, 'Courier New';
  font-variant-numeric: tabular-nums;
}

/* Zebra striping */
tbody tr:nth-child(even) {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Hover state */
tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
```

### Status Color Coding

| Status | Variant | Color |
|--------|---------|-------|
| Confirmed | default | Blue |
| Pending | secondary | Gray |
| Checked In | default | Blue |
| Checked Out | outline | Neutral |
| Cancelled | destructive | Red |

### Column Width Strategy

| Column | Width | Justification |
|--------|-------|---------------|
| Guest | 180px | Name + contact info (2 lines) |
| Unit | 120px | Unit name |
| Dates | 100px | Check-in + check-out (2 lines) |
| Guests | 80px | Single number |
| Amount | 120px | Philippine peso (6-7 chars) |
| Status | 120px | Status badge |
| Actions | 80px | Action menu button |

## 🔐 Security Considerations

### Action Authorization

```typescript
// Check user permissions before allowing actions
const canEdit = hasPermission(user, 'bookings.edit')
const canDelete = hasPermission(user, 'bookings.delete')
const canCancel = hasPermission(user, 'bookings.cancel')

const actions = [
  { label: 'View', onClick: () => onView(booking) },
  canEdit && { label: 'Edit', onClick: () => onEdit(booking) },
  canCancel && { label: 'Cancel', onClick: () => onCancel(booking), variant: 'destructive' },
  canDelete && { label: 'Delete', onClick: () => onDelete(booking), variant: 'destructive' },
].filter(Boolean)
```

### Data Sanitization

- Search queries sanitized (regex injection prevention)
- Export data sanitized (CSV formula injection prevention)
- Phone numbers formatted (remove dangerous characters)
- Status values validated against enum

## 🧪 Testing

### Unit Tests

```typescript
describe('BookingsTable', () => {
  it('displays bookings correctly', () => {
    const bookings = [
      { booking_id: '1', guest_name: 'John Doe', total_amount: 5000 },
      { booking_id: '2', guest_name: 'Jane Smith', total_amount: 8000 },
    ]

    render(<BookingsTable />, {
      wrapper: createQueryWrapper({ bookings }),
    })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('₱5,000')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<BookingsTable />)

    await userEvent.click(screen.getByText(/status/i))
    await userEvent.click(screen.getByLabelText(/confirmed/i))

    expect(screen.queryByText('Pending Booking')).not.toBeInTheDocument()
    expect(screen.getByText('Confirmed Booking')).toBeInTheDocument()
  })

  it('exports filtered data', async () => {
    const { user } = renderWithUser(<BookingsTable />)

    await user.click(screen.getByText(/export/i))

    expect(mockExportBookings).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      expect.objectContaining({ philippineFormat: true })
    )
  })
})
```

### Integration Tests

```typescript
describe('Booking Management Flow', () => {
  it('uploads payment proof', async () => {
    render(<BookingsTable />)

    const uploadButton = screen.getByLabelText(/upload payment/i)
    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })

    await userEvent.upload(uploadButton, file)

    await waitFor(() => {
      expect(screen.getByText(/payment uploaded/i)).toBeInTheDocument()
    })
  })

  it('cancels booking with confirmation', async () => {
    render(<BookingsTable />)

    await userEvent.click(screen.getByLabelText(/more actions/i))
    await userEvent.click(screen.getByText(/cancel/i))

    await userEvent.click(screen.getByText(/confirm/i))

    await waitFor(() => {
      expect(screen.getByText(/booking cancelled/i)).toBeInTheDocument()
    })
  })
})
```

## 📚 Related Documentation

- [Table Utilities](/src/components/tables/README.md) - Reusable table components
- [Booking Store](/src/stores/useBookingStore.ts) - State management
- [TanStack Table](https://tanstack.com/table/latest) - Table library documentation
- [Audit Trail](/src/components/audit/README.md) - Audit logging for booking changes

## 🎯 Best Practices

1. ✅ **Use TanStack Query** for data fetching and mutations
2. ✅ **Implement optimistic updates** for better UX
3. ✅ **Provide loading states** during data fetching
4. ✅ **Handle error states** gracefully
5. ✅ **Sanitize search inputs** to prevent injection
6. ✅ **Use monospace fonts** for numeric data
7. ✅ **Format currencies** with Philippine peso
8. ✅ **Test responsive views** on mobile devices
9. ✅ **Validate actions** based on user permissions
10. ✅ **Export with security** (formula injection prevention)

## 🔧 Maintenance Notes

- Monitor table performance with large datasets (>1000 rows)
- Consider virtual scrolling for very large tables
- Test export functionality with edge case data
- Review column widths on different screen sizes
- Update filters when adding new booking statuses
- Test mobile card view on various devices
- Verify all action permissions are enforced
- Monitor mutation error rates
- Keep status badge colors consistent
- Test pagination with various page sizes

## 📈 Future Enhancements

- [ ] Bulk actions (select multiple bookings)
- [ ] Column visibility toggles
- [ ] Column reordering
- [ ] Advanced multi-column sorting
- [ ] Saved filter presets
- [ ] Real-time updates via Supabase Realtime
- [ ] Print-optimized view
- [ ] Email booking details directly from table
- [ ] Booking timeline view
- [ ] Advanced analytics integration
- [ ] Drag-and-drop for rescheduling
- [ ] Inline editing for quick updates
