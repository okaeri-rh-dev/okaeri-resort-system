# Chunk 009: Form Validation and Submission

## At a Glance

| Property | Value |
|----------|-------|
| **Estimated Time** | 120 minutes |
| **Milestone** | Multi-Step Guest Booking Form Complete |
| **Prerequisites** | ✅ Chunk 004 (`POST /api/guest-booking` endpoint operational)<br>✅ Chunk 006 (Date and Unit Selection UI components)<br>✅ Chunk 007 (PaymentSummary component with preview)<br>✅ Chunk 008 (PaymentProofUpload component) |
| **Can Skip?** | ❌ No - Core booking form functionality |
| **Phase** | Phase 2: Guest Booking Flow (4 of 5) |

## What You're Building

This chunk implements the **multi-step booking form wizard** with comprehensive validation, security measures, and seamless user experience. This is the orchestration layer that ties together all previous UI components into a cohesive booking flow.

### 1. Multi-Step Wizard Architecture (5 Steps)

**Step 1: Booking Dates**
- Check-in date picker (must be future date)
- Check-out date picker (must be after check-in)
- Minimum 1 night validation
- Visual date range summary

**Step 2: Unit Selection**
- Integration with `UnitRequestSelector` (Chunk 006)
- Array-based unit requests (1 card = 1 unit)
- Guest count per unit validation
- Add/remove unit cards dynamically
- Total units and guests summary

**Step 3: Contact Information**
- Guest name (2-100 characters)
- Email validation (RFC 5322 format)
- Philippine phone number validation (`+63` or `09xx` format)
- Special requests textarea (optional, max 1000 chars)
- DOMPurify sanitization for all text inputs

**Step 4: Payment Proof Upload**
- Integration with `PaymentProofUpload` (Chunk 008)
- File validation (JPEG/PNG/PDF, max 5MB)
- Upload progress indicator
- File preview display
- Optional (can submit without proof initially)

**Step 5: Review and Confirm**
- Complete booking summary
- Payment preview (server-calculated)
- Terms and conditions checkbox (required)
- Cloudflare Turnstile CAPTCHA (required)
- Submit button with loading state

### 2. Validation Layers

```
Layer 1: Client-Side Validation (Zod Schema)
    ↓
Layer 2: Input Sanitization (DOMPurify)
    ↓
Layer 3: Security Verification (Turnstile)
    ↓
Layer 4: Idempotency Check (UUID)
    ↓
Layer 5: Server-Side Validation (API)
```

**Zod Validation Schema:**
```typescript
// Array-based unit requests validation
unit_requests: z.array(
  z.object({
    guests_per_unit: z.number().int().min(1).max(20)
  })
).min(1, "At least one unit required")
  .max(10, "Maximum 10 units per booking")

// Contact validation
guest_name: z.string().min(2).max(100)
email: z.string().email().toLowerCase()
phone_number: z.string().regex(/^\+?[0-9\s\-()]{10,20}$/)

// Date validation with refinement
.refine((data) => new Date(data.check_out) > new Date(data.check_in), {
  message: "Check-out must be after check-in"
})

// Terms acceptance
terms_accepted: z.boolean().refine((val) => val === true)
```

**DOMPurify Sanitization:**
```typescript
import DOMPurify from 'dompurify';

const sanitized = {
  guest_name: DOMPurify.sanitize(data.guest_name, { ALLOWED_TAGS: [] }),
  special_requests: DOMPurify.sanitize(data.special_requests, {
    ALLOWED_TAGS: []
  })
};
```

### 3. Form State Management

**React Hook Form Integration:**
- Type-safe form handling with TypeScript
- Step-by-step validation (validate current step before advancing)
- Form state persistence across steps
- Error display with field-specific messages
- Watch values for reactive UI updates

**Optimistic UI Pattern:**
```typescript
// Immediate UI feedback
setIsSubmitting(true);
showSuccessMessage("Creating booking...");

// API call
const response = await fetch('/api/guest-booking', { ... });

// Handle result
if (response.ok) {
  navigate(`/booking-confirmation/${booking_reference}`);
} else {
  rollbackOptimisticUI();
  showError(error.message);
}
```

### 4. Security Measures

**Cloudflare Turnstile Integration:**
- Widget rendered in final step
- Token required for submission
- Validates human interaction
- Prevents bot submissions
- 5-minute token expiry

**Idempotency Protection:**
```typescript
// Client generates UUID once
const [idempotencyKey] = useState(() => crypto.randomUUID());

// Included in every submission
const payload = {
  ...formData,
  idempotency_key: idempotencyKey
};

// Server checks for duplicates
// Returns existing booking if key already used
```

**XSS Prevention:**
- All text inputs sanitized with DOMPurify
- HTML tags stripped from user input
- Script injection prevented
- Safe for database storage

### 5. Error Handling Strategy

**Validation Errors (Client):**
- Field-level error messages below inputs
- Step-level error summary at top
- Cannot advance to next step until current step valid
- Visual error indicators (red border, error icon)

**Network Errors:**
- Retry mechanism with exponential backoff
- Clear error messaging ("Network error. Please try again.")
- Form state preserved for retry
- Loading state prevents duplicate submissions

**API Errors:**
- Specific error messages from server
- Distinguish between validation, business logic, and system errors
- User-friendly error descriptions
- Option to contact support for unrecoverable errors

### 6. User Experience Enhancements

**Progress Indicator:**
```
[1. Dates] → [2. Units] → [3. Contact] → [4. Payment] → [5. Review]
   ✓           ✓            •              -              -
```

**Step Navigation:**
- Next/Back buttons for navigation
- Steps clickable to jump to previous steps
- Current step highlighted
- Completed steps marked with checkmark

**Auto-Save (Future Enhancement):**
- Form state saved to localStorage
- Restored on page refresh
- Expires after 24 hours
- Privacy-conscious (no sensitive data)

## Why This Matters

### Business Impact

**Conversion Optimization:**
- Multi-step wizard reduces cognitive load (one section at a time)
- Progress indicator shows completion percentage
- Back button allows corrections without starting over
- Clear error messages prevent abandonment

**Fraud Prevention:**
- Turnstile blocks bot submissions
- DOMPurify prevents injection attacks
- Idempotency prevents accidental duplicates
- Email/phone validation reduces fake bookings

**Data Quality:**
- Zod validation ensures clean data
- Required fields enforced at UI level
- Philippine phone format validation
- Email format verification

### Technical Benefits

**Security-First Architecture:**
- Defense-in-depth validation (client + server)
- XSS prevention with DOMPurify
- CAPTCHA verification with Turnstile
- Idempotency protection

**Type Safety:**
- End-to-end TypeScript types
- Zod schema inferred types
- Compile-time error detection
- Autocomplete for form fields

**Maintainability:**
- Single source of truth (Zod schema)
- Reusable validation logic
- Clear separation of concerns
- Testable validation functions

### User Experience Impact

**Guided Workflow:**
- Step-by-step process reduces confusion
- Clear progress tracking
- Inline validation provides instant feedback
- Review step allows final verification

**Error Prevention:**
- Validation before step advancement
- Clear error messages with solutions
- Visual indicators (red borders, icons)
- Cannot submit invalid form

**Mobile-Responsive:**
- One step visible at a time (mobile-friendly)
- Large touch targets for navigation
- Scrollable content within steps
- Optimized for small screens

## Before You Start

### Prerequisites Checklist

**API Endpoints (from Chunk 004):**
- [ ] `POST /api/guest-booking` endpoint deployed and operational
- [ ] Endpoint accepts array-based `unit_requests` format
- [ ] Endpoint validates Turnstile token server-side
- [ ] Endpoint checks idempotency keys
- [ ] Endpoint returns proper error messages
- [ ] See 02-api-specification.md lines 1-300

**UI Components (from Chunks 006-008):**
- [ ] `UnitRequestSelector` component available (Chunk 006)
- [ ] `PaymentSummary` component available (Chunk 007)
- [ ] `PaymentProofUpload` component available (Chunk 008)
- [ ] All components tested independently

**Dependencies Installed:**
```bash
# Verify required packages
npm ls react-hook-form @hookform/resolvers zod dompurify @marsidev/react-turnstile

# Expected output (versions may vary):
# ├── react-hook-form@7.x.x
# ├── @hookform/resolvers@3.x.x
# ├── zod@3.x.x
# ├── dompurify@3.x.x
# └── @marsidev/react-turnstile@0.x.x
```

**Cloudflare Turnstile:**
- [ ] Turnstile site key obtained from Cloudflare dashboard
- [ ] Site key added to `.env.local`: `VITE_TURNSTILE_SITE_KEY=your_key`
- [ ] Test mode enabled for development (uses test tokens)
- [ ] See https://developers.cloudflare.com/turnstile/

**TypeScript Configuration:**
- [ ] `strict: true` enabled in `tsconfig.json`
- [ ] Type definitions for all dependencies installed
- [ ] No TypeScript errors in existing components

**Form State Types:**
```typescript
// Verify types exist in src/types/guest-booking-multi-unit.ts
export interface UnitRequest {
  guests_per_unit: number;
}

export interface MultiUnitBookingRequest {
  guest_name: string;
  email: string;
  phone_number: string;
  check_in: string;
  check_out: string;
  unit_requests: UnitRequest[];
  special_requests?: string;
  payment_proof_url?: string;
  turnstile_token: string;
  terms_accepted: boolean;
  idempotency_key: string;
}
```

### Verify Prerequisites

```bash
# 1. Test API endpoint
curl -X POST http://localhost:8788/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+639171234567",
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T10:00:00Z",
    "unit_requests": [{"guests_per_unit": 2}],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true,
    "idempotency_key": "test-uuid-123"
  }'

# Expected: 200 OK with booking response

# 2. Verify components render
npm run dev
# Navigate to http://localhost:5173/guest-booking
# Check: UnitRequestSelector, PaymentSummary, PaymentProofUpload visible

# 3. Check TypeScript compilation
npm run type-check
# Expected: No errors

# 4. Verify environment variables
cat .env.local | grep TURNSTILE
# Expected: VITE_TURNSTILE_SITE_KEY=...
```

## What Happens Next

After completing this chunk successfully:

### Immediate Outcomes

✅ **Multi-Step Wizard Complete** - All 5 steps functional with navigation
✅ **Validation Active** - Zod schema validates all inputs
✅ **Sanitization Working** - DOMPurify sanitizes text inputs
✅ **Turnstile Verified** - CAPTCHA required and validated
✅ **Terms Required** - Cannot submit without accepting terms
✅ **Idempotency Protected** - Duplicate submissions prevented
✅ **Error Handling Robust** - Clear messages for all failure scenarios
✅ **Optimistic UI** - Immediate feedback on submission

### Integration Points

**Chunk 010 (Next):** Booking Confirmation Flow
- Form submits successfully
- Redirects to confirmation page with booking reference
- Displays booking summary and payment instructions

**Admin UI (Chunk 011):** Pending Bookings Queue
- Submitted bookings appear in admin queue
- Admin can view payment proof
- Admin assigns units after payment verification

### Next Steps

**Ready for Chunk 010:** Booking Confirmation Flow
- Will display booking reference prominently
- Show payment instructions
- Display unit request summary
- Allow printing/downloading confirmation

### System State After Completion

```
Phase 1: Database & Backend Core ✅ COMPLETE
├── 001: Database schema ✅
├── 002: PostgreSQL pricing engine ✅
├── 003: Security, RLS, constraints ✅
├── 004: Core API endpoints ✅
└── 005: Idempotency & rate limiting ✅

Phase 2: Guest Booking Flow (In Progress)
├── 006: Date and Unit Selection UI ✅
├── 007: Payment Summary with Preview ✅
├── 008: Payment Proof Upload ✅
├── 009: Form Validation and Submission ✅ (YOU ARE HERE)
└── 010: Booking Confirmation Flow (NEXT)
```

## Key Files Created/Modified

```
okaeri-resort/
├── src/
│   ├── components/
│   │   └── guest-booking/
│   │       ├── MultiUnitGuestBookingForm.tsx    # NEW - Main form component
│   │       ├── FormStepIndicator.tsx            # NEW - Progress indicator
│   │       ├── BookingReviewStep.tsx            # NEW - Review step component
│   │       └── index.ts                         # MODIFIED - Export new components
│   ├── lib/
│   │   ├── security/
│   │   │   └── sanitize.ts                      # NEW - DOMPurify wrapper
│   │   └── validation/
│   │       └── booking-schema.ts                # NEW - Zod schemas
│   ├── types/
│   │   └── guest-booking-multi-unit.ts          # MODIFIED - Add form step types
│   └── routes/
│       └── guest-booking.tsx                    # MODIFIED - Integrate form
└── __tests__/
    ├── components/
    │   └── guest-booking/
    │       └── MultiUnitGuestBookingForm.test.tsx  # NEW - Form tests
    └── lib/
        └── validation/
            └── booking-schema.test.ts           # NEW - Validation tests
```

### File Purposes

**`MultiUnitGuestBookingForm.tsx`** (NEW - ~600 lines):
- Multi-step wizard state management
- React Hook Form integration
- Step navigation logic
- Form submission handling
- Error state management
- Integration with all child components
- Optimistic UI implementation

**`FormStepIndicator.tsx`** (NEW - ~100 lines):
- Progress bar component
- Step labels and icons
- Clickable step navigation
- Visual completion indicators
- Mobile-responsive layout

**`BookingReviewStep.tsx`** (NEW - ~200 lines):
- Booking summary display
- All entered data review
- Terms checkbox integration
- Turnstile widget integration
- Submit button with loading state

**`sanitize.ts`** (NEW - ~50 lines):
- DOMPurify wrapper function
- Consistent sanitization config
- Type-safe sanitization
- Export `sanitizeInput()` utility

**`booking-schema.ts`** (NEW - ~150 lines):
- Complete Zod validation schema
- Custom validation refinements
- Error message definitions
- TypeScript type inference

**`MultiUnitGuestBookingForm.test.tsx`** (NEW - ~300 lines):
- Step navigation tests
- Validation tests
- Submission tests
- Error handling tests
- Mock API responses

## Related Documentation

### Source Documentation

- **CHUNKING-STRATEGY.md lines 305-339**: Chunk 009 specification and scope
- **03-frontend-components.md lines 760-1050**: Complete form implementation
  - Lines 764-815: Form setup and state management
  - Lines 816-853: Submission handler with sanitization
  - Lines 855-1015: Complete form JSX structure
  - Lines 1018-1049: Testing checklist and implementation notes
- **02-api-specification.md lines 1-100**: API request/response types
  - Lines 21-66: Zod schema definitions
  - Lines 69-97: Response type structure
- **09-implementation-decisions.md lines 387-407**: Security validation decisions

### Architectural Decisions

- **Multi-Step Wizard** (CHUNKING-STRATEGY.md lines 323-327): Why 5 steps
- **DOMPurify Sanitization** (09-implementation-decisions.md lines 387-392): XSS prevention
- **Turnstile Verification** (CHUNKING-STRATEGY.md line 326): Bot prevention
- **Idempotency** (09-implementation-decisions.md lines 226-258): Duplicate prevention
- **Server-Side Pricing** (09-implementation-decisions.md lines 42-63): Authority model

### Integration Points

- **Chunk 004**: POST `/api/guest-booking` endpoint
- **Chunk 006**: `UnitRequestSelector` component
- **Chunk 007**: `PaymentSummary` component
- **Chunk 008**: `PaymentProofUpload` component
- **Chunk 010** (next): Booking confirmation page

## Implementation Strategy

### Component Architecture

```
MultiUnitGuestBookingForm (Container)
├── FormStepIndicator (Progress UI)
├── Step 1: Booking Dates
│   ├── DatePicker (check-in)
│   └── DatePicker (check-out)
├── Step 2: Unit Selection
│   └── UnitRequestSelector (from Chunk 006)
├── Step 3: Contact Information
│   ├── Input (name)
│   ├── Input (email)
│   ├── Input (phone)
│   └── Textarea (special requests)
├── Step 4: Payment Proof
│   └── PaymentProofUpload (from Chunk 008)
└── Step 5: Review and Confirm
    └── BookingReviewStep
        ├── Booking summary
        ├── PaymentSummary (from Chunk 007)
        ├── Checkbox (terms)
        ├── Turnstile widget
        └── Submit button
```

### State Management Pattern

```typescript
const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

const form = useForm<MultiUnitBookingRequest>({
  resolver: zodResolver(bookingSchema),
  mode: 'onBlur', // Validate on blur for better UX
  defaultValues: {
    unit_requests: [{ guests_per_unit: 2 }], // Start with 1 unit
    terms_accepted: false
  }
});

// Step validation before advancing
const validateStep = async (step: number): Promise<boolean> => {
  const fields = STEP_FIELDS[step];
  const result = await form.trigger(fields);
  if (result) {
    setCompletedSteps(prev => new Set(prev).add(step));
  }
  return result;
};
```

### Validation Flow

```
User clicks "Next" button
    ↓
Validate current step fields (Zod)
    ↓
If valid: Mark step complete, advance to next
If invalid: Show errors, stay on current step
    ↓
User clicks "Submit" (final step)
    ↓
Validate all fields (Zod)
    ↓
Sanitize text inputs (DOMPurify)
    ↓
Check Turnstile token exists
    ↓
Submit to API with idempotency key
    ↓
Show optimistic success UI
    ↓
Handle API response
    ↓
Navigate to confirmation page OR show error
```

## Security Considerations

### Input Sanitization

**Why DOMPurify:**
- Removes HTML tags and scripts
- Prevents XSS attacks
- Configurable allowlists
- Battle-tested library

**What Gets Sanitized:**
- `guest_name` (strip all HTML)
- `special_requests` (strip all HTML)
- Email and phone (validated by Zod, not sanitized)

**Example:**
```typescript
// Input: "John <script>alert('xss')</script> Doe"
// Output: "John  Doe"

const sanitized = DOMPurify.sanitize(input, {
  ALLOWED_TAGS: [],  // Strip all HTML
  ALLOWED_ATTR: []   // Strip all attributes
});
```

### Turnstile Integration

**Widget Configuration:**
```typescript
<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onSuccess={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileError(true)}
  onExpire={() => setTurnstileToken(null)}
  theme="light"
  size="normal"
/>
```

**Token Lifecycle:**
- Rendered in final review step
- User completes CAPTCHA challenge
- Token generated (valid 5 minutes)
- Token sent with form submission
- Server validates token with Cloudflare API
- Token cannot be reused (single-use)

### Idempotency Protection

**Client-Side:**
```typescript
// Generated once per form instance
const [idempotencyKey] = useState(() => crypto.randomUUID());

// Included in submission
const payload = { ...formData, idempotency_key: idempotencyKey };
```

**Server-Side (Chunk 004):**
- Check if key already used
- If yes: Return existing booking (200 OK with `is_duplicate: true`)
- If no: Create new booking
- Store key with 48-hour expiry

**Why This Matters:**
- Prevents accidental duplicate bookings
- Safe to retry failed submissions
- Network errors don't create duplicates
- User-friendly error recovery

## Performance Considerations

### Form Rendering Optimization

**Lazy Load Steps:**
```typescript
// Only render current step (not all 5 at once)
{currentStep === 1 && <DatesStep />}
{currentStep === 2 && <UnitsStep />}
{currentStep === 3 && <ContactStep />}
{currentStep === 4 && <PaymentStep />}
{currentStep === 5 && <ReviewStep />}
```

**Debounced Validation:**
```typescript
// Validate on blur, not every keystroke
const form = useForm({
  mode: 'onBlur',  // Not 'onChange'
  reValidateMode: 'onBlur'
});
```

### Bundle Size Impact

**New Dependencies:**
- `react-hook-form`: ~25KB gzipped
- `zod`: ~13KB gzipped
- `dompurify`: ~19KB gzipped
- `@marsidev/react-turnstile`: ~5KB gzipped

**Total Impact:** ~62KB gzipped (acceptable for critical form functionality)

## Common Questions

**Q: Why 5 steps instead of a single long form?**
A: Multi-step wizard reduces cognitive load, allows focused validation, and is mobile-friendly (one section at a time).

**Q: Why React Hook Form instead of vanilla state?**
A: Type safety, built-in validation, performance optimizations, and error handling out of the box.

**Q: Why Zod instead of Yup or Joi?**
A: TypeScript-first design, type inference, better error messages, and lightweight bundle size.

**Q: Can users skip the payment proof upload step?**
A: Yes, payment proof is optional at booking time. Admin contacts guest if proof not provided.

**Q: What happens if Turnstile fails to load?**
A: Form shows error message and cannot be submitted. User should refresh page or contact support.

**Q: Why sanitize if we're validating with Zod?**
A: Defense in depth. Zod validates format, DOMPurify prevents XSS. Both are necessary.

**Q: What if user closes browser mid-booking?**
A: Current implementation: Form data lost. Future: Auto-save to localStorage (Chunk 010 enhancement).

**Q: Why idempotency key generated client-side?**
A: Allows retry of same booking without creating duplicates. Server-side generation doesn't help with network retries.

**Q: Can admin see incomplete bookings?**
A: No, only submitted bookings appear in admin queue. Incomplete forms are not persisted.

---

**Ready to implement?** Proceed to `instructions.md` for step-by-step implementation guide.
