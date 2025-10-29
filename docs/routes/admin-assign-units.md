# Admin Unit Assignment Route

## Quick Reference

### Route URL

```
/admin/assign-units/:bookingId
```

### File Location

```
src/routes/admin.assign-units.$bookingId.tsx
```

## Usage

### Navigation to Route

```typescript
// From admin queue or other pages
import { useNavigate } from "@tanstack/react-router";

const navigate = useNavigate();

// Navigate to unit assignment
navigate({ to: `/admin/assign-units/${bookingId}` });

// Or with window.location
window.location.href = `/admin/assign-units/${bookingId}`;
```

### Prerequisites

Before accessing this route, the booking must:

1. ✅ Exist in the database
2. ✅ Have payment verified (`payment_status === "Verified"`)
3. ✅ Not already have units assigned (`unit_assignment_status !== "assigned"`)

### Guard Behavior

The route automatically handles these scenarios:

| Condition              | Guard                     | Action                                                   |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| Loading data           | `LoadingState`            | Shows spinner with "Loading booking details..."          |
| Booking not found      | `ErrorState`              | Shows error with retry button and back to queue link     |
| Payment not verified   | `PaymentNotVerifiedGuard` | Shows warning with "Verify Payment" button               |
| Units already assigned | `AlreadyAssignedGuard`    | Shows success message with "View Booking Details" button |
| All checks pass        | Main Interface            | Displays unit assignment interface                       |

## API Requirements

### Endpoint

```
GET /api/admin/bookings/:bookingId
Authorization: Bearer {token}
Content-Type: application/json
```

### Expected Response

```typescript
{
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in_date: string; // ISO date: "2025-06-15"
  check_out_date: string; // ISO date: "2025-06-20"
  total_amount: number;
  payment_status: "Pending" | "Verified" | "Rejected";
  unit_assignment_status: "pending" | "assigned" | "partial";
  payment_proof_path: string | null;
  requested_unit_count: number;
  unit_requests: Array<{
    id: string;
    guests_per_unit: number;
  }>;
  created_at: string;
}
```

## Integration with UnitAssignmentInterface

The route passes these props to the core assignment component:

```typescript
<UnitAssignmentInterface
  bookingId={bookingId}
  checkInDate={booking.check_in_date}
  checkOutDate={booking.check_out_date}
  unitRequests={booking.unit_requests || []}
  onAssignmentSuccess={handleAssignmentSuccess}
/>
```

## Success Flow

When units are successfully assigned:

1. `UnitAssignmentInterface` calls `onAssignmentSuccess()`
2. Native alert shows: "Units successfully assigned to booking [REF]!"
3. User is redirected to `/admin/queue`
4. Page fully reloads to show fresh queue data

## Error Handling

### Network Errors

- Displays error message with details
- Provides "Retry" button to refetch data
- Shows "Back to Queue" navigation option

### Validation Errors

- Guard components prevent invalid state access
- Clear messaging for each error condition
- Actionable next steps for users

## Testing Checklist

- [ ] Route loads with valid bookingId
- [ ] Loading state displays correctly
- [ ] Error state shows for invalid bookingId
- [ ] Payment guard blocks unverified bookings
- [ ] Already assigned guard blocks completed bookings
- [ ] Unit assignment interface renders for valid bookings
- [ ] Success handler navigates back to queue
- [ ] All buttons have correct navigation
- [ ] Mobile layout is responsive
- [ ] TypeScript types are correct

## Common Issues & Solutions

### Issue: Route not found (404)

**Solution**: Regenerate route tree with `npm run dev` or `npx tsr generate`

### Issue: "Cannot find module" errors

**Solution**: Ensure all component imports use correct paths with `@/` alias

### Issue: Guard not triggering

**Solution**: Check booking data matches expected interface, especially `payment_status` and `unit_assignment_status` fields

### Issue: Navigation not working

**Solution**: Verify TanStack Router setup and route tree includes the new route

## Development Tips

### Hot Reload

Route changes hot reload automatically in development mode. No need to restart server.

### Debugging

Add console logs in guards to trace execution:

```typescript
if (booking.payment_status !== "Verified") {
  console.log("Payment guard triggered:", booking.payment_status);
  return <PaymentNotVerifiedGuard ... />;
}
```

### Testing Guards

Test each guard independently by mocking different booking states:

```typescript
// Mock unverified payment
const mockBooking = {
  ...validBooking,
  payment_status: "Pending",
};
```

## Route Parameters

### Path Parameters

- `bookingId` (string, required) - UUID of the booking

### Query Parameters

None currently. Can be added for filtering or state preservation.

### Navigation State

Can be extended to pass state between routes:

```typescript
navigate({
  to: `/admin/assign-units/${bookingId}`,
  state: { fromQueue: true },
});
```

## Accessibility Features

- ✅ Semantic HTML structure
- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ ARIA attributes on interactive elements
- ✅ Color contrast compliance
- ✅ Focus management

## Performance Optimization

- **Query Caching**: 30-second stale time reduces API calls
- **Code Splitting**: Route automatically code-split by TanStack Router
- **Early Returns**: Guards prevent unnecessary component rendering
- **Optimized Re-renders**: React best practices followed

## Related Routes

- `/pending-bookings` - Admin queue (entry point)
- `/admin/verify-payment/:bookingId` - Payment verification (previous step)
- `/bookings/:bookingId` - Booking details (view after assignment)

## Component Tree

```
admin.assign-units.$bookingId.tsx
  ├── AssignUnitsPage (Main)
  │   ├── useQuery (Data Fetching)
  │   ├── LoadingState
  │   ├── ErrorState
  │   ├── PaymentNotVerifiedGuard
  │   ├── AlreadyAssignedGuard
  │   └── Main Interface
  │       ├── Header
  │       ├── Booking Summary Card
  │       ├── Payment Verified Badge
  │       └── UnitAssignmentInterface
  │           ├── Unit Requests Summary
  │           ├── Validation Status
  │           ├── Available Units Grid
  │           └── Assignment Button
```

## Quick Links

- [Implementation Summary](../../ROUTE_IMPLEMENTATION_SUMMARY.md)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [UnitAssignmentInterface Component](../../src/components/admin/UnitAssignmentInterface.tsx)
- [Payment Verification Route](../../src/routes/admin.verify-payment.$bookingId.tsx)

---

**Last Updated**: 2025-10-28
**Version**: 1.0.0
