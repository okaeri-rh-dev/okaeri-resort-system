# UnitAssignmentInterface Component Documentation

## Overview

Professional enterprise interface for assigning units to multi-unit bookings with all-or-nothing enforcement. This component provides a high-density, information-rich interface optimized for rapid unit selection by resort administrators.

**File**: `src/components/admin/UnitAssignmentInterface.tsx`

## Features

### Core Functionality

- **All-or-Nothing Enforcement**: Enforces selection of exactly the required number of units before allowing assignment
- **Real-Time Validation**: Provides immediate visual feedback on selection status
- **Available Units Query**: Fetches units available for the specified date range using TanStack Query v5
- **Assignment Mutation**: Posts unit assignments with optimistic updates and error handling
- **Success Callback**: Triggers parent component notification on successful assignment

### Enterprise Design

- **Information Density**: Compact layout maximizing data display
- **Professional Styling**: Conservative design with high contrast and minimal color
- **Monospace Typography**: Applied to all numeric data (unit numbers, capacity, rates)
- **Touch-Friendly**: 44px minimum tap targets for mobile operations
- **Keyboard Navigation**: Full keyboard support with visible focus indicators

### Accessibility (WCAG 2.1 AA Compliant)

- **ARIA Labels**: Descriptive labels for screen readers
- **Focus Management**: Clear focus indicators with ring styles
- **Keyboard Shortcuts**: Space/Enter to toggle unit selection
- **Role Attributes**: Proper semantic roles (button, alert)
- **High Contrast**: Minimum 4.5:1 text contrast ratio

## Props Interface

```typescript
interface UnitAssignmentInterfaceProps {
  bookingId: string; // UUID of the booking
  checkInDate: string; // YYYY-MM-DD format
  checkOutDate: string; // YYYY-MM-DD format
  unitRequests: UnitRequest[]; // Array of unit requests with guest counts
  onAssignmentSuccess: () => void; // Callback after successful assignment
}

interface UnitRequest {
  id: string; // Unique request identifier
  guests_per_unit: number; // Number of guests for this unit
}
```

## API Endpoints

### Available Units Query

**Endpoint**: `GET /api/admin/available-units`

**Query Parameters**:

- `check_in_date`: YYYY-MM-DD format
- `check_out_date`: YYYY-MM-DD format

**Headers**:

- `Authorization`: Bearer token from localStorage

**Response**:

```typescript
{
  units: Array<{
    unit_id: string;
    unit_number: string;
    unit_type: string;
    max_capacity: number;
    rate_per_night: number;
    floor_level?: number | null;
    view_type?: string | null;
  }>;
}
```

**Cache Strategy**:

- `staleTime`: 5 minutes (300,000ms)
- `refetchOnWindowFocus`: true
- Query key: `["available-units", checkInDate, checkOutDate]`

### Assignment Mutation

**Endpoint**: `POST /api/admin/assign-units`

**Headers**:

- `Authorization`: Bearer token from localStorage
- `Content-Type`: application/json

**Request Body**:

```typescript
{
  booking_id: string;
  unit_ids: string[]; // Array of unit UUIDs
}
```

**Success Response**: Status 200

```typescript
{
  success: true;
  booking_id: string;
  assigned_units: string[];
}
```

**Error Responses**:

- `400`: Payment not verified, all-or-nothing violation
- `409`: Unit conflict detected
- `500`: Server error

**On Success**:

- Invalidates `["pending-multi-unit-bookings"]`
- Invalidates `["available-units"]`
- Invalidates `["booking", bookingId]`
- Calls `onAssignmentSuccess()` callback

## State Management

### Local State

```typescript
const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
const [assignmentError, setAssignmentError] = useState<string | null>(null);
```

### Query State (TanStack Query)

- **availableUnits**: Fetched available units for date range
- **isLoadingUnits**: Loading state for units query
- **fetchError**: Error state for units query

### Mutation State

- **assignMutation.isPending**: Assignment in progress
- **assignMutation.isError**: Assignment failed
- **assignMutation.error**: Error object with message

## Validation Logic

### All-or-Nothing Validation

```typescript
interface AssignmentValidation {
  isValid: boolean;
  message: string;
  variant: "success" | "destructive";
}
```

**Validation Rules**:

1. **No Selection**: `selectedCount === 0`
   - Invalid, message: "Select X unit(s) to proceed"
   - Variant: destructive

2. **Insufficient Selection**: `selectedCount < requiredCount`
   - Invalid, message: "Must select ALL X units (currently selected: Y)"
   - Variant: destructive

3. **Excess Selection**: `selectedCount > requiredCount`
   - Invalid, message: "Too many units selected. Need exactly X, but selected Y"
   - Variant: destructive

4. **Complete Selection**: `selectedCount === requiredCount`
   - Valid, message: "All units selected - ready to assign"
   - Variant: success

## UI Components

### 1. Unit Requests Summary Card

**Purpose**: Display booking requirements overview

**Layout**: 3-column grid (stacks to 1 column on mobile)

**Displayed Data**:

- Total Units Requested (monospace, 2xl font)
- Total Guests (monospace, 2xl font)
- Date Range (formatted dates)
- Individual Unit Breakdown (badge layout)

**Styling**:

- Border: `border-neutral-200`
- Padding: `p-4`
- Background: `bg-white`

### 2. All-or-Nothing Status Indicator

**Purpose**: Real-time validation feedback

**Variants**:

- **Success** (green): All units selected, ready to proceed
  - Icon: `CheckCircle2`
  - Background: `bg-green-50`
  - Border: `border-green-200`

- **Destructive** (red): Incomplete or invalid selection
  - Icon: `AlertTriangle`
  - Background: `bg-red-50`
  - Border: `border-red-200`

**Progress Counter**: `X/Y selected` (monospace font)

### 3. Available Units Grid

**Layout**:

- Mobile: 1 column
- Tablet (sm): 2 columns
- Desktop (lg): 3 columns
- Gap: 12px (gap-3)

**Unit Card Styling**:

- **Default State**:
  - Border: 2px solid `neutral-200`
  - Background: `white`
  - Hover: Shadow + `neutral-300` border

- **Selected State**:
  - Border: 2px solid `blue-600`
  - Background: `blue-50` (50% opacity)
  - Shadow: `shadow-sm`

- **Focus State**:
  - Ring: 2px `blue-500`
  - Ring offset: 2px

**Unit Card Content**:

```
┌─────────────────────────────┐
│ Unit 101           [✓]      │  ← Checkbox (top-right)
│ Deluxe Ocean View           │  ← Unit type
│ ─────────────────────       │
│ Max Capacity:     4 guests  │  ← Monospace numbers
│ Rate/Night:    ₱2,500.00   │  ← Philippine currency
│ Floor:                   3  │  ← Optional field
│ View:              Ocean    │  ← Optional field
└─────────────────────────────┘
```

### 4. Assignment Button

**Location**: Full-width footer with gray background

**States**:

- **Enabled**: All validation passed
  - Icon: `CheckCircle2`
  - Text: "Assign X Unit(s) to Booking"

- **Disabled**: Validation failed or mutation in progress
  - Opacity: 50%
  - Cursor: not-allowed

- **Loading**: Mutation in progress
  - Icon: `Loader2` (animated spin)
  - Text: "Assigning Units..."

**Confirmation**: Native `window.confirm()` dialog before mutation

## Interaction Patterns

### Unit Selection

**Click Interaction**:

```typescript
onClick={() => handleUnitToggle(unit.unit_id)}
```

**Keyboard Interaction**:

```typescript
onKeyDown={(e) => handleKeyboardToggle(e, unit.unit_id)}
// Accepts: Space or Enter keys
```

**Toggle Logic**:

```typescript
const handleUnitToggle = (unitId: string) => {
  setSelectedUnits((prev) => {
    const next = new Set(prev);
    if (next.has(unitId)) {
      next.delete(unitId); // Deselect
    } else {
      next.add(unitId); // Select
    }
    return next;
  });
  setAssignmentError(null); // Clear errors on interaction
};
```

### Assignment Flow

1. **User selects units**: Click/keyboard to toggle selection
2. **Real-time validation**: Alert updates with each selection
3. **Button enabled**: When exactly required units selected
4. **User clicks "Assign"**: Validation check runs
5. **Confirmation dialog**: Native browser confirm
6. **Mutation executes**: POST request with selected units
7. **Success handling**:
   - Query invalidation
   - Parent callback
   - State reset
8. **Error handling**:
   - Display error in Alert
   - Keep selection intact
   - Allow retry

## Error Handling

### Fetch Errors

**Display**: Alert with destructive variant

**Common Errors**:

- Network failure: "Failed to fetch available units"
- Authentication: "Unauthorized - please log in again"
- Server error: "Server error occurred"

**User Actions**: Retry button (triggers query refetch)

### Assignment Errors

**Display**: Alert with destructive variant below status indicator

**Parsed Error Messages**:

- Payment error: "Payment verification required before unit assignment"
- Conflict error: "Unit conflict detected. Please refresh and try again"
- All-or-nothing error: "All units must be assigned together"
- Generic: Original error message

**User Actions**: Fix issue and retry (button remains functional)

### Empty State

**Condition**: No units available for date range

**Display**: Alert with warning variant

**Message**: "No units available for the selected dates (YYYY-MM-DD to YYYY-MM-DD). Please contact the guest to reschedule."

**Icon**: `AlertTriangle`

## Responsive Design

### Breakpoints

| Screen Size        | Grid Columns | Adjustments                          |
| ------------------ | ------------ | ------------------------------------ |
| Mobile (< 640px)   | 1            | Full-width cards, stacked summary    |
| Tablet (≥ 640px)   | 2            | Side-by-side cards, 3-column summary |
| Desktop (≥ 1024px) | 3            | Maximum density, optimal scanning    |

### Mobile Optimizations

- **Touch Targets**: Minimum 44px tap areas
- **Card Padding**: 16px (p-4) for comfortable spacing
- **Button**: Full-width on all screen sizes
- **Summary Grid**: Stacks to single column
- **Font Sizes**: Maintain readability (no smaller than 14px)

## Accessibility Features

### Screen Reader Support

**ARIA Attributes**:

```jsx
aria-pressed={isSelected}
aria-label={`Unit ${unit.unit_number} - ${unit.unit_type}, ${isSelected ? "selected" : "not selected"}`}
aria-hidden="true" // For decorative checkbox
```

**Role Attributes**:

- `role="button"` on unit cards
- `role="alert"` on validation alerts

### Keyboard Navigation

**Tab Order**:

1. Summary card (not focusable)
2. Status alert (not focusable)
3. Unit cards (each receives focus)
4. Assignment button

**Interactive Elements**:

- Unit cards: `tabIndex={0}` (in tab order)
- Checkboxes: `tabIndex={-1}` (visual only, not in tab order)

**Keyboard Shortcuts**:

- `Tab`: Navigate between unit cards
- `Space` or `Enter`: Toggle unit selection
- `Shift+Tab`: Navigate backwards

### Visual Focus Indicators

**Focus Ring**:

```css
focus:outline-none
focus:ring-2
focus:ring-blue-500
focus:ring-offset-2
```

**High Contrast**: All interactive elements have visible focus states

## Performance Considerations

### Query Optimization

- **Cache Duration**: 5 minutes (avoids redundant fetches)
- **Refetch on Focus**: Ensures data freshness when tab regains focus
- **Parallel Queries**: Only one query per component instance

### Mutation Optimization

- **No Optimistic Updates**: Wait for server confirmation (data integrity)
- **Selective Invalidation**: Only invalidate affected queries
- **Error Recovery**: Preserve state on error for easy retry

### Rendering Optimization

- **Memoization**: Consider wrapping in `React.memo` if parent re-renders frequently
- **Virtual Scrolling**: Not implemented (typically <100 units)
- **Image Loading**: No images in this interface (text-only)

## Usage Example

```tsx
import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";

function BookingDetailsPage() {
  const booking = useBookingQuery(bookingId);

  const handleAssignmentSuccess = () => {
    toast.success("Units assigned successfully!");
    router.push("/admin/bookings");
  };

  if (!booking.data) return <Loader />;

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-2xl font-semibold">
        Assign Units - {booking.data.booking_reference}
      </h1>

      <UnitAssignmentInterface
        bookingId={booking.data.booking_id}
        checkInDate={booking.data.check_in_date}
        checkOutDate={booking.data.check_out_date}
        unitRequests={booking.data.unit_requests}
        onAssignmentSuccess={handleAssignmentSuccess}
      />
    </div>
  );
}
```

## Testing Considerations

### Unit Tests

**Test Cases**:

1. Renders loading state correctly
2. Displays available units grid
3. Toggles unit selection on click
4. Toggles unit selection on keyboard (Space/Enter)
5. Validates all-or-nothing rules
6. Disables button when validation fails
7. Enables button when exactly required units selected
8. Displays error messages correctly
9. Calls onAssignmentSuccess on mutation success
10. Invalidates queries on success

### Integration Tests

**Test Scenarios**:

1. Fetch available units for date range
2. Select units and submit assignment
3. Handle assignment errors gracefully
4. Handle no available units scenario
5. Handle fetch errors with retry

### Accessibility Tests

**Test Requirements**:

1. Keyboard navigation works correctly
2. Focus indicators are visible
3. Screen reader labels are descriptive
4. ARIA attributes are correct
5. Color contrast meets WCAG AA standards

## Design System Compliance

### Professional Enterprise Principles

✅ **Information Density**: Compact layout, minimal whitespace
✅ **Operational Efficiency**: Quick selection, instant feedback
✅ **Professional Reliability**: Conservative styling, clear states
✅ **Accessibility**: WCAG 2.1 AA compliant
✅ **Mobile-First**: Responsive grid, touch-friendly
✅ **Monospace Typography**: Numeric data alignment
✅ **High Contrast**: 4.5:1 minimum ratio
✅ **Enterprise Color System**: Blue primary, neutral grays

### Color Usage

- **Primary (Blue)**: Selected states, focus rings, assignment button
- **Destructive (Red)**: Validation errors, assignment failures
- **Success (Green)**: Validation success indicator
- **Neutral (Gray)**: Borders, backgrounds, secondary text
- **White**: Card backgrounds, text on colored elements

## Related Components

- **PendingBookingsQueue**: Lists bookings awaiting assignment
- **PaymentProofViewer**: Verifies payment before assignment
- **BookingDetailsCard**: Displays full booking information

## Related API Endpoints

- `GET /api/admin/available-units`: Fetches available units
- `POST /api/admin/assign-units`: Assigns units to booking
- `GET /api/admin/pending-bookings`: Lists pending bookings
- `POST /api/admin/verify-payment`: Verifies payment proof

## Future Enhancements

### Phase 3 Considerations

1. **Drag-and-Drop**: Allow drag units into assignment slots
2. **Bulk Operations**: Assign multiple bookings simultaneously
3. **Smart Suggestions**: AI-powered unit recommendations
4. **Conflict Resolution**: Real-time conflict detection and alternatives
5. **Assignment History**: Track who assigned which units when
6. **Unit Preferences**: Remember guest preferences for future bookings

## Maintenance Notes

### Dependencies

- `@tanstack/react-query@^5.x`: Data fetching and caching
- `lucide-react@^0.x`: Icon library
- `@/components/ui/*`: shadcn/ui components
- `@/lib/utils`: Utility functions (cn)

### Environment Variables

- `VITE_SUPABASE_URL`: Supabase project URL (for auth token)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key (for auth)

### Breaking Changes

**v1.0.0 → v2.0.0** (if applicable):

- Props interface unchanged
- API response format stable
- No breaking changes planned

---

**Last Updated**: 2024-10-28
**Component Version**: 1.0.0
**Status**: Production Ready
