# Multi-Unit Booking Integration Guide

**Phase 4 Deliverable** - Integration pattern documentation for Phase 5 implementation

---

## Overview

This document describes how to integrate the new multi-unit booking components with the existing `BookingForm`. The components are ready to use but require refactoring the form flow to support multiple unit selection.

## New Components (Phase 4 Complete)

All components are fully implemented, tested, and ready for integration:

1. **MultiUnitSelector** - Browse and select multiple units
2. **UnitCardList** - Display selected units with editing
3. **MultiUnitPricingSummary** - Comprehensive pricing breakdown
4. **GuestAssignment** - Modal for guest-to-unit assignment
5. **FilterPanel** - Reusable filter component

## Current State (Single-Unit Booking)

```typescript
// Current Step 1: UnitSelection.tsx
<Select onValueChange={field.onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Choose accommodation" />
  </SelectTrigger>
  <SelectContent>
    {units.map((unit) => (
      <SelectItem key={unit.unit_id} value={unit.unit_id}>
        {unit.unit_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Target State (Multi-Unit Booking)

### Option A: Replace Step 1 (Recommended)

Replace the dropdown in `UnitSelection.tsx` with `MultiUnitSelector`:

```typescript
// Updated Step 1: UnitSelection.tsx
import { MultiUnitSelector } from "@/components/bookings/MultiUnitSelector";
import { UnitCardList } from "@/components/bookings/UnitCardList";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

export function UnitSelection({ form, units, checkIn, checkOut }: UnitSelectionProps) {
  const {
    selectedUnits,
    addUnit,
    removeUnit,
    assignGuestsToUnit,
    getTotalAmount,
  } = useMultiUnitBookingStore();

  const handleAddUnit = (unit: Unit) => {
    // Convert Unit to BookingUnit
    const bookingUnit: BookingUnit = {
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      unit_code: unit.unit_code,
      unit_type: unit.unit_type,
      max_occupancy: unit.max_occupancy,
      base_occupancy: unit.base_occupancy,
      base_rate: unit.base_rate,
      weekend_rate: unit.weekend_rate,
      extra_person_rate: unit.extra_person_rate,
      pricing: {
        nights: 0, // Will be calculated
        base_total: 0,
        weekend_surcharge: 0,
        extra_person_fee: 0,
        unit_total: 0,
      },
      availability: {
        is_available: true,
        checking: false,
      },
    };

    addUnit(bookingUnit);
  };

  return (
    <div className="space-y-6">
      {/* Date Selection (Keep existing Calendar UI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Check-in and Check-out date pickers */}
      </div>

      {/* Multi-Unit Selector */}
      <MultiUnitSelector
        units={units}
        selectedUnits={selectedUnits}
        checkIn={checkIn}
        checkOut={checkOut}
        onAddUnit={handleAddUnit}
        onRemoveUnit={removeUnit}
        onViewDetails={(unitId) => {
          // Open unit details modal
        }}
      />

      {/* Selected Units List */}
      {selectedUnits.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Selected Units ({selectedUnits.length})</h3>
          <UnitCardList
            units={selectedUnits}
            onRemove={removeUnit}
            onUpdateGuestCount={(unitId, count) => {
              assignGuestsToUnit(unitId, [], count);
            }}
            onAssignGuests={(unitId) => {
              // Open GuestAssignment modal
              setGuestAssignmentOpen(true);
              setSelectedUnitForAssignment(unitId);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

### Option B: New Multi-Unit Booking Form (Alternative)

Create a separate `MultiUnitBookingForm` for greenfield implementation:

```typescript
// New file: src/components/bookings/MultiUnitBookingForm.tsx
export function MultiUnitBookingForm({ onSuccess, onCancel }: Props) {
  const form = useForm({
    // Multi-unit specific schema
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Unit Booking</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* Step 1: Date Selection + Multi-Unit Selector */}
          {/* Step 2: Guest Information (primary contact) */}
          {/* Step 3: Guest Assignment (per unit) */}
          {/* Step 4: Payment & Review */}
        </Form>
      </CardContent>
    </Card>
  );
}
```

## Integration Checklist

### Step 1: Store Integration

- [ ] Import `useMultiUnitBookingStore` in form
- [ ] Replace `selectedUnit` state with `selectedUnits` array
- [ ] Update pricing calculation to use `getTotalAmount()`
- [ ] Handle multi-unit availability checking

### Step 2: Component Replacement

- [ ] Replace `<Select>` with `<MultiUnitSelector>` in UnitSelection step
- [ ] Add `<UnitCardList>` to show selected units
- [ ] Add `<MultiUnitPricingSummary>` to show pricing breakdown
- [ ] Add `<GuestAssignment>` modal with state management

### Step 3: Form Schema Updates

```typescript
// Before (single unit)
const schema = z.object({
  unit_id: z.string().uuid(),
  num_guests: z.number(),
  // ...
});

// After (multi-unit)
const schema = z.object({
  units: z
    .array(
      z.object({
        unit_id: z.string().uuid(),
        num_guests: z.number(),
        special_requests: z.string().optional(),
      })
    )
    .min(1, "At least one unit required")
    .max(10, "Maximum 10 units"),
  primary_guest: z.object({
    guest_name: z.string(),
    email: z.string().email(),
    contact_number: z.string(),
  }),
  // ...
});
```

### Step 4: API Submission

```typescript
// Before (single unit)
const handleSubmit = async (data) => {
  await createBooking({
    unit_id: data.unit_id,
    guest_name: data.guest_name,
    // ...
  });
};

// After (multi-unit)
const handleSubmit = async (data) => {
  await createMultiUnitBooking({
    booking_units: selectedUnits.map((unit) => ({
      unit_id: unit.unit_id,
      guest_assignment: unit.guest_assignment,
      pricing: unit.pricing,
    })),
    primary_guest: {
      guest_name: data.guest_name,
      email: data.email,
      contact_number: data.contact_number,
    },
    check_in: data.check_in,
    check_out: data.check_out,
    // ...
  });
};
```

## Testing Integration

### Unit Tests

```typescript
describe("Multi-Unit Booking Form Integration", () => {
  it("allows selecting multiple units", async () => {
    render(<UnitSelection units={mockUnits} />);

    // Add first unit
    await userEvent.click(screen.getByText("Ocean View"));
    await userEvent.click(screen.getByText("Add to Booking"));

    expect(screen.getByText("1 of 10 units selected")).toBeInTheDocument();

    // Add second unit
    await userEvent.click(screen.getByText("Garden Villa"));
    await userEvent.click(screen.getByText("Add to Booking"));

    expect(screen.getByText("2 of 10 units selected")).toBeInTheDocument();
  });

  it("calculates total for multiple units", () => {
    const { result } = renderHook(() => useMultiUnitBookingStore());

    act(() => {
      result.current.addUnit(mockUnit1); // ₱5,000
      result.current.addUnit(mockUnit2); // ₱3,000
    });

    expect(result.current.getTotalAmount()).toBe(8000);
  });
});
```

### E2E Tests (Phase 5)

```typescript
test("complete multi-unit booking flow", async ({ page }) => {
  await page.goto("/bookings/new");

  // Step 1: Select units
  await page.selectOption("#check-in", "2025-12-20");
  await page.selectOption("#check-out", "2025-12-22");

  await page.click('button:has-text("Add to Booking")').first();
  await page.click('button:has-text("Add to Booking")').nth(1);

  expect(await page.textContent(".selected-units-count")).toBe("2 of 10 units selected");

  // Step 2: Guest info
  await page.click('button:has-text("Next")');
  await page.fill("#guest_name", "John Doe");
  await page.fill("#email", "john@example.com");

  // Step 3: Payment
  await page.click('button:has-text("Next")');
  await page.selectOption("#payment_method", "GCash");

  // Step 4: Review & Submit
  await page.click('button:has-text("Next")');
  expect(await page.textContent(".total-amount")).toBe("₱8,000.00");

  await page.click('button:has-text("Confirm Booking")');

  await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+/);
});
```

## Migration Strategy (Phase 5)

### Approach 1: Feature Flag (Recommended)

```typescript
import { useFeatureFlag } from "@/lib/feature-flags";

export function BookingForm() {
  const isMultiUnitEnabled = useFeatureFlag("multi-unit-booking");

  return isMultiUnitEnabled ? <MultiUnitBookingForm /> : <SingleUnitBookingForm />;
}
```

### Approach 2: Direct Replacement

1. Backup current `BookingForm` to `LegacyBookingForm`
2. Update `BookingForm` to use multi-unit components
3. Test thoroughly with existing bookings
4. Rollback plan: Restore from backup

### Approach 3: Separate Route

```typescript
// Keep existing form
/bookings/new → SingleUnitBookingForm

// Add new route
/bookings/new-multi → MultiUnitBookingForm

// Link from dashboard
<Link to="/bookings/new-multi">Book Multiple Units</Link>
```

## Known Considerations

### Data Migration

- Existing single-unit bookings remain unchanged
- New multi-unit bookings use `booking_units` table
- Both types can coexist in the system

### Backwards Compatibility

- Keep single-unit booking flow for simple bookings
- Add "Book Multiple Units" option in UI
- Default to single-unit for backward compatibility

### Performance

- Multi-unit availability checking is batched (Phase 2 API)
- Pricing calculation is debounced (Phase 3 store)
- Components use React.memo where appropriate

## Next Steps (Phase 5)

1. **Integration Testing**: Comprehensive E2E tests for multi-unit flow
2. **Form Refactoring**: Integrate components into existing BookingForm
3. **API Integration**: Connect to Phase 2 multi-unit endpoints
4. **Migration Plan**: Roll out multi-unit bookings safely
5. **User Testing**: Validate UX with real users

---

**Status**: ✅ Components ready, integration pattern documented
**Phase**: 4 (UI Components) → Ready for Phase 5 (Integration & Testing)
**Created**: 2025-10-09
**Last Updated**: 2025-10-09
