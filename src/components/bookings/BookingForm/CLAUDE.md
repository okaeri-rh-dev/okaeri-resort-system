# Booking Form - AI Assistant Guide

## Module Purpose

Multi-step wizard for creating and editing bookings with dynamic pricing calculation, real-time availability checking, and file upload support. This is the primary booking creation interface for authenticated users.

## Key Files

```
BookingForm/
├── index.tsx (185 lines)              # Main form orchestrator
├── steps/
│   ├── UnitSelectionStep.tsx (142 lines)   # Step 1: Unit + dates
│   ├── GuestInformationStep.tsx (187 lines) # Step 2: Guest details
│   ├── PaymentDetailsStep.tsx (150 lines)  # Step 3: Payment info
│   └── ReviewStep.tsx (200 lines)          # Step 4: Confirm & submit
├── hooks/
│   ├── useBookingForm.ts (250 lines)       # Form state & logic
│   └── usePricingCalculation.ts (180 lines) # Dynamic pricing
└── README.md                           # Full documentation
```

## Form Flow

```
Step 1: Unit Selection
  → Select unit from dropdown
  → Choose check-in/check-out dates
  → Enter number of guests
  → Real-time availability check
  → Calculate pricing preview

Step 2: Guest Information
  → New guest: Full form (name, email, phone, address)
  → Existing guest: Search and select
  → Auto-fill guest details if found
  → Validate contact information

Step 3: Payment Details
  → Payment method (Cash, GCash, Bank Transfer, Credit Card)
  → Payment amount (auto-populated from pricing)
  → Upload payment proof (optional)
  → Notes/special requests

Step 4: Review & Confirm
  → Review all entered data
  → Final pricing breakdown
  → Terms & conditions
  → Submit booking
```

## Common Tasks

### 1. Initialize Form for New Booking

```typescript
import { BookingForm } from '@/components/bookings/BookingForm'

function NewBookingPage() {
  return (
    <BookingForm
      mode="create"
      onSuccess={(booking) => {
        navigate(`/bookings/${booking.booking_id}`)
      }}
      onCancel={() => navigate('/bookings')}
    />
  )
}
```

### 2. Edit Existing Booking

```typescript
<BookingForm
  mode="edit"
  bookingId="uuid-here"
  initialData={existingBooking}
  onSuccess={(booking) => {
    toast.success('Booking updated successfully')
    navigate(`/bookings/${booking.booking_id}`)
  }}
/>
```

### 3. Pricing Calculation

```typescript
import { usePricingCalculation } from './hooks/usePricingCalculation'

const { pricing, isCalculating } = usePricingCalculation({
  unitId: selectedUnit,
  checkIn: new Date('2024-12-20'),
  checkOut: new Date('2024-12-22'),
  numGuests: 4,
})

// pricing structure:
{
  baseRate: 2000,              // Per night rate
  nights: 2,                   // Number of nights
  subtotal: 4000,              // baseRate × nights
  weekendSurcharge: 500,       // Weekend nights × surcharge
  extraPersonFee: 1000,        // (4 guests - 2 base) × 2 nights × ₱500
  totalAmount: 5500,           // Final total
  breakdown: [
    { date: '2024-12-20', rate: 2000, isWeekend: false },
    { date: '2024-12-21', rate: 2500, isWeekend: true },  // Saturday
  ]
}
```

## Critical Patterns

### Step Navigation

```typescript
const { currentStep, nextStep, prevStep, goToStep } = useBookingForm();

// Validate before advancing
const handleNext = async () => {
  const isValid = await trigger(); // React Hook Form validation
  if (isValid) {
    nextStep();
  }
};

// Always allow going back
const handlePrev = () => {
  prevStep(); // No validation needed
};
```

### Availability Checking

```typescript
import { checkUnitAvailability } from "@/lib/availability";

const checkAvailability = useCallback(async () => {
  if (!unitId || !checkIn || !checkOut) return;

  setIsCheckingAvailability(true);

  const isAvailable = await checkUnitAvailability(
    unitId,
    checkIn,
    checkOut,
    bookingId // Exclude current booking when editing
  );

  if (!isAvailable) {
    setError("check_in", {
      message: "Unit not available for selected dates",
    });
  }

  setIsCheckingAvailability(false);
  return isAvailable;
}, [unitId, checkIn, checkOut, bookingId]);
```

### Guest Autocomplete

```typescript
// In GuestInformationStep
const [searchQuery, setSearchQuery] = useState("");

const { data: guests } = useQuery({
  queryKey: ["guests", searchQuery],
  queryFn: () => db.guests.search(searchQuery),
  enabled: searchQuery.length >= 2, // Min 2 characters
});

const handleSelectGuest = (guest: Guest) => {
  setValue("guest_id", guest.guest_id);
  setValue("guest_name", guest.name);
  setValue("email", guest.email);
  setValue("contact_number", guest.phone_number);
  // Auto-fill other guest fields...
};
```

### File Upload (Payment Proof)

```typescript
const handleFileUpload = async (file: File) => {
  // Validate file
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("File must be less than 2MB");
  }

  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    throw new Error("Only JPG, PNG, and PDF files allowed");
  }

  // Upload to Cloudflare R2
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .upload(`${bookingId}/${file.name}`, file);

  if (error) throw error;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-proofs").getPublicUrl(data.path);

  setValue("payment_proof_url", publicUrl);
};
```

## Validation Schema

```typescript
import { differenceInDays } from "date-fns";
import { z } from "zod";

const bookingFormSchema = z
  .object({
    // Step 1: Unit Selection
    unit_id: z.string().uuid("Please select a unit"),
    check_in: z.date().min(new Date(), "Check-in must be in the future"),
    check_out: z.date(),
    num_guests: z.number().int().min(1).max(20),

    // Step 2: Guest Information
    guest_id: z.string().uuid().optional(),
    guest_name: z.string().min(2).max(100),
    email: z.string().email(),
    contact_number: z
      .string()
      .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/),

    // Step 3: Payment
    payment_method: z.enum(["Cash", "GCash", "Bank Transfer", "Credit Card"]),
    payment_amount: z.number().positive(),
    payment_proof_url: z.string().url().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  })
  .refine(
    (data) => {
      const nights = differenceInDays(data.check_out, data.check_in);
      return nights >= 1 && nights <= 30;
    },
    {
      message: "Stay must be between 1 and 30 nights",
      path: ["check_out"],
    }
  );
```

## Integration Points

### With Unit Store

```typescript
import { useUnitStore } from "@/stores/useUnitStore";

const { units, fetchUnits } = useUnitStore();

// Load available units on mount
useEffect(() => {
  fetchUnits();
}, []);

// Filter by availability
const availableUnits = units.filter((u) => u.unit_status === "Available");
```

### With Guest Store

```typescript
import { useGuestStore } from "@/stores/useGuestStore";

const { guests, findOrCreateGuest } = useGuestStore();

const handleSubmit = async (data) => {
  // Find existing guest or create new one
  const guest = await findOrCreateGuest({
    name: data.guest_name,
    email: data.email,
    phone_number: data.contact_number,
  });

  // Create booking with guest_id
  await createBooking({
    ...data,
    guest_id: guest.guest_id,
  });
};
```

### With Booking Store

```typescript
import { useBookingStore } from "@/stores/useBookingStore";

const { createBooking, updateBooking } = useBookingStore();

const handleSubmit = async (data) => {
  const booking =
    mode === "create" ? await createBooking(data) : await updateBooking(bookingId, data);

  // Log to audit trail
  await logAuditEvent({
    action: `booking.${mode === "create" ? "created" : "updated"}`,
    entity_type: "booking",
    entity_id: booking.booking_id,
    changes: { before: initialData, after: booking },
  });

  onSuccess(booking);
};
```

## Common Gotchas

1. **Weekend Rate Calculation**

   ```typescript
   // ✅ GOOD - Check both check-in and all nights
   const isWeekendRate = (date: Date, unit: Unit) => {
     return isWeekend(date) && unit.weekend_rate ? unit.weekend_rate : unit.base_rate;
   };

   // ❌ BAD - Only checks check-in date
   const rate = isWeekend(checkIn) ? weekendRate : baseRate;
   ```

2. **Extra Person Fee**

   ```typescript
   // ✅ GOOD - Calculate per night
   const extraPersonFee =
     (numGuests - unit.base_occupancy) * unit.extra_person_rate * numberOfNights;

   // ❌ BAD - Missing nights multiplier
   const fee = (numGuests - baseOccupancy) * extraPersonRate;
   ```

3. **Availability Exclusion**

   ```typescript
   // ✅ GOOD - Exclude current booking when editing
   const isAvailable = await checkUnitAvailability(
     unitId,
     checkIn,
     checkOut,
     bookingId // Current booking to exclude
   );

   // ❌ BAD - Would block editing existing booking
   const isAvailable = await checkUnitAvailability(unitId, checkIn, checkOut);
   ```

4. **Step Validation**

   ```typescript
   // ✅ GOOD - Validate current step fields only
   const handleNext = async () => {
     const stepFields = getStepFields(currentStep);
     const isValid = await trigger(stepFields);
     if (isValid) nextStep();
   };

   // ❌ BAD - Validates all fields, blocks progression
   const isValid = await trigger();
   ```

5. **File Upload Before Submit**

   ```typescript
   // ✅ GOOD - Upload file, then submit with URL
   const handleSubmit = async (data) => {
     let paymentProofUrl = data.payment_proof_url;

     if (paymentProofFile) {
       const uploaded = await uploadFile(paymentProofFile);
       paymentProofUrl = uploaded.url;
     }

     await createBooking({ ...data, payment_proof_url: paymentProofUrl });
   };

   // ❌ BAD - Submits with File object
   await createBooking(data); // data.payment_proof is File
   ```

## Testing Requirements

```typescript
describe('BookingForm', () => {
  it('navigates through all steps', async () => {
    render(<BookingForm mode="create" />)

    // Step 1
    await selectUnit('unit-1')
    await selectDates('2024-12-20', '2024-12-22')
    await setGuests(2)
    await clickNext()

    // Step 2
    await fillGuestInfo({ name: 'John Doe', email: 'john@example.com' })
    await clickNext()

    // Step 3
    await selectPaymentMethod('Cash')
    await clickNext()

    // Step 4
    expect(screen.getByText(/review/i)).toBeInTheDocument()
    await clickSubmit()

    expect(mockCreateBooking).toHaveBeenCalled()
  })

  it('calculates pricing correctly', async () => {
    const { result } = renderHook(() => usePricingCalculation({
      unitId: 'unit-1',
      checkIn: new Date('2024-12-20'),  // Friday
      checkOut: new Date('2024-12-22'),  // Sunday (includes Saturday)
      numGuests: 4,
    }))

    await waitFor(() => {
      expect(result.current.pricing).toEqual({
        baseRate: 2000,
        nights: 2,
        subtotal: 4000,
        weekendSurcharge: 500,  // Saturday surcharge
        extraPersonFee: 1000,   // 2 extra × ₱500 × 2 nights
        totalAmount: 5500,
      })
    })
  })
})
```

## Performance Notes

- Form state persists in React Hook Form (no unnecessary re-renders)
- Pricing calculation debounced by 300ms
- Availability checking debounced by 500ms
- Guest search debounced by 300ms (min 2 characters)
- File upload shows progress bar for files > 500KB
- Step transitions are instant (no data fetching between steps)
