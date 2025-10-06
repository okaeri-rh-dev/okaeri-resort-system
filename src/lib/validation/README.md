# ✅ Validation Utilities Documentation

## Overview

The Validation Utilities module provides **comprehensive input validation schemas** using Zod for type-safe, runtime validation across the Okaeri Resort System. These utilities ensure data integrity, prevent security vulnerabilities, and provide clear error messages for form validation.

All validation schemas integrate **DOMPurify sanitization** and implement **Philippine business rules** for phone numbers, dates, and currency formats.

## 🏗️ Module Architecture

```
validation/
└── guest-booking.ts          # Guest booking validation schema (8.7KB, ~260 lines)
```

## 📋 Validation Schemas

### Guest Booking Schema

Comprehensive validation for public guest bookings with security-first approach.

#### Schema Definition

```typescript
import { z } from "zod"
import DOMPurify from "dompurify"

export const guestBookingSchema = z.object({
  // Guest Information
  guest_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .transform((val) => DOMPurify.sanitize(val)),

  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .max(255, "Email too long"),

  phone_number: z
    .string()
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/,
      "Invalid phone number format"
    )
    .transform((val) => val.replace(/[\s\-()]/g, "")),  // Normalize

  // Booking Details
  unit_id: z.string().uuid("Please select a valid unit"),

  check_in: z.coerce
    .date()
    .min(new Date(), "Check-in must be in the future"),

  check_out: z.coerce
    .date(),

  num_guests: z.coerce
    .number()
    .int()
    .min(1, "At least 1 guest required")
    .max(20, "Maximum 20 guests allowed"),

  // Optional Fields
  special_requests: z
    .string()
    .max(500, "Special requests limited to 500 characters")
    .optional()
    .transform((val) => val ? DOMPurify.sanitize(val) : undefined),

  // File Upload
  payment_proof: z
    .instanceof(File)
    .refine((file) => file.size <= 2 * 1024 * 1024, {
      message: "File must be less than 2MB"
    })
    .refine(
      (file) => [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf"
      ].includes(file.type),
      { message: "Only JPG, PNG, and PDF files are allowed" }
    ),

  // Security
  turnstile_token: z.string().min(1, "Verification required"),
})
  // Cross-field validation
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  })
  .refine(
    (data) => {
      const nights = differenceInDays(data.check_out, data.check_in)
      return nights >= 1 && nights <= 30
    },
    {
      message: "Stay duration must be between 1 and 30 nights",
      path: ["check_out"],
    }
  )

export type GuestBookingData = z.infer<typeof guestBookingSchema>
```

#### Usage Example

```typescript
import { guestBookingSchema } from '@/lib/validation/guest-booking'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// React Hook Form integration
const form = useForm<GuestBookingData>({
  resolver: zodResolver(guestBookingSchema),
  defaultValues: {
    guest_name: "",
    email: "",
    phone_number: "",
    check_in: new Date(),
    check_out: new Date(Date.now() + 86400000),
    num_guests: 2,
  }
})

// Validate data
const result = guestBookingSchema.safeParse(formData)
if (!result.success) {
  console.error('Validation errors:', result.error.format())
  return
}

// Use validated and sanitized data
const validatedData = result.data
```

## 🔐 Security Features

### 1. Input Sanitization

All text inputs are sanitized with DOMPurify:

```typescript
// Sanitize guest name
guest_name: z.string()
  .transform((val) => DOMPurify.sanitize(val))

// Sanitize optional fields
special_requests: z.string()
  .optional()
  .transform((val) => val ? DOMPurify.sanitize(val) : undefined)
```

### 2. XSS Prevention

```typescript
// Before sanitization
const malicious = '<script>alert("XSS")</script>John Doe'

// After validation
const result = guestBookingSchema.parse({ guest_name: malicious, ... })
console.log(result.guest_name)  // "John Doe" (script tags removed)
```

### 3. Phone Number Validation

Philippine and international phone number formats:

```typescript
phone_number: z.string()
  .regex(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/,
    "Invalid phone number format"
  )
  .transform((val) => val.replace(/[\s\-()]/g, ""))  // Normalize

// Valid formats:
// +63 912 345 6789 → 639123456789
// 0912-345-6789 → 09123456789
// (02) 1234-5678 → 0212345678
```

### 4. File Validation

Secure file upload validation:

```typescript
payment_proof: z
  .instanceof(File)
  .refine((file) => file.size <= 2 * 1024 * 1024, {
    message: "File must be less than 2MB"
  })
  .refine(
    (file) => ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
      .includes(file.type),
    { message: "Only JPG, PNG, and PDF files are allowed" }
  )
```

## 📝 Validation Rules

### Guest Name

- **Min length**: 2 characters
- **Max length**: 100 characters
- **Sanitization**: DOMPurify removes HTML/scripts
- **Allowed**: Letters, spaces, hyphens, apostrophes

### Email

- **Format**: Valid email (RFC 5322)
- **Max length**: 255 characters
- **Transform**: Lowercased automatically
- **Validation**: Standard email regex

### Phone Number

- **Format**: International or local Philippine format
- **Validation**: Regex pattern matching
- **Transform**: Normalized (remove spaces, dashes, parentheses)
- **Examples**:
  - `+63 912 345 6789` ✅
  - `0912-345-6789` ✅
  - `(02) 1234-5678` ✅
  - `invalid-123` ❌

### Check-in/Check-out Dates

- **Check-in**: Must be in the future
- **Check-out**: Must be after check-in
- **Duration**: 1-30 nights
- **Type**: JavaScript Date object
- **Validation**: Cross-field validation

### Number of Guests

- **Min**: 1 guest
- **Max**: 20 guests
- **Type**: Integer
- **Coercion**: String inputs converted to numbers

### Special Requests

- **Max length**: 500 characters
- **Optional**: Can be empty/undefined
- **Sanitization**: DOMPurify removes dangerous HTML
- **Allowed**: Plain text, basic formatting

### File Upload

- **Max size**: 2MB (2,097,152 bytes)
- **Allowed types**:
  - `image/jpeg`
  - `image/png`
  - `image/jpg`
  - `application/pdf`
- **Validation**: MIME type and size checking

## 🧪 Testing Validation

### Unit Tests

```typescript
describe('guestBookingSchema', () => {
  it('validates correct data', () => {
    const validData = {
      guest_name: 'John Doe',
      email: 'john@example.com',
      phone_number: '+63 912 345 6789',
      unit_id: '550e8400-e29b-41d4-a716-446655440000',
      check_in: new Date('2024-12-20'),
      check_out: new Date('2024-12-22'),
      num_guests: 2,
      payment_proof: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      turnstile_token: 'valid-token',
    }

    const result = guestBookingSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const invalidData = {
      ...validData,
      email: 'not-an-email',
    }

    const result = guestBookingSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['email'])
  })

  it('sanitizes malicious input', () => {
    const maliciousData = {
      ...validData,
      guest_name: '<script>alert("XSS")</script>John Doe',
    }

    const result = guestBookingSchema.parse(maliciousData)
    expect(result.guest_name).not.toContain('<script>')
    expect(result.guest_name).toContain('John Doe')
  })

  it('validates check-out after check-in', () => {
    const invalidData = {
      ...validData,
      check_in: new Date('2024-12-22'),
      check_out: new Date('2024-12-20'),  // Before check-in
    }

    const result = guestBookingSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('Check-out must be after check-in')
  })

  it('rejects files larger than 2MB', () => {
    const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg')
    const invalidData = {
      ...validData,
      payment_proof: largeFile,
    }

    const result = guestBookingSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('2MB')
  })

  it('normalizes phone numbers', () => {
    const data = {
      ...validData,
      phone_number: '+63 (912) 345-6789',
    }

    const result = guestBookingSchema.parse(data)
    expect(result.phone_number).toBe('639123456789')  // Normalized
  })
})
```

## 📚 Error Handling

### Error Messages

Zod provides structured error information:

```typescript
const result = guestBookingSchema.safeParse(invalidData)

if (!result.success) {
  // Access formatted errors
  const errors = result.error.format()
  console.log(errors.email?._errors)  // ["Invalid email address"]
  console.log(errors.guest_name?._errors)  // ["Name must be at least 2 characters"]

  // Access all issues
  result.error.issues.forEach(issue => {
    console.log(`${issue.path.join('.')}: ${issue.message}`)
  })
}
```

### Display in Forms

```tsx
import { FormMessage } from '@/components/ui/form'

<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />  {/* Automatically displays validation errors */}
    </FormItem>
  )}
/>
```

## 🎯 Best Practices

1. ✅ **Always sanitize text inputs** with DOMPurify transform
2. ✅ **Use safeParse()** for user input (returns success/error)
3. ✅ **Use parse()** for trusted input (throws on error)
4. ✅ **Validate on both client and server** for security
5. ✅ **Provide clear error messages** for users
6. ✅ **Test edge cases** thoroughly
7. ✅ **Use cross-field validation** for related fields
8. ✅ **Transform data** for consistency (lowercase emails, normalized phones)
9. ✅ **Validate file types and sizes** for uploads
10. ✅ **Document validation rules** in comments

## 📊 Common Validation Patterns

### Optional Fields

```typescript
special_requests: z.string()
  .max(500)
  .optional()  // Can be undefined
  .transform((val) => val ? DOMPurify.sanitize(val) : undefined)
```

### Coerced Types

```typescript
num_guests: z.coerce.number()  // Converts string "2" to number 2
  .int()
  .min(1)
  .max(20)
```

### Conditional Validation

```typescript
.refine((data) => {
  if (data.payment_method === 'credit_card') {
    return !!data.card_number  // Require card number for credit card
  }
  return true
}, {
  message: "Card number required for credit card payments",
  path: ["card_number"],
})
```

### Transform Data

```typescript
email: z.string()
  .email()
  .toLowerCase()  // Automatically lowercase

phone_number: z.string()
  .transform((val) => val.replace(/[\s\-()]/g, ""))  // Remove formatting
```

## 🔄 Future Enhancements

- [ ] Create booking schema (with authentication)
- [ ] Update booking schema
- [ ] Guest profile schema
- [ ] Unit configuration schema
- [ ] Payment processing schema
- [ ] Report generation schema
- [ ] Settings/preferences schema
- [ ] Admin user schema
- [ ] Audit log schema

## 📚 Related Documentation

- [Guest Booking Form](/src/components/guest-booking/README.md) - Client-side usage
- [Booking Form](/src/components/bookings/BookingForm/README.md) - Multi-step validation
- [API Endpoints](/functions/api/README.md) - Server-side validation
- [Security Guidelines](/docs/security/README.md) - Input sanitization
- [Testing](/src/__tests__/README.md) - Validation testing

## 🔒 Security Checklist

- [x] XSS prevention (DOMPurify sanitization)
- [x] SQL injection prevention (parameterized queries)
- [x] File upload validation (type & size)
- [x] Phone number normalization
- [x] Email validation & normalization
- [x] Cross-field validation (dates)
- [x] Max length enforcement
- [x] MIME type validation
- [x] Turnstile token requirement
- [x] Input transformation (sanitize, normalize)
