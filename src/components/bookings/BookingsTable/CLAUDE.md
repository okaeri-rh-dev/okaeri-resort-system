# Bookings Table - AI Assistant Guide

## Module Purpose

Advanced data table for viewing and managing all bookings with real-time filtering, sorting, status updates, CSV export, and responsive mobile views. Implements TanStack Table v8 with Professional Enterprise Design System.

## Key Files

```
BookingsTable/
├── index.tsx (160 lines)                  # Main component
├── components/
│   ├── BookingCard.tsx (200 lines)       # Mobile card view
│   ├── BookingColumns.tsx (400 lines)    # Column definitions
│   ├── BookingFilters.tsx (250 lines)    # Filter controls
│   ├── QuickActions.tsx (150 lines)      # Bulk actions
│   └── StatusUpdateDialog.tsx (180 lines) # Status change modal
├── hooks/
│   ├── useBookingsTable.ts (300 lines)   # Table logic
│   └── useBookingActions.ts (200 lines)  # Action handlers
└── README.md                              # Full documentation
```

## Common Tasks

### 1. Display Bookings Table

```typescript
import { BookingsTable } from '@/components/bookings/BookingsTable'

function BookingsPage() {
  return (
    <BookingsTable
      onViewBooking={(booking) => navigate(`/bookings/${booking.booking_id}`)}
      onEditBooking={(booking) => navigate(`/bookings/${booking.booking_id}/edit`)}
      onUploadPayment={(booking) => setUploadModal(booking)}
    />
  )
}
```

### 2. Filter Bookings

```typescript
// Table automatically handles filtering via useBookingsTable hook
const {
  table,
  bookings,
  filters, // Current filter state
  setFilters, // Update filters
  searchQuery,
  setSearchQuery,
  resetFilters, // Clear all filters
} = useBookingsTable();

// Apply filters
setFilters({
  status: "confirmed",
  dateRange: {
    from: new Date("2024-12-01"),
    to: new Date("2024-12-31"),
  },
  minAmount: 5000,
  maxAmount: 20000,
});
```

### 3. Update Booking Status

```typescript
import { useBookingActions } from "./hooks/useBookingActions";

const { updateBookingStatus } = useBookingActions();

// Single status update
await updateBookingStatus(booking.booking_id, "confirmed");

// With reason/notes
await updateBookingStatus(booking.booking_id, "cancelled", {
  reason: "Guest requested cancellation",
  refund_amount: 1000,
});
```

### 4. Bulk Status Update

```typescript
// Select bookings (checkboxes in table)
const selectedBookings = table.getSelectedRowModel().rows.map((r) => r.original);

// Update all selected
await Promise.all(selectedBookings.map((b) => updateBookingStatus(b.booking_id, "confirmed")));

// Log bulk action
await logAuditEvent({
  action: "booking.bulk_status_update",
  entity_type: "booking",
  metadata: {
    booking_ids: selectedBookings.map((b) => b.booking_id),
    status: "confirmed",
    count: selectedBookings.length,
  },
});
```

### 5. Export to CSV

```typescript
import { exportBookingsToCSV } from "./utils/export";

// Export all bookings
exportBookingsToCSV(bookings, "all-bookings");

// Export filtered bookings only
const filteredBookings = applyFilters(bookings, filters, searchQuery);
exportBookingsToCSV(filteredBookings, "filtered-bookings");
```

## Column Configuration

```typescript
const columns = [
  {
    accessorKey: 'booking_reference',
    header: 'Reference',
    cell: (value) => <Badge>{value}</Badge>,
    size: 120,
  },
  {
    accessorKey: 'guest_name',
    header: 'Guest',
    cell: (value) => <span className="font-medium">{value}</span>,
    size: 200,
  },
  {
    accessorKey: 'unit.unit_name',
    header: 'Unit',
    size: 120,
  },
  {
    accessorKey: 'check_in',
    header: 'Check-in',
    cell: (value) => formatTableDate(value),  // MMM DD, YYYY
    size: 100,
  },
  {
    accessorKey: 'check_out',
    header: 'Check-out',
    cell: (value) => formatTableDate(value),
    size: 100,
  },
  {
    accessorKey: 'total_amount',
    header: 'Amount',
    cell: (value) => formatCurrency(value),  // ₱1,234.56
    size: 120,
  },
  {
    accessorKey: 'payment_status',
    header: 'Payment',
    cell: (value) => <PaymentStatusBadge status={value} />,
    size: 100,
  },
  {
    accessorKey: 'booking_status',
    header: 'Status',
    cell: (value) => <StatusBadge status={value} />,
    size: 100,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <ActionsMenu booking={row.original} />,
    size: 80,
  },
]
```

## Critical Patterns

### Responsive Table/Cards

```typescript
import { useResponsiveView } from '@/hooks'

const { isMobile } = useResponsiveView()

return isMobile ? (
  // Mobile: Stacked cards
  <div className="space-y-3">
    {bookings.map(booking => (
      <BookingCard key={booking.booking_id} booking={booking} />
    ))}
  </div>
) : (
  // Desktop: Full table
  <Table>
    <TableHeader>...</TableHeader>
    <TableBody>...</TableBody>
  </Table>
)
```

### Status Badge Colors

```typescript
function StatusBadge({ status }: { status: BookingStatus }) {
  const variants = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    checked_in: 'bg-blue-100 text-blue-800',
    checked_out: 'bg-neutral-100 text-neutral-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800',
  }

  return (
    <Badge className={variants[status]}>
      {status.replace('_', ' ')}
    </Badge>
  )
}
```

### Payment Status Indicators

```typescript
function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const icons = {
    pending: <Clock className="h-3 w-3" />,
    partial: <AlertCircle className="h-3 w-3" />,
    paid: <CheckCircle className="h-3 w-3" />,
    refunded: <RefreshCw className="h-3 w-3" />,
  }

  const colors = {
    pending: 'text-yellow-600',
    partial: 'text-orange-600',
    paid: 'text-green-600',
    refunded: 'text-blue-600',
  }

  return (
    <div className={`flex items-center gap-1 ${colors[status]}`}>
      {icons[status]}
      <span className="text-xs font-medium">{status}</span>
    </div>
  )
}
```

### Search Implementation

```typescript
// Multi-field search
const filteredBookings = bookings.filter((booking) => {
  const searchLower = searchQuery.toLowerCase();
  return (
    booking.booking_reference?.toLowerCase().includes(searchLower) ||
    booking.guest_name?.toLowerCase().includes(searchLower) ||
    booking.unit?.unit_name?.toLowerCase().includes(searchLower) ||
    booking.contact_number?.includes(searchLower) ||
    booking.total_amount.toString().includes(searchLower)
  );
});
```

### Date Range Filtering

```typescript
const filterByDateRange = (booking: Booking, dateRange: DateRange) => {
  if (!dateRange.from || !dateRange.to) return true;

  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);

  // Booking overlaps with date range
  return (
    (checkIn >= dateRange.from && checkIn <= dateRange.to) ||
    (checkOut >= dateRange.from && checkOut <= dateRange.to) ||
    (checkIn <= dateRange.from && checkOut >= dateRange.to)
  );
};
```

## Integration Points

### With Booking Store

```typescript
import { useBookingStore } from "@/stores/useBookingStore";

const { bookings, isLoading, error, updateBookingStatus, cancelBooking, uploadPaymentProof } =
  useBookingStore();

// Auto-refetch on mutations
const queryClient = useQueryClient();

const updateMutation = useMutation({
  mutationFn: (data) => db.bookings.update(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries(["bookings"]);
  },
});
```

### With Real-time Updates

```typescript
// Subscribe to booking changes
useEffect(() => {
  const subscription = supabase
    .channel("bookings-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
      },
      (payload) => {
        queryClient.invalidateQueries(["bookings"]);
        toast.info("Booking updated");
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### With Audit Logging

```typescript
// Log all status changes
const updateStatus = async (bookingId: string, newStatus: string) => {
  const before = bookings.find((b) => b.booking_id === bookingId);

  await db.bookings.update(bookingId, { booking_status: newStatus });

  await logAuditEvent({
    action: "booking.status.changed",
    entity_type: "booking",
    entity_id: bookingId,
    changes: {
      before: { booking_status: before.booking_status },
      after: { booking_status: newStatus },
    },
  });
};
```

## Common Gotchas

1. **Sorting with Nested Data**

   ```typescript
   // ✅ GOOD - Use accessor function
   columnHelper.accessor((row) => row.unit?.unit_name, {
     id: "unit_name",
     header: "Unit",
   });

   // ❌ BAD - Dot notation doesn't work with sorting
   accessorKey: "unit.unit_name";
   ```

2. **Date Comparison**

   ```typescript
   // ✅ GOOD - Parse dates correctly
   const checkIn = new Date(booking.check_in);
   const today = new Date();
   const isUpcoming = checkIn > today;

   // ❌ BAD - String comparison
   const isUpcoming = booking.check_in > new Date();
   ```

3. **Payment Proof Upload**

   ```typescript
   // ✅ GOOD - Handle file validation
   const handleUpload = async (file: File, booking: Booking) => {
     if (file.size > 2 * 1024 * 1024) {
       throw new Error("File too large");
     }

     const url = await uploadFile(file, booking.booking_id);

     await db.bookings.update(booking.booking_id, {
       payment_proof_url: url,
       payment_status: "pending_verification",
     });
   };
   ```

4. **Status Validation**

   ```typescript
   // ✅ GOOD - Validate status transitions
   const ALLOWED_TRANSITIONS = {
     pending: ["confirmed", "cancelled"],
     confirmed: ["checked_in", "cancelled", "no_show"],
     checked_in: ["checked_out"],
     // cancelled, checked_out, no_show: terminal states
   };

   const canTransition = (from: string, to: string) => {
     return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
   };
   ```

5. **CSV Export with Filters**

   ```typescript
   // ✅ GOOD - Export filtered data
   const handleExport = () => {
     const filtered = applyFilters(bookings, filters, searchQuery);
     exportBookingsToCSV(filtered, "bookings-export");
   };

   // ❌ BAD - Exports all data regardless of filters
   exportBookingsToCSV(bookings, "bookings");
   ```

## Testing Requirements

```typescript
describe('BookingsTable', () => {
  it('displays bookings with correct formatting', () => {
    const mockBookings = [
      {
        booking_reference: 'BKG-2024-001',
        guest_name: 'John Doe',
        total_amount: 5500,
        booking_status: 'confirmed',
      },
    ]

    render(<BookingsTable />)

    expect(screen.getByText('BKG-2024-001')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('₱5,500.00')).toBeInTheDocument()
  })

  it('filters bookings by status', async () => {
    render(<BookingsTable />)

    const statusFilter = screen.getByRole('combobox', { name: /status/i })
    fireEvent.change(statusFilter, { target: { value: 'confirmed' } })

    await waitFor(() => {
      expect(screen.queryByText(/pending/i)).not.toBeInTheDocument()
    })
  })

  it('updates booking status', async () => {
    render(<BookingsTable />)

    const actionsButton = screen.getAllByLabelText(/actions/i)[0]
    fireEvent.click(actionsButton)

    const updateButton = screen.getByText(/update status/i)
    fireEvent.click(updateButton)

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalled()
    })
  })
})
```

## Performance Notes

- Table virtualization for > 100 rows
- Column resizing persists to localStorage
- Search debounced by 300ms
- Filter application debounced by 150ms
- CSV export streams large datasets
- Mobile cards use pagination (10 per page)
- Desktop table shows 25 rows by default
- Real-time updates throttled to 2s minimum
