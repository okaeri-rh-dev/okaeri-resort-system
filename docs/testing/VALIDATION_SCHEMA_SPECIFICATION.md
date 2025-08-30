# Validation Schema Specification

> **Purpose**: Comprehensive Zod schema specifications for form validation  
> **Status**: Authoritative Reference  
> **Last Updated**: August 2025

---

## Overview

This document defines all validation schemas using Zod for the Okaeri Resort
Management System. These schemas ensure consistent validation across forms, API
endpoints, and data processing with special attention to Philippine business
context.

---

## 1. Authentication Schemas

### Login Schema

```typescript
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .toLowerCase()
    .trim()
    .refine(
      (email) => !email.endsWith(".con"), // Common typo
      "Did you mean .com?"
    ),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
  rememberMe: z.boolean().optional().default(false),
  captchaToken: z.string().optional(), // After 3 failed attempts
});

type LoginInput = z.infer<typeof loginSchema>;
```

### Registration Schema

```typescript
const registerSchema = z
  .object({
    // Personal Information
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name too long")
      .regex(/^[a-zA-ZÀ-ÿĀ-ž\s'-]+$/, "Invalid characters in name"), // Supports Filipino names with diacritics
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name too long")
      .regex(/^[a-zA-ZÀ-ÿĀ-ž\s'-]+$/),
    middleName: z
      .string()
      .max(50, "Middle name too long")
      .regex(/^[a-zA-ZÀ-ÿĀ-ž\s'-]*$/)
      .optional(),

    // Business Information
    businessName: z
      .string()
      .min(1, "Business name is required")
      .max(100, "Business name too long")
      .regex(/^[a-zA-Z0-9À-ÿĀ-ž\s'-.&,]+$/, "Invalid business name format"),
    businessType: z.enum([
      "resort",
      "hotel",
      "pension_house",
      "transient_house",
      "apartment",
      "other",
    ]),
    businessRegistrationNumber: z
      .string()
      .regex(/^[0-9]{10,15}$/, "Invalid DTI/SEC registration number")
      .optional(),

    // Contact Information
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .toLowerCase()
      .trim(),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .regex(/^(\+63|0)[0-9]{10}$/, "Invalid Philippine phone number")
      .transform((val) => {
        // Normalize to +63 format
        return val.startsWith("0") ? "+63" + val.slice(1) : val;
      }),

    // Security
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
        "Password must contain uppercase, lowercase, number, and special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),

    // Legal
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, "You must accept the terms"),
    privacyAccepted: z
      .boolean()
      .refine((val) => val === true, "You must accept the privacy policy"),
    marketingConsent: z.boolean().optional().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterInput = z.infer<typeof registerSchema>;
```

### Password Reset Schema

```typescript
const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .toLowerCase()
    .trim(),
});

const passwordResetSchema = z
  .object({
    token: z
      .string()
      .min(1, "Reset token is required")
      .length(64, "Invalid reset token"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
        "Password must meet security requirements"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

### Two-Factor Authentication Schema

```typescript
const twoFactorSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^[0-9]{6}$/, "Code must contain only numbers"),
  trustDevice: z.boolean().optional().default(false),
});
```

---

## 2. Booking Schemas

### Create Booking Schema

```typescript
const createBookingSchema = z
  .object({
    // Guest Information
    guestName: z
      .string()
      .min(1, "Guest name is required")
      .max(100, "Guest name too long"),
    guestEmail: z
      .string()
      .email("Invalid email format")
      .optional()
      .or(z.literal("")),
    guestPhone: z
      .string()
      .regex(/^(\+63|0)[0-9]{10}$/, "Invalid phone number")
      .optional()
      .or(z.literal("")),
    numberOfGuests: z
      .number()
      .int("Must be a whole number")
      .min(1, "At least 1 guest required")
      .max(50, "Maximum 50 guests"),

    // Booking Details
    propertyId: z.string().uuid("Invalid property ID"),
    roomId: z.string().uuid("Invalid room ID"),
    checkIn: z
      .string()
      .datetime()
      .or(z.date())
      .refine(
        (date) => new Date(date) >= new Date(),
        "Check-in date must be in the future"
      ),
    checkOut: z.string().datetime().or(z.date()),

    // Pricing
    totalAmount: z
      .number()
      .positive("Amount must be positive")
      .multipleOf(0.01, "Invalid currency format"),
    currency: z.enum(["PHP", "USD", "EUR"]).default("PHP"),
    paymentMethod: z.enum([
      "cash",
      "gcash",
      "bank_transfer",
      "credit_card",
      "paypal",
      "paymaya",
    ]),

    // Source
    source: z
      .enum(["direct", "airbnb", "booking_com", "agoda", "facebook", "walk_in"])
      .default("direct"),
    externalId: z.string().optional(),

    // Additional
    specialRequests: z.string().max(500).optional(),
    internalNotes: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

type CreateBookingInput = z.infer<typeof createBookingSchema>;
```

### Import Bookings Schema (CSV)

```typescript
const importBookingsSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => file.type === "text/csv" || file.name.endsWith(".csv"),
      "File must be CSV format"
    ),
  source: z.enum(["airbnb", "booking_com", "agoda", "custom"]),
  propertyId: z.string().uuid("Invalid property ID"),
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]).optional(),
  skipDuplicates: z.boolean().default(true),
});
```

---

## 3. Financial Schemas

### Expense Schema

```typescript
const expenseSchema = z
  .object({
    // Basic Information
    category: z.enum([
      "utilities",
      "maintenance",
      "supplies",
      "staff_salary",
      "marketing",
      "taxes",
      "insurance",
      "food_beverage",
      "laundry",
      "transportation",
      "professional_fees",
      "other",
    ]),
    subCategory: z.string().max(50).optional(),
    amount: z
      .number()
      .positive("Amount must be positive")
      .multipleOf(0.01, "Invalid currency format"),
    currency: z.enum(["PHP", "USD", "EUR"]).default("PHP"),

    // Details
    description: z
      .string()
      .min(1, "Description is required")
      .max(200, "Description too long"),
    date: z
      .string()
      .datetime()
      .or(z.date())
      .refine(
        (date) => new Date(date) <= new Date(),
        "Expense date cannot be in the future"
      ),

    // Payment Information
    paymentMethod: z.enum([
      "cash",
      "gcash",
      "bank_transfer",
      "credit_card",
      "check",
    ]),
    referenceNumber: z.string().max(50, "Reference number too long").optional(),
    vendor: z.string().max(100, "Vendor name too long").optional(),

    // Receipt
    hasReceipt: z.boolean().default(false),
    receiptFile: z
      .instanceof(File)
      .refine(
        (file) => file.size <= 10 * 1024 * 1024,
        "File size must be less than 10MB"
      )
      .refine(
        (file) => /\.(jpg|jpeg|png|pdf)$/i.test(file.name),
        "File must be JPG, PNG, or PDF"
      )
      .optional(),

    // Tax Information
    taxDeductible: z.boolean().default(false),
    vatAmount: z.number().min(0).multipleOf(0.01).optional(),

    // Recurring
    isRecurring: z.boolean().default(false),
    recurringFrequency: z
      .enum(["daily", "weekly", "monthly", "quarterly", "yearly"])
      .optional(),
    recurringEndDate: z.string().datetime().or(z.date()).optional(),
  })
  .refine(
    (data) => {
      if (data.isRecurring && !data.recurringFrequency) {
        return false;
      }
      return true;
    },
    {
      message: "Recurring frequency is required for recurring expenses",
      path: ["recurringFrequency"],
    }
  );

type ExpenseInput = z.infer<typeof expenseSchema>;
```

### Income Report Schema

```typescript
const incomeReportSchema = z
  .object({
    startDate: z.string().datetime().or(z.date()),
    endDate: z.string().datetime().or(z.date()),
    groupBy: z.enum(["day", "week", "month", "quarter", "year"]),
    includeCategories: z.array(z.string()).optional(),
    excludeCategories: z.array(z.string()).optional(),
    properties: z.array(z.string().uuid()).optional(),
    format: z.enum(["json", "csv", "pdf", "excel"]).default("json"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after or equal to start date",
    path: ["endDate"],
  });
```

---

## 4. Property Management Schemas

### Property Schema

```typescript
const propertySchema = z.object({
  name: z
    .string()
    .min(1, "Property name is required")
    .max(100, "Property name too long"),
  type: z.enum([
    "resort",
    "hotel",
    "apartment",
    "villa",
    "cottage",
    "transient",
  ]),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    barangay: z.string().min(1, "Barangay is required"),
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"),
    zipCode: z.string().regex(/^[0-9]{4}$/, "Invalid Philippine ZIP code"),
    country: z.literal("Philippines").default("Philippines"),
  }),
  rooms: z
    .array(
      z.object({
        name: z.string().min(1, "Room name is required"),
        type: z.enum(["single", "double", "suite", "family", "dormitory"]),
        capacity: z.number().int().min(1).max(20),
        basePrice: z.number().positive().multipleOf(0.01),
        amenities: z.array(z.string()).optional(),
      })
    )
    .min(1, "At least one room is required"),
  amenities: z.array(z.string()).optional(),
  policies: z.object({
    checkInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    checkOutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    cancellationDays: z.number().int().min(0).max(30),
    childrenAllowed: z.boolean(),
    petsAllowed: z.boolean(),
    smokingAllowed: z.boolean(),
  }),
});
```

---

## 5. Integration with React Hook Form

### Usage Example

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit = async (data: LoginInput) => {
    try {
      await authService.login(data)
    } catch (error) {
      if (error.field) {
        setError(error.field, { message: error.message })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('password')} type="password" />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Login
      </button>
    </form>
  )
}
```

---

## 6. Custom Validation Helpers

### Philippine-Specific Validators

```typescript
// TIN (Tax Identification Number)
const tinValidator = z
  .string()
  .regex(/^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{3}$/, "Invalid TIN format");

// SSS Number
const sssValidator = z
  .string()
  .regex(/^[0-9]{2}-[0-9]{7}-[0-9]$/, "Invalid SSS number");

// PhilHealth Number
const philHealthValidator = z
  .string()
  .regex(/^[0-9]{2}-[0-9]{9}-[0-9]$/, "Invalid PhilHealth number");

// Philippine Mobile Number
const mobileValidator = z
  .string()
  .regex(/^(09|\+639)[0-9]{9}$/, "Invalid mobile number")
  .transform((val) => (val.startsWith("09") ? "+63" + val.slice(1) : val));
```

### Business Validators

```typescript
// DTI Registration (sole proprietorship)
const dtiValidator = z
  .string()
  .regex(/^[0-9]{10}$/, "Invalid DTI registration number");

// SEC Registration (corporation)
const secValidator = z
  .string()
  .regex(/^[A-Z]{2}[0-9]{10}$/, "Invalid SEC registration number");

// BIR Registration
const birValidator = z
  .string()
  .regex(/^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{6}$/, "Invalid BIR registration");
```

---

## 7. Error Message Standards

### Message Format

```typescript
const errorMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `Invalid ${field} format`,
  tooShort: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  tooLong: (field: string, max: number) =>
    `${field} must be less than ${max} characters`,
  mismatch: (field1: string, field2: string) =>
    `${field1} and ${field2} do not match`,
  duplicate: (field: string) => `This ${field} is already registered`,
  notFound: (field: string) => `${field} not found`,
  expired: (field: string) => `${field} has expired`,
  invalidCredentials: () => "Invalid email or password",
  networkError: () => "Network error. Please check your connection",
  serverError: () => "Server error. Please try again later",
};
```

### Localization Support

```typescript
const i18nSchema = (t: TranslationFunction) =>
  z.object({
    email: z
      .string()
      .min(1, t("validation.email.required"))
      .email(t("validation.email.invalid")),
    password: z.string().min(8, t("validation.password.minLength", { min: 8 })),
  });
```

---

## 8. Performance Optimization

### Lazy Validation

```typescript
const lazySchema = z.lazy(() => expensiveSchema);
```

### Memoized Schemas

```typescript
const memoizedSchema = useMemo(() => createDynamicSchema(config), [config]);
```

### Async Validation

```typescript
const emailUniqueSchema = z
  .string()
  .email()
  .refine(
    async (email) => {
      const exists = await checkEmailExists(email);
      return !exists;
    },
    { message: "Email already registered" }
  );
```

---

## 9. Testing Validation Schemas

### Unit Tests

```typescript
describe("loginSchema", () => {
  it("should validate correct input", () => {
    const input = {
      email: "test@resort.com",
      password: "ValidPass123!",
    };

    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const input = {
      email: "invalid-email",
      password: "ValidPass123!",
    };

    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(["email"]);
  });
});
```

---

## 10. Integration with Backend

### API Validation

```typescript
// API endpoint validation
app.post(
  "/api/bookings",
  validateBody(createBookingSchema),
  async (req, res) => {
    // Request body is typed and validated
    const booking = await createBooking(req.body);
    res.json(booking);
  }
);
```

### Database Validation

```typescript
// Before database insert
const validateBeforeInsert = async (data: unknown) => {
  const validated = await bookingSchema.parseAsync(data);
  return db.bookings.create(validated);
};
```

---

## Summary

These validation schemas provide comprehensive, type-safe validation for all
forms and data inputs in the Okaeri Resort Management System. They handle
Philippine-specific business requirements, ensure data integrity, and provide
clear error messages for optimal user experience.
