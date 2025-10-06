# 📝 Multi-Step Booking Form Documentation

## Overview

The Multi-Step Booking Form is a **sophisticated wizard-style component** for creating and editing resort bookings through a guided, user-friendly interface. This module implements a 4-step workflow with **real-time availability checking, dynamic pricing calculation, step-by-step validation**, and support for both create and edit modes.

The form architecture separates concerns cleanly across steps, uses React Hook Form with Zod validation, integrates with the availability system, and provides comprehensive error handling with user feedback.

## 🏗️ Module Architecture

```
BookingForm/
├── index.tsx                    # Main multi-step form component (5.1KB, 183 lines)
├── types.ts                     # TypeScript interfaces and constants (1KB, 33 lines)
├── hooks/
│   └── useBookingForm.ts       # Form state management hook (7.4KB, 244 lines)
└── steps/
    ├── UnitSelection.tsx        # Step 1: Unit & dates (8.9KB, ~260 lines)
    ├── GuestInformation.tsx     # Step 2: Contact info (2.3KB, ~70 lines)
    ├── PaymentDetails.tsx       # Step 3: Payment method (2.7KB, ~80 lines)
    └── BookingReview.tsx        # Step 4: Review & confirm (5.1KB, ~150 lines)
```

Total Lines of Code: **~1,017 lines** across 7 files

## 📦 Component Documentation

### BookingForm Component (Main)

The orchestrating component that manages the multi-step workflow.

#### Features

1. **Multi-Step Workflow**
   - 4 distinct steps with clear progression
   - Visual progress bar (0-100%)
   - Step-specific icons and titles
   - Previous/Next navigation
   - Current step indicator

2. **Form Management**
   - React Hook Form integration
   - Zod schema validation
   - Step-by-step validation
   - Error boundary wrapped
   - Loading skeleton support

3. **Mode Support**
   - **Create Mode**: New booking creation
   - **Edit Mode**: Modify existing booking
   - Automatic mode detection via `bookingId`
   - Mode-specific button labels

4. **User Experience**
   - Progress visualization
   - Step descriptions
   - Disabled states during submission
   - Cancel option (Step 1 only)
   - Success callbacks

#### Usage Example

```tsx
import { BookingForm } from '@/components/bookings/BookingForm'

// Create new booking
function NewBookingPage() {
  return (
    <BookingForm
      onSuccess={(booking) => {
        console.log('Booking created:', booking)
        navigate(`/bookings/${booking.booking_id}`)
      }}
      onCancel={() => navigate('/bookings')}
    />
  )
}

// Edit existing booking
function EditBookingPage({ bookingId }: { bookingId: string }) {
  return (
    <BookingForm
      bookingId={bookingId}
      initialData={existingBookingData}
      onSuccess={(booking) => {
        console.log('Booking updated:', booking)
        navigate(`/bookings/${booking.booking_id}`)
      }}
    />
  )
}
```

#### Props Interface

```typescript
interface BookingFormProps {
  onSuccess?: (booking: any) => void      // Callback on successful submission
  onCancel?: () => void                   // Cancel button handler (Step 1 only)
  initialData?: Partial<CompleteBookingData>  // Pre-fill form data
  bookingId?: string                      // If provided, enters edit mode
  className?: string                      // Custom CSS class
}
```

#### Step Configuration

```typescript
const STEP_ICONS = {
  1: CalendarDays,   // Unit selection
  2: Users,          // Guest information
  3: CreditCard,     // Payment details
  4: CheckCircle,    // Review & confirm
}

const STEP_TITLES = {
  1: "Select Unit & Dates",
  2: "Guest Information",
  3: "Payment Method",
  4: "Review & Confirm",
}

const STEP_DESCRIPTIONS = {
  1: "Choose your accommodation and preferred dates",
  2: "Provide contact details for the reservation",
  3: "Select payment method and add special requests",
  4: "Review your booking details before confirming",
}
```

### useBookingForm Hook

**Custom hook managing form state, validation, pricing, and submission**.

#### Hook Features

1. **Form State Management**
   - React Hook Form integration with Zod
   - Current step tracking (1-4)
   - Edit mode detection
   - Initial data population

2. **Pricing Calculation**
   - Weekend vs weekday rates
   - Extra person charges
   - Dynamic total recalculation
   - Multi-night support

3. **Availability Checking**
   - Real-time unit availability
   - Date conflict detection
   - Loading state management
   - Error handling

4. **Step Validation**
   - Per-step field validation
   - Progressive disclosure
   - Validation feedback
   - Required field checking

5. **Submission Handling**
   - Input sanitization
   - Create vs update logic
   - Success/error toasts
   - Optimistic updates via Zustand

#### Usage Example

```typescript
import { useBookingForm } from './hooks/useBookingForm'

const {
  // Form state
  form,
  currentStep,
  calculatedTotal,
  selectedUnit,
  isEditMode,

  // Loading states
  unitsLoading,
  isCheckingAvailability,
  isSubmitting,

  // Data
  units,

  // Actions
  handleNext,
  handlePrevious,
  checkAvailability,
  handleSubmit,
} = useBookingForm({
  initialData: existingData,
  bookingId: 'booking-123',
  onSuccess: (booking) => console.log('Success', booking)
})
```

#### Pricing Calculation Logic

```typescript
// Calculate total price with weekend rates and extra persons
useEffect(() => {
  if (!selectedUnit || !check_in || !check_out) {
    setCalculatedTotal(0)
    return
  }

  const checkInDate = new Date(check_in)
  const checkOutDate = new Date(check_out)
  const nights = differenceInDays(checkOutDate, checkInDate)

  // Calculate base rate for each night
  let total = 0
  const dateRange = eachDayOfInterval({ start: checkInDate, end: checkOutDate })

  dateRange.forEach((date) => {
    const isWeekendDay = isWeekend(date)
    const rate = isWeekendDay && selectedUnit.weekend_rate
      ? selectedUnit.weekend_rate
      : selectedUnit.base_rate
    total += rate
  })

  // Add extra person charges
  if (num_guests > selectedUnit.base_occupancy) {
    const extraPersons = num_guests - selectedUnit.base_occupancy
    const extraPersonRate = selectedUnit.extra_person_rate || 0
    total += extraPersons * extraPersonRate * nights
  }

  setCalculatedTotal(total)
}, [selectedUnit, check_in, check_out, num_guests])
```

#### Step Validation

```typescript
const validateCurrentStep = async () => {
  let isValid = false

  switch (currentStep) {
    case 1:
      // Step 1: Unit selection & dates
      isValid = await form.trigger(['unit_id', 'check_in', 'check_out', 'num_guests'])
      break
    case 2:
      // Step 2: Guest information
      isValid = await form.trigger(['guest_name', 'email', 'contact_number'])
      break
    case 3:
      // Step 3: Payment method
      isValid = await form.trigger(['payment_method'])
      break
    case 4:
      // Step 4: Complete validation
      isValid = await form.trigger()
      break
  }

  return isValid
}
```

#### Availability Checking

```typescript
const checkAvailability = useCallback(async () => {
  if (!selectedUnit || !check_in || !check_out) {
    toast.error("Please select a unit and dates")
    return
  }

  setIsCheckingAvailability(true)

  try {
    const isAvailable = await checkUnitAvailability(
      selectedUnit.unit_id,
      new Date(check_in).toISOString(),
      new Date(check_out).toISOString(),
      bookingId  // Exclude current booking in edit mode
    )

    if (isAvailable) {
      toast.success("Unit is available for the selected dates!")
    } else {
      toast.error("Unit is not available. Please choose different dates.")
    }
  } catch (error) {
    toast.error("Failed to check availability. Please try again.")
    console.error("Availability check error:", error)
  } finally {
    setIsCheckingAvailability(false)
  }
}, [selectedUnit, check_in, check_out, bookingId])
```

#### Submission Handler

```typescript
const handleSubmit = async (data: CompleteBookingData) => {
  try {
    // Sanitize user inputs
    const sanitizedData = sanitizeBookingFormData(data)

    // Construct booking data
    const bookingData = {
      unit_id: data.unit_id,
      guest_name: sanitizedData.guest_name,
      email: sanitizedData.email,
      contact_number: sanitizedData.contact_number,
      num_guests: data.num_guests,
      check_in: new Date(data.check_in).toISOString(),
      check_out: new Date(data.check_out).toISOString(),
      special_requests: sanitizedData.special_requests,
      payment_method: data.payment_method,
      total_amount: calculatedTotal,
    }

    if (isEditMode) {
      // Update existing booking
      await updateBookingMutation.mutateAsync({ bookingId, updates: bookingData })
      toast.success("Booking updated successfully!")
    } else {
      // Create new booking
      const result = await createBookingMutation.mutateAsync(bookingData)
      toast.success("Booking created successfully!")
      onSuccess?.(result)
    }
  } catch (error) {
    toast.error(isEditMode
      ? "Failed to update booking. Please try again."
      : "Failed to create booking. Please try again."
    )
    console.error("Booking submission error:", error)
  }
}
```

## 📋 Step Components

### Step 1: UnitSelection

Unit selection, date picker, and guest count.

#### Features

- Unit dropdown with pricing info
- Check-in/check-out date pickers
- Guest count input with max validation
- Real-time price calculation display
- "Check Availability" button
- Weekend rate indication
- Occupancy limits display

#### Fields

```typescript
interface Step1Fields {
  unit_id: string           // UUID of selected unit
  check_in: Date            // Check-in date
  check_out: Date           // Check-out date (must be after check-in)
  num_guests: number        // 1 to unit.max_occupancy
}
```

#### Usage

```tsx
<UnitSelection
  form={form}
  units={units}
  calculatedTotal={calculatedTotal}
  selectedUnit={selectedUnit}
  isCheckingAvailability={isCheckingAvailability}
  onCheckAvailability={checkAvailability}
/>
```

### Step 2: GuestInformation

Contact details collection for the reservation.

#### Features

- Guest name input (validated, sanitized)
- Email input (validated format)
- Contact number input (Philippine format)
- All fields required
- Real-time validation

#### Fields

```typescript
interface Step2Fields {
  guest_name: string        // 2-100 characters, sanitized
  email: string             // Valid email format
  contact_number: string    // Phone number format
}
```

### Step 3: PaymentDetails

Payment method selection and special requests.

#### Features

- Payment method selection
  - Cash
  - Bank Transfer (GCash, Maya, etc.)
  - Credit Card
- Special requests textarea
- Optional fields handling
- Character limit (500 chars)
- Input sanitization

#### Fields

```typescript
interface Step3Fields {
  payment_method: 'cash' | 'bank_transfer' | 'credit_card'
  special_requests?: string  // Optional, max 500 chars, sanitized
}
```

### Step 4: BookingReview

Final review before submission.

#### Features

- Complete booking summary
- Unit details display
- Guest information review
- Date range display
- Price breakdown:
  - Base rate
  - Weekend rates (if applicable)
  - Extra person charges (if applicable)
  - Total amount
- Payment method display
- Special requests display
- Edit capabilities (go back to any step)

#### Display Format

```tsx
<BookingReview
  form={form}
  units={units}
  calculatedTotal={calculatedTotal}
/>

// Displays:
// - Selected unit name and type
// - Check-in to check-out dates
// - Number of guests
// - Guest name, email, phone
// - Payment method
// - Special requests
// - Total amount (prominently displayed)
```

## 🔄 Form Workflow

### Step Navigation Flow

```
Step 1 (Unit Selection)
   ↓ [Next] - Validates: unit_id, check_in, check_out, num_guests
Step 2 (Guest Information)
   ↓ [Next] - Validates: guest_name, email, contact_number
   ↑ [Previous]
Step 3 (Payment Details)
   ↓ [Next] - Validates: payment_method
   ↑ [Previous]
Step 4 (Review & Confirm)
   ↓ [Confirm Booking] - Triggers form.handleSubmit
   ↑ [Previous]
```

### Validation Strategy

```typescript
// Progressive validation - only validate current step fields
const handleNext = async () => {
  const isValid = await validateCurrentStep()
  if (!isValid) {
    toast.error("Please fill in all required fields")
    return  // Don't advance to next step
  }
  setCurrentStep(currentStep + 1)
}

// Final validation - all fields before submission
const handleSubmit = async (data) => {
  // All fields validated by React Hook Form + Zod
  // Then sanitized and submitted
}
```

## 🔐 Security Features

### Input Sanitization

All user text inputs are sanitized before submission:

```typescript
import { sanitizeBookingFormData } from '@/lib/security/sanitize'

// Sanitizes:
// - guest_name: Remove HTML tags, scripts
// - email: Lowercase, trim
// - contact_number: Remove non-numeric except +
// - special_requests: DOMPurify sanitization
const sanitizedData = sanitizeBookingFormData(formData)
```

### Validation Schema

```typescript
import { completeBookingSchema } from '@/lib/validations'

// Zod schema validates:
// - Email format
// - Phone number format
// - Date range validity (check_out > check_in)
// - Guest count within unit limits
// - Required field presence
// - Character limits
const form = useForm<CompleteBookingData>({
  resolver: zodResolver(completeBookingSchema),
  // ...
})
```

## 💰 Pricing System

### Price Calculation

The form implements sophisticated pricing with multiple factors:

```typescript
// 1. Base daily rates (weekday vs weekend)
dateRange.forEach((date) => {
  const rate = isWeekend(date) && unit.weekend_rate
    ? unit.weekend_rate
    : unit.base_rate
  total += rate
})

// 2. Extra person charges
if (num_guests > unit.base_occupancy) {
  const extraPersons = num_guests - unit.base_occupancy
  total += extraPersons * unit.extra_person_rate * nights
}

// 3. Total displayed in real-time
<div className="text-2xl font-bold">
  {formatCurrency(calculatedTotal)}
</div>
```

### Price Display Examples

```
Example 1: Standard Booking
- Unit: Beach Cottage (₱2,000/night, weekend ₱2,500/night)
- Check-in: Friday, Dec 20
- Check-out: Sunday, Dec 22 (2 nights)
- Guests: 2 (within base occupancy)
- Calculation:
  Friday: ₱2,000
  Saturday: ₱2,500 (weekend)
  Total: ₱4,500

Example 2: Extra Guests
- Unit: Mountain Villa (₱3,000/night, max 6 guests, base 4)
- Check-in: Monday, Dec 23
- Check-out: Wednesday, Dec 25 (2 nights)
- Guests: 6 (2 extra guests)
- Extra person rate: ₱500/person/night
- Calculation:
  2 nights × ₱3,000 = ₱6,000
  2 extra × ₱500 × 2 nights = ₱2,000
  Total: ₱8,000
```

## 🎨 UI/UX Features

### Progress Visualization

```tsx
// Progress bar shows completion percentage
const progressValue = (currentStep / 4) * 100

<Progress value={progressValue} className="h-2" />
// Step 1: 25%
// Step 2: 50%
// Step 3: 75%
// Step 4: 100%
```

### Mobile Optimization

- Touch-friendly input sizes (h-12 on mobile, h-10 on desktop)
- `touch-manipulation` CSS for better touch response
- Responsive grid layouts
- Mobile-optimized date pickers
- Larger tap targets on mobile

```tsx
<SelectTrigger className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation">
```

### Loading States

```tsx
// Initial load
{unitsLoading && <BookingFormSkeleton />}

// Availability check
<Button disabled={isCheckingAvailability}>
  {isCheckingAvailability ? 'Checking...' : 'Check Availability'}
</Button>

// Form submission
<Button disabled={isSubmitting}>
  {isSubmitting ? 'Processing...' : 'Confirm Booking'}
</Button>
```

## 🧪 Testing

### Unit Tests

```typescript
describe('useBookingForm', () => {
  it('calculates pricing correctly', () => {
    const { result } = renderHook(() => useBookingForm({
      initialData: {
        unit_id: 'unit-1',
        check_in: new Date('2024-12-20'),  // Friday
        check_out: new Date('2024-12-22'), // Sunday
        num_guests: 2,
      }
    }))

    // Friday ₱2000 + Saturday ₱2500 = ₱4500
    expect(result.current.calculatedTotal).toBe(4500)
  })

  it('adds extra person charges', () => {
    const { result } = renderHook(() => useBookingForm({
      initialData: {
        unit_id: 'unit-1',  // base_occupancy: 4, extra_person_rate: 500
        check_in: new Date('2024-12-23'),
        check_out: new Date('2024-12-25'),  // 2 nights
        num_guests: 6,  // 2 extra guests
      }
    }))

    // Base: 2 nights × ₱3000 = ₱6000
    // Extra: 2 persons × ₱500 × 2 nights = ₱2000
    // Total: ₱8000
    expect(result.current.calculatedTotal).toBe(8000)
  })

  it('validates step fields before advancing', async () => {
    const { result } = renderHook(() => useBookingForm({}))

    await act(async () => {
      await result.current.handleNext()
    })

    // Should not advance if validation fails
    expect(result.current.currentStep).toBe(1)
  })
})

describe('BookingForm Steps', () => {
  it('validates email format', async () => {
    const { getByLabelText } = render(<GuestInformation form={form} />)

    await userEvent.type(getByLabelText(/email/i), 'invalid-email')
    await userEvent.tab()

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })

  it('enforces max guest count', async () => {
    const { getByLabelText } = render(
      <UnitSelection
        form={form}
        selectedUnit={{ max_occupancy: 4 }}
      />
    )

    await userEvent.type(getByLabelText(/guests/i), '10')
    await userEvent.tab()

    expect(screen.getByText(/maximum 4 guests/i)).toBeInTheDocument()
  })
})
```

### Integration Tests

```typescript
describe('BookingForm Complete Flow', () => {
  it('creates booking through all steps', async () => {
    render(<BookingForm onSuccess={mockOnSuccess} />)

    // Step 1: Unit Selection
    await userEvent.selectOptions(screen.getByLabelText(/unit/i), 'unit-1')
    await userEvent.click(screen.getByLabelText(/check-in/i))
    // ... select dates
    await userEvent.click(screen.getByText(/next/i))

    // Step 2: Guest Information
    await userEvent.type(screen.getByLabelText(/name/i), 'John Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com')
    await userEvent.type(screen.getByLabelText(/phone/i), '09123456789')
    await userEvent.click(screen.getByText(/next/i))

    // Step 3: Payment Details
    await userEvent.selectOptions(screen.getByLabelText(/payment/i), 'cash')
    await userEvent.click(screen.getByText(/next/i))

    // Step 4: Review & Confirm
    expect(screen.getByText(/john doe/i)).toBeInTheDocument()
    await userEvent.click(screen.getByText(/confirm booking/i))

    // Verify success
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })
})
```

## 📚 Related Documentation

- [Bookings Table](/src/components/bookings/BookingsTable/README.md) - Booking management table
- [Guest Booking Form](/src/components/guest-booking/README.md) - Public booking portal
- [Availability System](/src/lib/availability.ts) - Availability checking logic
- [Validation Schemas](/src/lib/validations.ts) - Form validation with Zod
- [Booking Store](/src/stores/useBookingStore.ts) - State management
- [Security Sanitization](/src/lib/security/sanitize.ts) - Input sanitization

## 🎯 Best Practices

1. ✅ **Validate each step** before allowing navigation
2. ✅ **Sanitize all inputs** before submission
3. ✅ **Check availability** before final confirmation
4. ✅ **Calculate prices** dynamically based on dates and guests
5. ✅ **Provide clear feedback** with toasts for all actions
6. ✅ **Support both create and edit** modes consistently
7. ✅ **Show loading states** during async operations
8. ✅ **Disable form** during submission to prevent duplicates
9. ✅ **Use error boundaries** for graceful degradation
10. ✅ **Test pricing calculations** thoroughly with edge cases

## 🔧 Maintenance Notes

- Review pricing logic when adding new rate types
- Test step validation when adding new fields
- Update step descriptions when changing workflow
- Maintain consistent validation across all steps
- Monitor form completion rates per step
- Test availability checking with various scenarios
- Verify sanitization covers all new text inputs
- Keep step count consistent across all constants
- Test edit mode thoroughly when schema changes
- Ensure loading skeletons match form structure

## 📈 Future Enhancements

- [ ] Save draft bookings (persist form state)
- [ ] Add step indicators with click navigation
- [ ] Implement form autosave
- [ ] Add booking calendar view integration
- [ ] Support multiple unit selection
- [ ] Add promo code/discount support
- [ ] Implement deposit/partial payment
- [ ] Add booking notes/history
- [ ] Support recurring bookings
- [ ] Add email confirmation preview
- [ ] Implement conflict resolution UI
- [ ] Add booking templates for repeat guests
