# 🏨 Guest Booking Portal Documentation

## Overview

The Guest Booking Portal provides a **public-facing, unauthenticated booking interface** for resort guests to create reservations directly. This module implements a secure, multi-step booking workflow with comprehensive validation, file upload capabilities, and bot protection through Cloudflare Turnstile.

The portal handles the complete guest booking lifecycle from unit selection through payment proof upload, optimized for small business operations within free tier constraints (2MB file limit for bandwidth optimization).

## 🏗️ Module Architecture

```
guest-booking/
├── GuestBookingForm.tsx     # Main booking form component (21KB, 610 lines)
└── FileUploadField.tsx       # Reusable file upload component (6KB, 217 lines)
```

Total Lines of Code: **827 lines** across 2 components

## 📦 Component Documentation

### GuestBookingForm Component

The main public booking form with Turnstile verification, file upload, and API integration.

#### Features

1. **Security First**
   - Cloudflare Turnstile bot protection
   - DOMPurify input sanitization
   - Zod schema validation
   - Rate limiting via API middleware
   - XSS prevention on all text inputs

2. **Multi-Step Booking Process**
   - Step 1: Form validation (client-side)
   - Step 2: File compression and validation
   - Step 3: API submission with Turnstile token
   - Step 4: Signed URL file upload
   - Step 5: Upload confirmation
   - Step 6: Success notification

3. **Form Sections**
   - Guest Information (name, email, phone)
   - Booking Details (unit, dates, guest count)
   - Special Requests (optional, sanitized)
   - Payment Proof (file upload, 2MB max)
   - Turnstile Verification

4. **Progress Tracking**
   - Real-time upload progress (0-100%)
   - Visual progress bar
   - Loading states during submission
   - Disabled state management

5. **Success Handling**
   - Booking reference display
   - Email confirmation notification
   - Check booking status link
   - "Make Another Booking" reset

#### Usage Example

```tsx
import { GuestBookingForm } from '@/components/guest-booking/GuestBookingForm'

function PublicBookingPage() {
  return (
    <div className="container max-w-3xl py-8">
      <GuestBookingForm
        onSuccess={(bookingReference) => {
          // Optional success callback
          console.log('Booking created:', bookingReference)
        }}
      />
    </div>
  )
}
```

#### Validation Schema

```typescript
const guestBookingSchema = z
  .object({
    // Guest Information
    guest_name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name too long")
      .transform((val) => DOMPurify.sanitize(val)),

    email: z
      .string()
      .email("Invalid email address")
      .toLowerCase(),

    phone_number: z
      .string()
      .regex(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/,
        "Invalid phone number format"
      ),

    // Booking Details
    unit_id: z.string().uuid("Please select a unit"),
    check_in: z.date().min(new Date(), "Check-in must be in the future"),
    check_out: z.date(),
    num_guests: z.number().min(1, "At least 1 guest required").max(20, "Maximum 20 guests"),

    // Optional
    special_requests: z
      .string()
      .max(500, "Maximum 500 characters")
      .optional()
      .transform((val) => (val ? DOMPurify.sanitize(val) : undefined)),

    // File (2MB limit for bandwidth optimization)
    payment_proof: z
      .instanceof(File)
      .refine((file) => file.size <= 2 * 1024 * 1024, "File must be less than 2MB")
      .refine(
        (file) => ["image/jpeg", "image/png", "image/jpg", "application/pdf"].includes(file.type),
        "Only JPG, PNG, and PDF files are allowed"
      ),
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  })
```

#### Submission Flow

```typescript
const onSubmit = async (data: GuestBookingFormData) => {
  // 1. Verify Turnstile token
  if (!turnstileToken) {
    toast.error("Please complete the CAPTCHA verification")
    return
  }

  // 2. Compress and validate file (5% progress)
  const processedFile = await compressAndValidateFile(data.payment_proof)

  // 3. Transform data to API format (10% progress)
  const apiData = transformToAPIFormat({ ...data, payment_proof: processedFile })

  // 4. Submit booking data (20% progress)
  const response = await fetch('/api/guest-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...apiData,
      turnstile_token: turnstileToken,
    }),
  })

  const result = await response.json()
  const validatedResult = validateAPIResponse(result)

  // 5. Upload file to signed URL (40-90% progress)
  const { error: uploadError } = await supabase.storage
    .from(validatedResult.upload.bucket)
    .uploadToSignedUrl(
      validatedResult.upload.path,
      validatedResult.upload.token,
      processedFile
    )

  // 6. Confirm upload completion (90-100% progress)
  await fetch('/api/guest-booking/confirm', {
    method: 'POST',
    body: JSON.stringify({
      booking_id: validatedResult.booking.booking_id,
      file_path: validatedResult.upload.path,
      file_size: processedFile.size,
    }),
  })

  // 7. Show success message
  toast.success(`Booking created! Reference: ${validatedResult.booking.booking_reference}`)
}
```

#### State Management

```typescript
const [isSubmitting, setIsSubmitting] = useState(false)
const [uploadProgress, setUploadProgress] = useState(0)
const [bookingReference, setBookingReference] = useState<string | null>(null)
const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

// TanStack Query for units data
const { data: units = [] } = useQuery({
  queryKey: ["units"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .order("unit_name")
    if (error) throw error
    return data || []
  },
})

// React Hook Form with Zod validation
const form = useForm<GuestBookingFormData>({
  resolver: zodResolver(guestBookingSchema),
  defaultValues: {
    guest_name: "",
    email: "",
    phone_number: "",
    check_in: new Date(),
    check_out: new Date(Date.now() + 86400000), // Tomorrow
    num_guests: 2,
  },
})
```

#### Pricing Calculation

```typescript
const calculateTotal = () => {
  if (!selectedUnit) return 0

  const checkIn = form.watch("check_in")
  const checkOut = form.watch("check_out")
  const numGuests = form.watch("num_guests")

  // Adapt database unit type for pricing utility
  const adaptedUnit = adaptUnitFromDB(selectedUnit)
  const pricing = calculatePricing(adaptedUnit, {
    checkIn,
    checkOut,
    guestCount: numGuests,
  })

  return pricing.totalAmount
}

// Display in UI
<Alert>
  <CreditCard className="h-4 w-4" />
  <AlertDescription>
    <strong>Total Amount Due: </strong>
    {formatCurrency(calculateTotal())}
  </AlertDescription>
</Alert>
```

### FileUploadField Component

Reusable file upload component with drag-and-drop, preview, and validation.

#### Features

1. **Upload Methods**
   - Drag and drop file upload
   - Click to browse file picker
   - Visual drag-over feedback
   - Mobile-friendly touch support

2. **File Validation**
   - File size validation (configurable max size)
   - File type validation (MIME type checking)
   - Extension validation fallback
   - Clear error messages

3. **User Experience**
   - Image preview for uploaded images
   - File icon for PDFs
   - File name and size display
   - Remove file button
   - Disabled state support

4. **Accessibility**
   - Screen reader support (sr-only input)
   - Keyboard navigation
   - Required field support
   - Error announcements

#### Usage Example

```tsx
import { FileUploadField } from '@/components/guest-booking/FileUploadField'

// Basic usage
<FileUploadField
  onChange={(file) => console.log('File selected:', file)}
  value={currentFile}
/>

// With React Hook Form
<FormField
  control={form.control}
  name="payment_proof"
  render={({ field: { onChange, value, ...field } }) => (
    <FormItem>
      <FormLabel>Upload Payment Proof</FormLabel>
      <FormControl>
        <FileUploadField
          onChange={onChange}
          value={value}
          disabled={isSubmitting}
          accept="image/jpeg,image/png,image/jpg,application/pdf"
          maxSize={2 * 1024 * 1024}
          required
          {...field}
        />
      </FormControl>
      <FormDescription>JPG, PNG or PDF files up to 2MB</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### Props Interface

```typescript
interface FileUploadFieldProps {
  onChange: (file: File | null) => void
  value?: File | null
  disabled?: boolean
  accept?: string           // e.g., "image/*,application/pdf"
  maxSize?: number          // in bytes, default 2MB
  name?: string             // for input element
  required?: boolean        // for HTML5 validation
}
```

#### Validation Logic

```typescript
const validateFile = (file: File): boolean => {
  // Check file size
  if (file.size > maxSize) {
    setError(`File is too large. Maximum size is ${formatFileSize(maxSize)}`)
    return false
  }

  // Check file type
  const acceptedTypes = accept.split(",").flatMap((type) => {
    if (type === "image/*") {
      return ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    } else if (type === "application/pdf") {
      return ["application/pdf"]
    }
    return [type.trim()]
  })

  if (!acceptedTypes.some((type) =>
    file.type === type || file.name.endsWith(type.split("/")[1])
  )) {
    setError("Invalid file type. Please upload a JPG, PNG, or PDF file.")
    return false
  }

  return true
}
```

#### Drag and Drop Implementation

```typescript
const handleDrop = useCallback(
  (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileChange(files[0])
    }
  },
  [handleFileChange, disabled]
)

const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault()
  if (!disabled) {
    setIsDragActive(true)
  }
}
```

#### Preview Generation

```typescript
const handleFileChange = useCallback((file: File | null) => {
  if (file) {
    if (!validateFile(file)) return

    onChange(file)

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }
}, [onChange, maxSize])
```

## 🔐 Security Patterns

### Turnstile Integration

Cloudflare Turnstile provides bot protection without CAPTCHAs:

```tsx
import { Turnstile } from "@marsidev/react-turnstile"

<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ""}
  onSuccess={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileToken(null)}
  onExpire={() => setTurnstileToken(null)}
  options={{
    theme: "light",
    size: "normal",
  }}
/>

// Disable submit until verified
<Button
  type="submit"
  disabled={isSubmitting || !turnstileToken}
>
  Submit Booking
</Button>
```

### Input Sanitization

All user text inputs are sanitized with DOMPurify:

```typescript
import DOMPurify from "dompurify"

// In Zod schema
guest_name: z
  .string()
  .min(2)
  .max(100)
  .transform((val) => DOMPurify.sanitize(val)),

special_requests: z
  .string()
  .max(500)
  .optional()
  .transform((val) => (val ? DOMPurify.sanitize(val) : undefined)),
```

### File Validation

Multi-layer file validation for security:

```typescript
// 1. Client-side Zod validation
payment_proof: z
  .instanceof(File)
  .refine((file) => file.size <= 2 * 1024 * 1024, "File must be less than 2MB")
  .refine(
    (file) => ["image/jpeg", "image/png", "image/jpg", "application/pdf"].includes(file.type),
    "Only JPG, PNG, and PDF files are allowed"
  )

// 2. FileUploadField validation
const validateFile = (file: File): boolean => {
  // Size check
  // MIME type check
  // Extension fallback check
}

// 3. Server-side compression and validation
const processedFile = await compressAndValidateFile(data.payment_proof)

// 4. Upload to signed URL (temporary, expiring token)
await supabase.storage
  .from(bucket)
  .uploadToSignedUrl(path, token, file)
```

### API Integration Security

```typescript
// Request includes Turnstile token
const response = await fetch('/api/guest-booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ...apiData,
    turnstile_token: turnstileToken, // Required
  }),
})

// API endpoint verifies:
// 1. Turnstile token validity
// 2. Rate limiting per IP
// 3. Input sanitization
// 4. Data validation
// 5. Availability checking
```

## 📊 Performance Optimizations

### File Compression

Files are compressed before upload to optimize bandwidth:

```typescript
import { compressAndValidateFile } from '@/utils/file-compression'

// Automatic image compression
const processedFile = await compressAndValidateFile(data.payment_proof)
// Returns compressed file (target: <500KB for images)
```

### Bandwidth Management

Optimized for free tier constraints:

- **2MB file size limit** (reduced from typical 5-10MB)
- **Image compression** before upload (60-80% size reduction)
- **Signed URL uploads** (direct to storage, bypassing API)
- **Progress tracking** for user feedback during upload

### Data Fetching

```typescript
// TanStack Query for units data
const { data: units = [] } = useQuery({
  queryKey: ["units"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .order("unit_name")
    if (error) throw error
    return data || []
  },
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
})
```

## 🎯 Integration Patterns

### API Endpoint Integration

The form integrates with three API endpoints:

```typescript
// 1. Create booking
POST /api/guest-booking
Body: {
  guest_name, email, phone_number,
  unit_id, check_in, check_out, num_guests,
  special_requests, turnstile_token
}
Returns: {
  booking: { booking_id, booking_reference, ... },
  upload: { bucket, path, token }
}

// 2. Upload file (Supabase Storage via signed URL)
await supabase.storage
  .from(bucket)
  .uploadToSignedUrl(path, token, file)

// 3. Confirm upload
POST /api/guest-booking/confirm
Body: {
  booking_id, file_path, file_size
}
```

### Schema Transformation

Data is transformed between form and API formats:

```typescript
import { transformToAPIFormat, validateAPIResponse } from '@/lib/schema-transform'

// Transform form data to API format
const apiData = transformToAPIFormat(formData)

// Validate API response
const validatedResult = validateAPIResponse(apiResponse)
```

### Database Adapters

Unit data is adapted for pricing calculations:

```typescript
import { adaptUnitFromDB } from '@/lib/database-adapters'

// Database unit type -> Application unit type
const adaptedUnit = adaptUnitFromDB(selectedUnit)
const pricing = calculatePricing(adaptedUnit, { checkIn, checkOut, guestCount })
```

## 🧪 Testing

### Unit Tests

```typescript
describe('GuestBookingForm', () => {
  it('validates guest information', () => {
    const result = guestBookingSchema.safeParse({
      guest_name: "John Doe",
      email: "john@example.com",
      phone_number: "+63 912 345 6789",
      // ...
    })
    expect(result.success).toBe(true)
  })

  it('sanitizes special requests', () => {
    const data = {
      special_requests: '<script>alert("xss")</script>Clean text',
      // ...
    }
    const result = guestBookingSchema.parse(data)
    expect(result.special_requests).not.toContain('<script>')
  })

  it('validates file size', () => {
    const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg')
    const result = guestBookingSchema.safeParse({
      payment_proof: largeFile,
      // ...
    })
    expect(result.success).toBe(false)
  })
})

describe('FileUploadField', () => {
  it('accepts valid image files', async () => {
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
    const { getByLabelText } = render(
      <FileUploadField onChange={jest.fn()} maxSize={2 * 1024 * 1024} />
    )

    const input = getByLabelText(/upload/i)
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.queryByText(/too large/i)).not.toBeInTheDocument()
  })

  it('rejects files exceeding max size', async () => {
    const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg')
    // ... test implementation
  })
})
```

### Integration Tests

```typescript
// Test full booking flow
describe('Guest Booking Flow', () => {
  it('completes booking with file upload', async () => {
    render(<GuestBookingForm />)

    // Fill form
    await userEvent.type(screen.getByLabelText(/name/i), 'John Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com')
    // ...

    // Upload file
    const file = new File(['receipt'], 'payment.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/upload/i)
    await userEvent.upload(input, file)

    // Complete Turnstile (mocked)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
    })

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    })
  })
})
```

## 📚 Related Documentation

- [Guest Booking API](/functions/api/guest-booking/README.md) - Server-side booking endpoint
- [Validation Utilities](/src/lib/validation/README.md) - Zod schemas and validation
- [File Compression](/src/utils/file-compression.ts) - Image compression utility
- [Turnstile Setup](/docs/security/turnstile.md) - Bot protection configuration
- [Form Patterns](/src/components/bookings/BookingForm/README.md) - Multi-step form patterns
- [Security Guidelines](/src/lib/security/README.md) - Security best practices

## 🔧 Configuration

### Environment Variables

```bash
# .env.local
VITE_TURNSTILE_SITE_KEY=0x4AAAxxxxxxxxx  # Cloudflare Turnstile site key
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Turnstile Setup

1. **Create Turnstile Site**: https://dash.cloudflare.com/?to=/:account/turnstile
2. **Add site key** to `.env.local`
3. **Configure domain** in Cloudflare dashboard
4. **Add secret key** to API environment

## 🚨 Error Handling

### User-Friendly Error Messages

```typescript
try {
  await onSubmit(data)
} catch (error) {
  if (error instanceof Error) {
    // Specific error messages
    if (error.message.includes('unavailable')) {
      toast.error('Selected unit is no longer available')
    } else if (error.message.includes('turnstile')) {
      toast.error('Verification failed. Please try again.')
    } else {
      toast.error(error.message)
    }
  } else {
    toast.error('An unexpected error occurred. Please try again.')
  }
}
```

### Validation Error Display

```tsx
// React Hook Form automatically displays validation errors
<FormField
  control={form.control}
  name="guest_name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Full Name</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Displays Zod validation errors */}
    </FormItem>
  )}
/>
```

## 📈 Best Practices

1. ✅ **Always verify Turnstile token** before submission
2. ✅ **Sanitize all text inputs** with DOMPurify
3. ✅ **Validate files** before compression and upload
4. ✅ **Show progress** during long operations
5. ✅ **Disable form** during submission
6. ✅ **Handle all error cases** with user-friendly messages
7. ✅ **Reset Turnstile token** after submission
8. ✅ **Clear form state** after successful booking
9. ✅ **Optimize file size** before upload (2MB limit)
10. ✅ **Log errors** for debugging (console.error)

## 🔄 Maintenance Notes

- Monitor Turnstile verification success rates
- Review file upload bandwidth usage monthly
- Update file size limits based on storage capacity
- Test form with various file types and sizes
- Monitor API error rates and adjust validation
- Keep DOMPurify updated for security patches
- Verify signed URL expiration times are appropriate
- Audit booking success/failure rates
- Review and update validation schemas as needed
- Test mobile responsiveness regularly

## 🎨 UI/UX Considerations

- **Mobile-first design** with responsive grids
- **Clear visual hierarchy** using Card components
- **Icon indicators** for form fields (Mail, Phone, Calendar)
- **Progress feedback** during submission
- **Success state** with booking reference and next steps
- **Disabled states** prevent duplicate submissions
- **Error states** clearly indicate issues
- **Drag-and-drop** file upload for better UX
- **File preview** for uploaded images
- **Auto-calculated pricing** displayed before submission
