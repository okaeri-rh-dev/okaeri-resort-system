# Unit Assignment Route - Integration Checklist

## Post-Implementation Tasks

### 1. Route Tree Regeneration ✅ REQUIRED

The route file has been created, but TanStack Router needs to regenerate the route tree to recognize it.

**Run one of:**

```bash
# Option 1: Start dev server (auto-generates)
npm run dev

# Option 2: Manual generation
npx tsr generate

# Option 3: Watch mode
npx tsr watch
```

**Verify:** Check that `src/routeTree.gen.ts` includes the new route.

### 2. API Endpoint Verification 🔧 BACKEND

Ensure the following endpoint exists and returns correct data:

**Endpoint:** `GET /api/admin/bookings/:bookingId`

**Headers:**

```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response Schema:**

```typescript
{
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in_date: string;        // "YYYY-MM-DD"
  check_out_date: string;       // "YYYY-MM-DD"
  total_amount: number;
  payment_status: "Pending" | "Verified" | "Rejected";
  unit_assignment_status: "pending" | "assigned" | "partial";
  payment_proof_path: string | null;
  requested_unit_count: number;
  unit_requests: [              // Array of unit requests
    {
      id: string;
      guests_per_unit: number;
    }
  ];
  created_at: string;
}
```

**Test with curl:**

```bash
curl -X GET "http://localhost:5173/api/admin/bookings/{bookingId}" \
  -H "Authorization: Bearer {your-token}" \
  -H "Content-Type: application/json"
```

### 3. Update Admin Queue Links 📝 FRONTEND

Update the `PendingBookingsQueue` component to link to the new route after payment verification.

**File:** `src/components/admin/PendingBookingsQueue.tsx`

**Change needed:**

```typescript
// Find the "Assign Units" button/link and update to:
<Button
  onClick={() => navigate({ to: `/admin/assign-units/${bookingId}` })}
>
  Assign Units
</Button>
```

### 4. Navigation Flow Update 🔄 FRONTEND

Update the payment verification success handler to redirect to unit assignment.

**File:** `src/routes/admin.verify-payment.$bookingId.tsx`

**Change needed:**

```typescript
const handleStatusChange = () => {
  if (booking?.payment_status === "Verified") {
    // Change this line:
    window.location.href = `/admin/assign-units/${bookingId}`;
  } else {
    window.location.href = "/admin/queue";
  }
};
```

### 5. Authentication (Optional) 🔐 SECURITY

Add authentication guard if needed:

**File:** `src/routes/admin.assign-units.$bookingId.tsx`

**Add to route definition:**

```typescript
export const Route = createFileRoute("/admin/assign-units/$bookingId")({
  component: AssignUnitsPage,
  beforeLoad: async () => {
    const session = await auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.pathname } });
    }
    // Check admin role
    const userRole = session.user?.user_metadata?.role;
    if (userRole !== "admin" && userRole !== "manager") {
      throw redirect({ to: "/dashboard" });
    }
  },
});
```

### 6. Testing 🧪 QA

#### Manual Testing Checklist

- [ ] **Test 1: Valid booking with verified payment**
  - Navigate to route with valid bookingId
  - Verify booking summary displays correctly
  - Verify unit assignment interface loads
  - Select units and complete assignment
  - Verify redirect back to queue

- [ ] **Test 2: Payment not verified guard**
  - Navigate with booking that has payment_status = "Pending"
  - Verify payment guard displays
  - Click "Verify Payment" button
  - Verify redirect to payment verification page

- [ ] **Test 3: Already assigned guard**
  - Navigate with booking that has unit_assignment_status = "assigned"
  - Verify already assigned guard displays
  - Click "View Booking Details"
  - Verify redirect to booking details page

- [ ] **Test 4: Booking not found**
  - Navigate with invalid bookingId
  - Verify error state displays
  - Click "Retry" button
  - Verify refetch attempt

- [ ] **Test 5: Loading state**
  - Use network throttling to slow response
  - Verify loading spinner displays
  - Verify loading message is clear

- [ ] **Test 6: Mobile responsiveness**
  - Open route on mobile viewport (375px)
  - Verify layout is responsive
  - Test all buttons are tappable
  - Verify cards stack properly

#### Automated Testing

**Unit Tests** - Create test file:

```typescript
// src/routes/__tests__/admin.assign-units.$bookingId.test.tsx

import { render, screen, waitFor } from "@testing-library/react";

import { Route } from "../admin.assign-units.$bookingId";

describe("Admin Unit Assignment Route", () => {
  it("shows loading state while fetching", () => {
    // Test implementation
  });

  it("displays payment guard when not verified", () => {
    // Test implementation
  });

  it("displays already assigned guard when complete", () => {
    // Test implementation
  });

  it("shows unit assignment interface when ready", () => {
    // Test implementation
  });
});
```

### 7. Documentation Updates 📚

- [x] Route implementation summary created
- [x] Quick reference guide created
- [ ] Update main README with new route
- [ ] Add route to API documentation
- [ ] Update architecture diagrams (if any)

### 8. Performance Verification ⚡

**Check bundle size:**

```bash
npm run build:size
```

**Expected:** Route should be code-split automatically. Check that `admin.assign-units.$bookingId-[hash].js` is a separate chunk.

**Verify caching:**

```bash
# In browser DevTools > Network tab
# Navigate to route twice
# Second load should show cached query (no API call)
```

### 9. Error Monitoring Setup 📊

Add error tracking for production:

```typescript
// In route file, add error boundary wrapper
import * as Sentry from "@sentry/react";

// Wrap component with error boundary
export const Route = createFileRoute("/admin/assign-units/$bookingId")({
  component: Sentry.withErrorBoundary(AssignUnitsPage, {
    fallback: <ErrorFallback />,
  }),
});
```

### 10. Deployment Checklist 🚀

- [ ] All TypeScript errors resolved
- [ ] ESLint passes with no errors
- [ ] Route tree regenerated
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] API endpoints verified
- [ ] Navigation flow updated
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Staging deployment tested
- [ ] Production deployment approved

## Quick Test Commands

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Run tests
npm test

# Build
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Issue: Route returns 404

**Solution:** Regenerate route tree with `npm run dev` or `npx tsr generate`

### Issue: Types not working

**Solution:** Restart TypeScript server in IDE and ensure `@/` alias is configured

### Issue: Component imports fail

**Solution:** Verify all imported components exist at specified paths

### Issue: Navigation doesn't work

**Solution:** Check TanStack Router setup and verify route is in route tree

### Issue: Guards not triggering

**Solution:** Verify booking data structure matches `BookingDetail` interface

## Support Resources

- [TanStack Router Documentation](https://tanstack.com/router/latest)
- [Project CLAUDE.md](./CLAUDE.md)
- [Implementation Summary](./ROUTE_IMPLEMENTATION_SUMMARY.md)
- [Quick Reference](./docs/routes/admin-assign-units.md)

## Sign-off

When all checklist items are complete:

- [ ] Developer Sign-off: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- [ ] QA Sign-off: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- [ ] Product Sign-off: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

---

**Created:** 2025-10-28
**Last Updated:** 2025-10-28
**Status:** Ready for Integration ✅
