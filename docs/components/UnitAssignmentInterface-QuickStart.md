# UnitAssignmentInterface - Quick Start Guide

## Basic Integration (5 minutes)

### Step 1: Import the Component

```tsx
import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
```

### Step 2: Prepare Required Data

```tsx
// Example booking data structure
const booking = {
  booking_id: "550e8400-e29b-41d4-a716-446655440000",
  check_in_date: "2024-11-15",
  check_out_date: "2024-11-20",
  unit_requests: [
    { id: "req-001", guests_per_unit: 4 },
    { id: "req-002", guests_per_unit: 2 },
    { id: "req-003", guests_per_unit: 3 },
  ],
};
```

### Step 3: Implement Success Handler

```tsx
const handleAssignmentSuccess = () => {
  // Option 1: Show toast notification
  toast.success("Units assigned successfully!");

  // Option 2: Navigate to another page
  router.push("/admin/bookings/queue");

  // Option 3: Refresh parent data
  refetchBookings();

  // Option 4: Close modal
  closeModal();
};
```

### Step 4: Render the Component

```tsx
<UnitAssignmentInterface
  bookingId={booking.booking_id}
  checkInDate={booking.check_in_date}
  checkOutDate={booking.check_out_date}
  unitRequests={booking.unit_requests}
  onAssignmentSuccess={handleAssignmentSuccess}
/>
```

## Complete Example: Admin Booking Details Page

```tsx
"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BookingDetailsPageProps {
  bookingId: string;
}

export function BookingDetailsPage({ bookingId }: BookingDetailsPageProps) {
  const router = useRouter();
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch booking details
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch booking");
      return response.json();
    },
  });

  const handleAssignmentSuccess = () => {
    toast.success("Units assigned successfully!");
    setIsAssigning(false);

    // Navigate back to queue
    setTimeout(() => {
      router.push("/admin/bookings/queue");
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!booking) {
    return <div>Booking not found</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Unit Assignment</h1>
          <p className="text-sm text-neutral-600">
            Booking Reference: <span className="font-mono">{booking.booking_reference}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back to Queue
        </Button>
      </div>

      {/* Booking Summary */}
      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle className="text-base">Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-neutral-600">Guest Name</p>
            <p className="font-medium text-neutral-900">{booking.guest_name}</p>
          </div>
          <div>
            <p className="text-neutral-600">Contact</p>
            <p className="font-medium text-neutral-900">{booking.guest_contact}</p>
          </div>
          <div>
            <p className="text-neutral-600">Total Amount</p>
            <p className="font-mono font-medium text-neutral-900">
              ₱{booking.total_amount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-neutral-600">Payment Status</p>
            <p className="font-medium text-neutral-900">{booking.payment_status}</p>
          </div>
        </CardContent>
      </Card>

      {/* Unit Assignment Interface */}
      <UnitAssignmentInterface
        bookingId={booking.booking_id}
        checkInDate={booking.check_in_date}
        checkOutDate={booking.check_out_date}
        unitRequests={booking.unit_requests}
        onAssignmentSuccess={handleAssignmentSuccess}
      />
    </div>
  );
}
```

## Modal Integration Example

```tsx
"use client";

import { useState } from "react";

import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssignUnitsModalProps {
  booking: {
    booking_id: string;
    booking_reference: string;
    check_in_date: string;
    check_out_date: string;
    unit_requests: Array<{ id: string; guests_per_unit: number }>;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function AssignUnitsModal({ booking, isOpen, onClose }: AssignUnitsModalProps) {
  const handleSuccess = () => {
    toast.success("Units assigned successfully!");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Assign Units to Booking</DialogTitle>
          <DialogDescription>Reference: {booking.booking_reference}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto">
          <UnitAssignmentInterface
            bookingId={booking.booking_id}
            checkInDate={booking.check_in_date}
            checkOutDate={booking.check_out_date}
            unitRequests={booking.unit_requests}
            onAssignmentSuccess={handleSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Common Integration Patterns

### Pattern 1: Direct Page Integration

**Use Case**: Dedicated unit assignment page

**Benefits**:

- Full screen real estate
- Clear focus on task
- Easy navigation

```tsx
// pages/admin/bookings/[id]/assign-units.tsx
<UnitAssignmentInterface {...props} />
```

### Pattern 2: Modal Integration

**Use Case**: Quick assignment from queue

**Benefits**:

- Contextual workflow
- No navigation required
- Quick action

```tsx
// In queue component
<Dialog>
  <UnitAssignmentInterface {...props} />
</Dialog>
```

### Pattern 3: Sidebar Integration

**Use Case**: Split-screen workflow

**Benefits**:

- View booking details + assign simultaneously
- Multi-tasking capability

```tsx
// In booking details page
<div className="grid grid-cols-2 gap-6">
  <BookingDetails {...booking} />
  <UnitAssignmentInterface {...props} />
</div>
```

## Authentication Setup

The component expects a JWT token in localStorage:

```tsx
// In your login/auth flow
localStorage.setItem("auth_token", jwtToken);

// The component will automatically use it:
headers: {
  Authorization: `Bearer ${localStorage.getItem("auth_token")}`;
}
```

## Error Handling Examples

### Display Error Messages

```tsx
import { toast } from "sonner";

// The component handles errors internally via Alert components
// You can also add external error handling:

const handleAssignmentSuccess = () => {
  toast.success("Units assigned!");
};

// Errors are automatically displayed within the component
// No additional error handling required
```

### Custom Error Recovery

```tsx
const { data, error, refetch } = useQuery({
  queryKey: ["booking", bookingId],
  retry: 3, // Retry 3 times on failure
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

if (error) {
  return (
    <div>
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
      <Button onClick={() => refetch()}>Retry</Button>
    </div>
  );
}
```

## TypeScript Type Safety

```tsx
import type { UnitAssignmentInterfaceProps } from "@/components/admin/UnitAssignmentInterface";

// Use the exported types
const props: UnitAssignmentInterfaceProps = {
  bookingId: "uuid-string",
  checkInDate: "2024-11-15",
  checkOutDate: "2024-11-20",
  unitRequests: [{ id: "req-1", guests_per_unit: 4 }],
  onAssignmentSuccess: () => {},
};
```

## Performance Optimization

### Lazy Loading

```tsx
import { lazy, Suspense } from "react";

const UnitAssignmentInterface = lazy(() => import("@/components/admin/UnitAssignmentInterface"));

function BookingPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <UnitAssignmentInterface {...props} />
    </Suspense>
  );
}
```

### Memoization

```tsx
import { memo } from "react";

// Wrap component to prevent re-renders
const MemoizedUnitAssignment = memo(UnitAssignmentInterface);

// Use memoized version
<MemoizedUnitAssignment {...props} />;
```

## Testing Examples

### Vitest Unit Test

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UnitAssignmentInterface } from "./UnitAssignmentInterface";

describe("UnitAssignmentInterface", () => {
  const queryClient = new QueryClient();

  const defaultProps = {
    bookingId: "test-booking-id",
    checkInDate: "2024-11-15",
    checkOutDate: "2024-11-20",
    unitRequests: [
      { id: "req-1", guests_per_unit: 4 },
      { id: "req-2", guests_per_unit: 2 },
    ],
    onAssignmentSuccess: vi.fn(),
  };

  it("renders available units", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <UnitAssignmentInterface {...defaultProps} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Available Units/i)).toBeInTheDocument();
    });
  });

  it("selects units on click", async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <UnitAssignmentInterface {...defaultProps} />
      </QueryClientProvider>
    );

    const unitCard = await screen.findByText("Unit 101");
    await user.click(unitCard);

    expect(screen.getByText(/1\/2 selected/i)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: "No units available"

**Cause**: No units match the date range criteria

**Solution**:

1. Verify date range is correct
2. Check if units are blocked out
3. Confirm units exist in database

### Issue: "Failed to fetch available units"

**Cause**: API endpoint not responding or authentication failed

**Solution**:

1. Check auth token: `localStorage.getItem("auth_token")`
2. Verify API endpoint is running
3. Check network tab for error details

### Issue: Assignment fails with "Payment not verified"

**Cause**: Booking payment hasn't been verified yet

**Solution**:

1. Navigate to payment verification interface
2. Verify payment proof first
3. Then proceed with unit assignment

### Issue: Button stays disabled

**Cause**: Validation not passing

**Solution**:

1. Check alert message for specific validation error
2. Ensure exactly `unitRequests.length` units are selected
3. Not more, not less (all-or-nothing rule)

## Best Practices

1. **Always handle success callback**: Provide user feedback and navigation
2. **Test with various unit counts**: 1 unit, 3 units, 10+ units
3. **Test mobile responsiveness**: Verify grid layout on small screens
4. **Implement error recovery**: Allow users to retry failed operations
5. **Add loading states**: Show feedback during async operations
6. **Cache management**: Understand query invalidation impacts
7. **Accessibility testing**: Use keyboard-only navigation to verify
8. **Monitor performance**: Watch for slow queries on large unit lists

---

**Need Help?**

- Full Documentation: `/docs/components/UnitAssignmentInterface.md`
- API Documentation: `/docs/api/admin-endpoints.md`
- Issue Tracker: GitHub Issues
