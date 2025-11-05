# 🛡️ Admin Components - Multi-Unit Booking Workflows

## Overview

The Admin components provide **business-critical workflows** for managing multi-unit guest bookings. These components handle payment verification, unit assignment, and booking queue management with enterprise-grade validation and real-time updates.

**Business Context**: Multi-unit bookings require manual admin approval to ensure proper payment verification and coordinated unit assignment (all-or-nothing principle).

## 📁 Directory Structure

```
admin/
├── PendingBookingsQueue.tsx      # Dashboard for pending bookings
├── PaymentProofViewer.tsx        # Payment verification interface
└── UnitAssignmentInterface.tsx   # Multi-unit assignment system
```

## 📦 Components

### 1. PendingBookingsQueue

**Purpose**: Admin dashboard displaying all pending multi-unit bookings sorted by urgency.

**Features**:
- Real-time updates (30-second auto-refresh)
- Color-coded urgency badges (critical, high, medium, low)
- Multi-dimensional filtering (search, urgency level, date range)
- Urgency scoring algorithm (based on check-in proximity, payment status, creation time)
- Mobile-responsive table design
- Direct navigation to verification/assignment workflows

**Data Source**: `/api/admin/pending-bookings` endpoint

**Urgency Levels**:
```typescript
type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

// Critical: Check-in within 24 hours OR payment pending >72 hours
// High: Check-in within 3 days OR payment pending >48 hours
// Medium: Check-in within 7 days OR payment pending >24 hours
// Low: All others
```

**Filter Options**:
- **Search**: By booking reference or guest name
- **Urgency**: Critical, High, Medium, Low, or All
- **Date Range**: Today, Next 7 Days, Next 30 Days, or All

**Actions**:
- If payment verified → Navigate to unit assignment
- If payment pending → Navigate to payment verification

**Real-World Usage**: `/admin` route for booking management dashboard

---

### 2. PaymentProofViewer

**Purpose**: Professional interface for verifying payment proof uploads (images or PDFs).

**Features**:
- **Dual file type support**: PDF and images (JPG, PNG)
- **Signed URL management**: Automatic generation and renewal (Cloudflare R2)
- **PDF viewer**: Multi-page navigation with react-pdf
- **Image viewer**: Zoom, pan, reset with react-zoom-pan-pinch
- **Verification workflow**: Verify or reject with reason
- **Expiry handling**: Auto-renewal 1 minute before signed URL expiration
- **Status badges**: Visual indicators for Pending/Verified/Rejected states

**Props Interface**:
```typescript
interface PaymentProofViewerProps {
  bookingId: string;
  paymentProofPath: string | null;                    // R2 object path
  currentPaymentStatus: 'Pending' | 'Verified' | 'Rejected';
  onStatusChange?: () => void;                        // Callback after action
}
```

**Workflow**:
1. **View Payment Proof**:
   - Generate signed URL from R2 path
   - Display PDF with pagination OR image with zoom controls
   - Auto-renew signed URL every 30 seconds (checks expiry)

2. **Verify Payment**:
   - Confirmation dialog
   - POST `/api/admin/verify-payment` with `action: "verify"`
   - Updates booking status to Confirmed
   - Enables unit assignment

3. **Reject Payment**:
   - Require rejection reason (textarea)
   - POST `/api/admin/verify-payment` with `action: "reject"` + reason
   - Updates payment status to Rejected
   - Notifies guest to re-upload proof

**Signed URL Security**:
- Initial expiry: 1 hour
- Auto-renewal: 1 minute before expiration
- Renewal interval check: Every 30 seconds
- Error handling: Displays "Session expired" message

**Real-World Usage**: `/admin/verify-payment/$bookingId` route

---

### 3. UnitAssignmentInterface

**Purpose**: Enterprise interface for assigning units to multi-unit bookings with all-or-nothing enforcement.

**Features**:
- **All-or-nothing validation**: Must assign ALL requested units
- **Real-time validation feedback**: Color-coded alerts
- **Available units grid**: Displays all available units for date range
- **Information-dense layout**: Optimized for rapid selection
- **Keyboard navigation**: Full accessibility support (Space/Enter to toggle)
- **Mobile responsive**: 1/2/3 column grid
- **Visual selection state**: Highlighted cards with checkboxes
- **Confirmation dialog**: Native confirm before assignment

**Props Interface**:
```typescript
interface UnitAssignmentInterfaceProps {
  bookingId: string;
  checkInDate: string;          // YYYY-MM-DD
  checkOutDate: string;          // YYYY-MM-DD
  unitRequests: UnitRequest[];   // Array of unit requests with guest counts
  onAssignmentSuccess: () => void;
}

interface UnitRequest {
  id: string;
  guests_per_unit: number;
}
```

**Unit Information Display**:
```typescript
interface AvailableUnit {
  unit_id: string;
  unit_number: string;
  unit_type: string;
  max_capacity: number;
  rate_per_night: number;
  floor_level?: number | null;
  view_type?: string | null;
}
```

**Validation Logic**:
```typescript
// Selected < Required
❌ "Must select ALL 3 units (currently selected: 1)" - Destructive

// Selected > Required
❌ "Too many units selected. Need exactly 3, but selected 4" - Destructive

// Selected === Required
✅ "All units selected - ready to assign" - Success (green)
```

**Assignment Flow**:
1. **Load Available Units**: GET `/api/admin/available-units?check_in_date=...&check_out_date=...`
2. **User Selection**: Toggle units (visual feedback + validation)
3. **Validation Check**: Ensure exactly N units selected
4. **Confirm Dialog**: Native confirmation prompt
5. **Assignment**: POST `/api/admin/assign-units` with `booking_id` + `unit_ids[]`
6. **Success**: Invalidate caches, clear selection, notify parent

**Error Handling**:
- Payment not verified → "Payment verification required before unit assignment"
- Unit conflict detected → "Unit conflict detected. Please refresh and try again"
- All-or-nothing violation → "All units must be assigned together"

**Real-World Usage**: `/admin/assign-units/$bookingId` route

---

## 🎯 Business Logic

### Admin Workflow Sequence

```
┌────────────────────────────────────────────────────────┐
│ 1. Guest Submits Multi-Unit Booking                   │
│    - Selects multiple units                            │
│    - Uploads payment proof                             │
│    - Booking status: Pending                           │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 2. PendingBookingsQueue                                │
│    - Admin views all pending bookings                  │
│    - Sorted by urgency score                           │
│    - Filter by urgency/date/search                     │
│    - Click "Verify Payment" or "Assign Units"          │
└──────────────────────┬─────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
┌───────────────────────┐  ┌─────────────────────────────┐
│ 3a. PaymentVerification│  │ 3b. Skip to Assignment     │
│     (if not verified)  │  │     (if already verified)  │
│                        │  │                             │
│  - View payment proof  │  └──────────────┬──────────────┘
│  - Verify or Reject    │                 │
│  - Update status       │                 │
└───────┬───────────────┘                 │
        │                                  │
        ▼                                  │
┌─────────────────────────────────────────┴──────────────┐
│ 4. UnitAssignmentInterface                             │
│    - View available units for date range               │
│    - Select exactly N units (all-or-nothing)           │
│    - Confirm assignment                                │
│    - POST to assignment endpoint                       │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 5. Booking Confirmed                                   │
│    - Units assigned to booking_units table             │
│    - Booking status: Confirmed                         │
│    - Guest receives confirmation email                 │
│    - Booking appears in regular bookings view          │
└────────────────────────────────────────────────────────┘
```

### All-or-Nothing Principle

**Why**: Prevents partial bookings where a guest requests 3 units but only 2 are assigned.

**Enforcement**:
- UnitAssignmentInterface validates selection count
- Backend API validates assignment count
- Database transaction ensures atomic insertion
- Failure rolls back all unit assignments

**User Experience**:
- Real-time validation feedback (✅/❌ alerts)
- Disabled assign button until validation passes
- Clear messaging: "Must select ALL 3 units"
- Confirmation dialog before final assignment

---

## 🚀 Best Practices

### 1. Payment Verification Workflow

**✅ DO**: Always check payment proof before unit assignment
```typescript
// PendingBookingsQueue determines the flow
if (booking.payment_status === 'Verified') {
  // Navigate to unit assignment
  navigate(`/admin/assign-units/${bookingId}`);
} else {
  // Navigate to payment verification first
  navigate(`/admin/verify-payment/${bookingId}`);
}
```

**✅ DO**: Provide rejection reasons for guest communication
```typescript
// PaymentProofViewer requires reason
const handleReject = () => {
  if (!rejectionReason.trim()) {
    setError('Rejection reason is required');
    return;
  }
  verifyMutation.mutate({
    booking_id: bookingId,
    action: 'reject',
    reason: rejectionReason,  // Sent to guest via email
  });
};
```

### 2. Unit Assignment

**✅ DO**: Validate all-or-nothing before assignment
```typescript
const getValidationStatus = (): AssignmentValidation => {
  const requiredCount = unitRequests.length;
  const selectedCount = selectedUnits.size;

  if (selectedCount !== requiredCount) {
    return {
      isValid: false,
      message: `Must select ALL ${requiredCount} units`,
      variant: 'destructive',
    };
  }

  return { isValid: true, variant: 'default' };
};
```

**✅ DO**: Use confirmation dialog for destructive actions
```typescript
const handleAssignment = () => {
  const confirmed = window.confirm(
    `Confirm unit assignment?\n\nThis will assign ${selectedUnits.size} unit(s).\n\nThis action cannot be undone.`
  );

  if (confirmed) {
    assignMutation.mutate(Array.from(selectedUnits));
  }
};
```

### 3. Real-Time Updates

**✅ DO**: Use appropriate refetch intervals
```typescript
// PendingBookingsQueue
useQuery({
  queryKey: ['pending-multi-unit-bookings'],
  queryFn: fetchPendingBookings,
  refetchInterval: 30000,  // 30 seconds - balance freshness & server load
  staleTime: 25000,         // 25 seconds - mark stale before refetch
});
```

**✅ DO**: Invalidate related queries after mutations
```typescript
// After payment verification or unit assignment
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['pending-multi-unit-bookings'] });
  queryClient.invalidateQueries({ queryKey: ['available-units'] });
  queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
};
```

### 4. Signed URL Management

**✅ DO**: Implement auto-renewal for long sessions
```typescript
useEffect(() => {
  if (!urlExpiry) return;

  const checkAndRenew = async () => {
    if (shouldRenewSignedUrl(urlExpiry, 60)) {  // 1 min before expiry
      const { url, expiresAt } = await renewSignedUrl(path, 3600);
      setSignedUrl(url);
      setUrlExpiry(expiresAt);
    }
  };

  const interval = setInterval(checkAndRenew, 30000);  // Check every 30s
  return () => clearInterval(interval);
}, [urlExpiry]);
```

### 5. Accessibility

**✅ DO**: Implement keyboard navigation for unit selection
```typescript
<div
  role="button"
  tabIndex={0}
  aria-pressed={isSelected}
  aria-label={`Unit ${unit.unit_number} - ${isSelected ? 'selected' : 'not selected'}`}
  onClick={() => handleUnitToggle(unit.unit_id)}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleUnitToggle(unit.unit_id);
    }
  }}
>
```

**✅ DO**: Provide clear status indicators
```typescript
// Use color-coded badges with semantic meaning
<Badge variant={status === 'Verified' ? 'default' : 'destructive'}>
  {status}
</Badge>

// Include icons for visual reinforcement
{validation.isSuccess ? (
  <CheckCircle2 className="h-4 w-4 text-green-600" />
) : (
  <AlertTriangle className="h-4 w-4" />
)}
```

### 6. Error Handling

**✅ DO**: Parse specific error messages for user-friendly display
```typescript
onError: (error: Error) => {
  let errorMessage = error.message;

  if (errorMessage.includes('payment')) {
    errorMessage = 'Payment verification required before unit assignment';
  } else if (errorMessage.includes('conflict')) {
    errorMessage = 'Unit conflict detected. Please refresh and try again';
  }

  setAssignmentError(errorMessage);
};
```

### 7. Mobile Responsiveness

**✅ DO**: Use responsive grid layouts
```typescript
// UnitAssignmentInterface
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {/* Units display 1 col on mobile, 2 on tablet, 3 on desktop */}
</div>

// Filter controls stack vertically on mobile
<div className="flex flex-col gap-4 sm:flex-row">
  <Input />
  <Select />
  <Select />
</div>
```

---

## 🔗 Related Documentation

- **Multi-Unit Booking System**: `/docs/implementation/guest-booking-multi-unit/` - Complete implementation guide
- **Admin API Endpoints**: `/functions/api/admin/` - Backend API documentation
- **Urgency Scoring**: `/src/lib/urgency-scoring.ts` - Urgency calculation algorithm
- **Storage Utils**: `/src/lib/storage-utils.ts` - Signed URL generation
- **Audit Trail**: All admin actions are logged to audit_logs table

---

## 📈 Impact Metrics

### Business Impact
- **Payment verification time**: Reduced from manual email checking to instant verification
- **Unit assignment accuracy**: 100% (all-or-nothing enforcement)
- **Admin efficiency**: Urgency-based queue reduces missed bookings
- **Guest experience**: Faster confirmation after payment upload

### Technical Metrics
- **Real-time updates**: 30-second refresh for queue freshness
- **Validation enforcement**: Client + server validation prevents errors
- **Accessibility**: WCAG 2.1 AA compliant (keyboard navigation, ARIA labels)
- **Mobile support**: Fully responsive design (1/2/3 column grids)

### Urgency Scoring Results
- **Critical bookings**: Immediately visible at top of queue
- **Payment delays**: Highlighted for follow-up
- **Date proximity**: Prioritizes imminent check-ins
- **Filter efficiency**: Admins can focus on specific urgency levels

---

## 💻 Development Notes

### Component Dependencies
- **TanStack Query**: Data fetching, caching, mutations
- **react-pdf**: PDF document rendering
- **react-zoom-pan-pinch**: Image zoom/pan functionality
- **shadcn/ui**: UI component library (Card, Alert, Dialog, Table, etc.)
- **Lucide Icons**: Consistent icon system

### API Integration Points
- `GET /api/admin/pending-bookings` - Fetch pending bookings with urgency scores
- `GET /api/admin/available-units?check_in_date&check_out_date` - Fetch available units
- `POST /api/admin/verify-payment` - Verify or reject payment
- `POST /api/admin/assign-units` - Assign units to booking

### State Management Patterns
- **Local state**: Component-specific UI state (selections, dialogs)
- **TanStack Query**: Server state (bookings, units, verification status)
- **Query invalidation**: Cascade updates across related queries
- **Optimistic updates**: Not used (requires server confirmation for business operations)

### Future Enhancements
- [ ] Bulk payment verification (select multiple bookings)
- [ ] Unit preference suggestions (based on guest history)
- [ ] Email preview before sending rejection notices
- [ ] Assignment history/audit trail view
- [ ] Export queue to CSV for reporting

---

**Last Updated**: January 2025
**Maintained by**: Okaeri Development Team
**Questions?**: See [CLAUDE.md](../../../CLAUDE.md) for development guidelines
