# Okaeri Resort System - Form Components Documentation

This document provides comprehensive documentation for all form components in
the Okaeri Resort System, including usage examples, validation schemas, and
integration patterns.

## 📋 Table of Contents

1. [Validation Schemas](#validation-schemas)
2. [BookingForm Component](#bookingform-component)
3. [PaymentUploadForm Component](#paymentuploadform-component)
4. [UnitForm Component](#unitform-component)
5. [GuestQuickForm Component](#guestquickform-component)
6. [Best Practices](#best-practices)
7. [Integration Examples](#integration-examples)

## 🔍 Validation Schemas

All form components use Zod schemas for comprehensive validation with Philippine
business rules.

### Key Features

- **Philippine-specific validation**: Phone numbers, peso amounts
- **Business rule validation**: Date ranges, occupancy limits
- **File upload validation**: Size, type, and security checks
- **Real-time validation**: Immediate feedback with user-friendly messages
- **Type safety**: Full TypeScript integration with inferred types

### Available Schemas

```typescript
// Guest validation
guestSchema;
guestQuickFormSchema;

// Unit validation
unitFormSchema;
unitFormWithRateValidationSchema;

// Booking validation
bookingFormSchema;
(bookingStep1Schema, bookingStep2Schema, bookingStep3Schema);
completeBookingSchema;

// Payment validation
paymentUploadSchema;
paymentProofSchema;

// Filter validation
bookingFiltersSchema;
unitFiltersSchema;
```

---

## 🏨 BookingForm Component

A comprehensive multi-step booking form with optimistic UI updates and real-time
validation.

### Features

- **Multi-step workflow**: 4-step process with progress indicator
- **Unit selection**: With availability checking and rate calculation
- **Date validation**: Business rules for check-in/check-out dates
- **Guest information**: Philippine phone and email validation
- **Payment method**: Multiple options with special handling for GCash
- **Optimistic updates**: Immediate UI feedback while processing

### Usage

```tsx
import { BookingForm } from "@/components/bookings";

function CreateBookingPage() {
  const handleSuccess = (booking) => {
    console.log("Booking created:", booking);
    // Handle successful booking creation
  };

  return (
    <BookingForm
      onSuccess={handleSuccess}
      onCancel={() => router.back()}
      initialData={{ num_guests: 2 }}
    />
  );
}
```

### Props

```typescript
interface BookingFormProps {
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
  initialData?: Partial<CompleteBookingData>;
  className?: string;
}
```

### Form Steps

1. **Unit & Dates**: Unit selection, check-in/out dates, guest count
2. **Guest Info**: Name, email, phone number with validation
3. **Payment & Requests**: Payment method, special requests
4. **Review**: Complete booking summary before confirmation

### Rate Calculation

- Automatically calculates total based on weekday/weekend rates
- Shows night-by-night breakdown
- Real-time updates when dates or unit changes

---

## 💳 PaymentUploadForm Component

Secure file upload form for payment proofs with progress tracking and
validation.

### Features

- **Drag & drop**: Intuitive file selection interface
- **File validation**: Type, size, and security checks
- **Image preview**: Shows preview for image files
- **Progress tracking**: Real-time upload progress with simulation
- **Multiple payment methods**: GCash, Bank Transfer, Cash, Card
- **Security**: File type validation and size limits

### Usage

```tsx
import { PaymentUploadForm } from "@/components/bookings";

function PaymentProofPage({ bookingId, amount }) {
  const handleSuccess = (data) => {
    console.log("Payment proof uploaded:", data);
    // Handle successful upload
  };

  return (
    <PaymentUploadForm
      bookingId={bookingId}
      bookingAmount={amount}
      onSuccess={handleSuccess}
    />
  );
}
```

### Props

```typescript
interface PaymentUploadFormProps {
  bookingId: string;
  bookingAmount: number;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  className?: string;
}
```

### File Validation Rules

- **Allowed types**: PNG, JPG, JPEG only
- **Size limit**: 5MB maximum
- **Security**: Client-side validation with server-side verification
- **Preview**: Automatic image preview generation

---

## 🏢 UnitForm Component

Comprehensive form for creating and editing resort units with amenities
management.

### Features

- **Unit type selection**: Studio, One Bedroom, Two Bedroom, Villa
- **Rate management**: Separate weekday and weekend rates
- **Amenities selection**: Interactive amenity picker with icons
- **Validation**: Rate comparison and business rule validation
- **Suggested pricing**: Auto-fill rates based on unit type
- **Visual feedback**: Real-time rate summary and calculations

### Usage

```tsx
import { UnitForm } from "@/components/units";

function CreateUnitPage() {
  const handleSuccess = (unit) => {
    console.log("Unit created:", unit);
    // Handle successful unit creation
  };

  return <UnitForm onSuccess={handleSuccess} onCancel={() => router.back()} />;
}

// For editing existing unit
function EditUnitPage({ unit }) {
  return <UnitForm unit={unit} onSuccess={handleUpdate} />;
}
```

### Props

```typescript
interface UnitFormProps {
  unit?: Unit; // For editing existing unit
  onSuccess?: (unit: any) => void;
  onCancel?: () => void;
  className?: string;
}
```

### Amenities Management

- **Pre-defined options**: Common resort amenities with icons
- **Interactive selection**: Click to toggle amenities
- **Visual feedback**: Selected amenities shown as badges
- **Validation**: At least one amenity required

### Rate Suggestions

- **Studio**: ₱2,500 base / ₱3,000 weekend
- **One Bedroom**: ₱3,500 base / ₱4,000 weekend
- **Two Bedroom**: ₱5,000 base / ₱6,000 weekend
- **Villa**: ₱8,000 base / ₱10,000 weekend

---

## 👤 GuestQuickForm Component

Smart guest registration form with duplicate detection and quick selection.

### Features

- **Duplicate detection**: Automatic check for existing guests by email
- **Quick selection**: Use existing guest or create new
- **Debounced search**: Efficient API calls with 500ms delay
- **Guest history**: Shows booking count and total spent
- **Progressive enhancement**: Works with or without existing guest checking
- **Mobile optimization**: Touch-friendly interface

### Usage

```tsx
import { GuestQuickForm } from "@/components/guests";

function GuestRegistrationPage() {
  const handleSuccess = (guest) => {
    console.log("Guest registered:", guest);
    // Handle successful registration
  };

  const handleGuestSelected = (existingGuest) => {
    console.log("Existing guest selected:", existingGuest);
    // Handle existing guest selection
  };

  return (
    <GuestQuickForm
      onSuccess={handleSuccess}
      onGuestSelected={handleGuestSelected}
      showExistingGuestOption={true}
    />
  );
}
```

### Props

```typescript
interface GuestQuickFormProps {
  onSuccess?: (guest: Guest) => void;
  onCancel?: () => void;
  onGuestSelected?: (guest: Guest) => void;
  initialEmail?: string;
  className?: string;
  showExistingGuestOption?: boolean;
}
```

### Existing Guest Detection

- **Email-based**: Searches for existing guests by email
- **Debounced**: 500ms delay to prevent excessive API calls
- **History display**: Shows total bookings and spending
- **Quick actions**: Use existing or create new options

---

## 🎯 Best Practices

### Form Validation

```typescript
// Use proper error handling
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: "onChange", // Real-time validation
  defaultValues: {
    /* ... */
  },
});

// Handle errors gracefully
const onSubmit = async (data) => {
  try {
    await mutation.mutateAsync(data);
    toast.success("Success message");
  } catch (error) {
    toast.error("User-friendly error message");
  }
};
```

### File Upload Security

```typescript
// Always validate files
const validateFile = (file: File): string | null => {
  if (file.size > 5 * 1024 * 1024) {
    return "File too large";
  }
  if (!allowedTypes.includes(file.type)) {
    return "Invalid file type";
  }
  return null;
};
```

### Optimistic Updates

```typescript
// Use optimistic updates for better UX
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['data'] });

  // Add optimistic update
  addOptimistic(optimisticData);

  return { optimisticData };
},
onError: (err, newData, context) => {
  // Rollback on error
  if (context?.optimisticData) {
    removeOptimistic(context.optimisticData.id);
  }
}
```

### Accessibility

```typescript
// Ensure proper ARIA labels
<FormField
  control={form.control}
  name="field"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Accessible Label</FormLabel>
      <FormControl>
        <Input
          {...field}
          aria-describedby="field-description"
          aria-invalid={!!errors.field}
        />
      </FormControl>
      <FormDescription id="field-description">
        Helpful description
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 🔗 Integration Examples

### Complete Booking Flow

```tsx
function BookingFlow() {
  const [step, setStep] = useState<"guest" | "booking" | "payment">("guest");
  const [guestData, setGuestData] = useState(null);
  const [bookingData, setBookingData] = useState(null);

  return (
    <>
      {step === "guest" && (
        <GuestQuickForm
          onSuccess={(guest) => {
            setGuestData(guest);
            setStep("booking");
          }}
        />
      )}

      {step === "booking" && (
        <BookingForm
          initialData={{
            guest_name: guestData?.guest_name,
            email: guestData?.email,
            contact_number: guestData?.phone_number,
          }}
          onSuccess={(booking) => {
            setBookingData(booking);
            setStep("payment");
          }}
        />
      )}

      {step === "payment" && (
        <PaymentUploadForm
          bookingId={bookingData?.booking_id}
          bookingAmount={bookingData?.total_amount}
          onSuccess={() => {
            // Complete flow
            router.push("/bookings");
          }}
        />
      )}
    </>
  );
}
```

### Unit Management

```tsx
function UnitManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);

  return (
    <>
      <Button onClick={() => setShowForm(true)}>Create Unit</Button>

      {showForm && (
        <UnitForm
          unit={editingUnit}
          onSuccess={() => {
            setShowForm(false);
            setEditingUnit(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingUnit(null);
          }}
        />
      )}
    </>
  );
}
```

### Form with External State

```tsx
function BookingWithStore() {
  const { selectedUnit } = useUnitStore();
  const { addBooking } = useBookingStore();

  return (
    <BookingForm
      initialData={{
        unit_id: selectedUnit?.unit_id,
        num_guests: selectedUnit?.max_occupancy || 2,
      }}
      onSuccess={(booking) => {
        addBooking(booking);
        toast.success("Booking created successfully!");
      }}
    />
  );
}
```

---

## 📱 Mobile Considerations

### Touch Optimization

- Large touch targets (44px minimum)
- Swipe-friendly multi-step navigation
- Touch-friendly file upload dropzone
- Proper keyboard types for inputs

### Performance

- Debounced validation to prevent excessive calls
- Optimistic updates for immediate feedback
- Efficient re-renders with proper dependency arrays
- Image compression for file uploads

### Offline Support

- Form state persistence in localStorage
- Graceful degradation when offline
- Queue failed requests for retry
- Clear offline indicators

---

## 🚀 Future Enhancements

### Planned Features

- **Auto-save**: Periodic form state saving
- **Multi-language**: Support for Filipino and English
- **Advanced validation**: Cross-field validation rules
- **Batch operations**: Multiple unit/guest creation
- **Integration**: Third-party payment gateways
- **Analytics**: Form completion tracking
- **A/B testing**: Form optimization experiments

### Performance Optimizations

- Lazy loading for large forms
- Virtual scrolling for long lists
- Compression for file uploads
- CDN integration for assets

---

This documentation covers all form components in the Okaeri Resort System. For
additional questions or feature requests, please refer to the development team
or create an issue in the project repository.
