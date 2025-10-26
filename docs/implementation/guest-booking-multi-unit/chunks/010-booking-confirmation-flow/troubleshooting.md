# Troubleshooting: Booking Confirmation Flow

## Common Issues and Solutions

This guide addresses common problems encountered during Chunk 010 implementation. Issues are organized by symptom with step-by-step solutions.

---

## Route Navigation Issues

### Issue: Confirmation page shows "404 Not Found"

**Symptom:**

- Navigate to `/booking-confirmation/BK-2025-001234`
- Get 404 error or blank page
- No errors in console

**Cause:** Route file name or location incorrect

**Solution:**

**Verify file name exactly:**

```bash
# File MUST be named with $parameter syntax
ls -la src/routes/booking-confirmation/\$bookingReference.tsx

# NOT these:
# ❌ bookingReference.tsx
# ❌ :bookingReference.tsx
# ❌ [bookingReference].tsx
```

**Correct file structure:**

```
src/
└── routes/
    └── booking-confirmation/
        └── $bookingReference.tsx  ← Dollar sign prefix
```

**If still failing, check TanStack Router configuration:**

```typescript
// In main router configuration
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen"; // Auto-generated

const router = createRouter({ routeTree });

// Verify routeTree includes booking-confirmation route
console.log(router.routesById);
// Should include: "/booking-confirmation/$bookingReference"
```

---

### Issue: Route params undefined

**Symptom:**

- Page loads but `bookingReference` is undefined
- Error: "Cannot read property 'booking_reference' of undefined"

**Cause:** Not accessing route params correctly

**Solution:**

**In route file:**

```typescript
// ❌ Wrong
export const Route = createFileRoute("/booking-confirmation/$bookingReference")({
  component: function BookingConfirmationPage() {
    const params = useParams(); // This won't work
    console.log(params.bookingReference); // undefined
  },
});

// ✅ Correct
export const Route = createFileRoute("/booking-confirmation/$bookingReference")({
  component: BookingConfirmationPage,
  loader: async ({ params }) => {
    // params.bookingReference available here
    console.log(params.bookingReference);
    return fetchBooking(params.bookingReference);
  },
});

function BookingConfirmationPage() {
  const booking = Route.useLoaderData(); // ✅ Access loader data
  // OR
  const { bookingReference } = Route.useParams(); // ✅ Access params
}
```

---

## Data Loading Issues

### Issue: "Booking not found" error for valid booking

**Symptom:**

- Valid booking reference in URL
- API returns 404 or empty response
- Error page displays

**Cause 1:** API endpoint URL incorrect

**Solution:**

```typescript
// Check API endpoint
const response = await fetch(`/api/guest-booking/${params.bookingReference}`);

// Verify endpoint exists:
curl http://localhost:8788/api/guest-booking/BK-2025-001234

// If 404, check API implementation (Chunk 004)
// Endpoint should be: GET /api/guest-booking/:booking_reference
```

**Cause 2:** Booking doesn't exist in database

**Solution:**

```bash
# Check database directly
# Connect to Supabase or your PostgreSQL
SELECT * FROM bookings WHERE booking_reference = 'BK-2025-001234';

# If empty, booking not created
# Go back to Chunk 009 and verify form submission
```

---

### Issue: Booking data incomplete or missing fields

**Symptom:**

- Page loads but some data missing
- Pricing breakdown undefined
- Unit requests empty

**Cause:** API response doesn't match expected structure

**Debug:**

```typescript
// In loader function
loader: async ({ params }) => {
  const response = await fetch(`/api/guest-booking/${params.bookingReference}`);
  const data = await response.json();

  console.log("API Response:", data); // Debug full response

  // Verify structure matches
  if (!data.booking) {
    console.error("Missing booking object");
  }

  if (!data.booking.unit_requests) {
    console.error("Missing unit_requests array");
  }

  return data.booking;
};
```

**Solution:**

Ensure API response matches this structure:

```typescript
{
  success: true,
  booking: {
    booking_id: string,
    booking_reference: string,
    guest_name: string,
    email: string,
    phone_number: string,
    check_in: string,
    check_out: string,
    unit_requests: [{
      guests_per_unit: number
    }],
    total_amount: number,
    downpayment_amount: number,
    pricing_breakdown: {
      base_total: number,
      // ...
    }
  }
}
```

---

## Copy-to-Clipboard Issues

### Issue: Copy button does nothing

**Symptom:**

- Click "Copy to Clipboard"
- No feedback shown
- Nothing copied

**Cause 1:** HTTPS requirement not met

**Solution:**

```typescript
// Check if Clipboard API available
if (!navigator.clipboard) {
  console.warn("Clipboard API not available - likely HTTP");
  // Should fall back to execCommand
}

// Development workaround
// Option 1: Use localhost (Clipboard API works)
// http://localhost:5173 ✅

// Option 2: Use HTTPS in dev
// https://localhost:5173 (requires cert setup)
```

**Cause 2:** Fallback not implemented

**Solution:**

Verify copy utility has fallback:

```typescript
// In copy-to-clipboard.ts
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Falls through to legacy method
    }
  }

  // MUST have legacy fallback
  return legacyCopyToClipboard(text);
}
```

---

### Issue: Copy succeeds but feedback doesn't show

**Symptom:**

- Copy works (can paste)
- Button doesn't change to "Copied!"
- No visual feedback

**Cause:** State not updating

**Solution:**

```typescript
// In BookingReferenceDisplay.tsx
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  const success = await copyToClipboard(reference);

  if (success) {
    setCopied(true); // ← Must set state
    setTimeout(() => setCopied(false), 2000); // Reset
  }
};

// Button should change based on state
{copied ? (
  <>
    <Check className="h-4 w-4" />
    Copied!
  </>
) : (
  <>
    <Copy className="h-4 w-4" />
    Copy to Clipboard
  </>
)}
```

---

## Print Functionality Issues

### Issue: Print layout broken or empty

**Symptom:**

- Click print button
- Print preview blank or layout messy
- Missing content in print view

**Cause:** Print stylesheet not loaded

**Solution:**

```typescript
// Verify import in main.tsx or index.tsx
import "./styles/print.css";

// Check file exists
ls -la src/styles/print.css

// If missing, create it (see instructions.md Step 8)
```

**Verify in browser:**

```javascript
// In DevTools console
const sheets = Array.from(document.styleSheets);
const printSheet = sheets.find((s) => s.href?.includes("print.css"));
console.log(printSheet); // Should not be undefined
```

---

### Issue: Interactive elements visible in print

**Symptom:**

- Print shows buttons, navigation
- "Print Confirmation" button appears in print
- Not optimized for paper

**Cause:** `@media print` styles not applied

**Solution:**

**Check print.css contains:**

```css
@media print {
  button,
  nav,
  footer,
  .no-print {
    display: none !important;
  }
}
```

**Add `.no-print` class to elements:**

```tsx
<Alert className="no-print">
  {/* This won't appear in print */}
</Alert>

<Button className="no-print">
  {/* This won't appear in print */}
</Button>
```

---

### Issue: Booking reference not prominent in print

**Symptom:**

- Reference too small in print
- Hard to read on paper

**Cause:** Print-specific styles not targeting reference

**Solution:**

**Add to print.css:**

```css
@media print {
  .booking-reference {
    border: 2px solid black !important;
    padding: 1rem !important;
    margin: 1rem 0 !important;
    page-break-inside: avoid !important;
  }

  .booking-reference p {
    font-size: 24pt !important;
    font-weight: bold !important;
  }
}
```

**Add class to component:**

```tsx
<Card className="booking-reference border-primary bg-primary/5">
  {/* Booking reference content */}
</Card>
```

---

## Styling and Layout Issues

### Issue: Booking reference not large enough

**Symptom:**

- Reference visible but not prominent
- Doesn't stand out visually

**Solution:**

**Increase font size:**

```tsx
<p className="font-mono text-4xl font-bold tracking-wider md:text-5xl lg:text-6xl">{reference}</p>
```

**Adjust responsive sizes:**

- Mobile (default): `text-4xl` (36px)
- Tablet (md): `text-5xl` (48px)
- Desktop (lg): `text-6xl` (60px)

---

### Issue: Payment instructions overflow on mobile

**Symptom:**

- Account numbers wrap awkwardly
- Layout broken on small screens

**Solution:**

**Use responsive grid:**

```tsx
<div className="grid gap-4 sm:grid-cols-2">{/* Bank details */}</div>
```

**Use `font-mono` for numbers:**

```tsx
<span className="font-mono font-medium break-all">1234-5678-9012-3456</span>
```

**Allow break on long numbers:**

```tsx
<span className="break-all">{accountNumber}</span>
```

---

## Component Rendering Issues

### Issue: Status timeline steps not showing correct states

**Symptom:**

- All steps show same color
- Current step not highlighted
- Completed step doesn't show checkmark

**Cause:** Status logic incorrect

**Solution:**

**Verify step status assignment:**

```typescript
const steps: TimelineStep[] = [
  {
    label: "Booking Submitted",
    status: "completed", // ✅ Always completed
    // ...
  },
  {
    label: "Payment Verification",
    status: "current", // ⏳ Current step
    // ...
  },
  {
    label: "Unit Assignment",
    status: "pending", // ⬜ Future step
    // ...
  },
];
```

**Check conditional styling:**

```typescript
className={cn(
  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
  {
    "bg-primary text-primary-foreground": step.status === "completed",
    "border-primary border-2 text-primary": step.status === "current",
    "bg-muted text-muted-foreground": step.status === "pending",
  }
)}
```

---

## TypeScript Errors

### Issue: Type error on booking data

**Symptom:**

```
Error: Property 'pricing_breakdown' does not exist on type 'unknown'
```

**Cause:** Loader data not typed

**Solution:**

```typescript
// Define booking type
interface BookingConfirmationData {
  booking_id: string;
  booking_reference: string;
  // ... all fields
  pricing_breakdown: {
    base_total: number;
    // ...
  };
}

// Type loader return
export const Route = createFileRoute("/booking-confirmation/$bookingReference")({
  loader: async ({ params }): Promise<BookingConfirmationData> => {
    const response = await fetch(`/api/guest-booking/${params.bookingReference}`);
    const data = await response.json();
    return data.booking as BookingConfirmationData;
  },
});

// Component now has types
function BookingConfirmationPage() {
  const booking = Route.useLoaderData(); // Type inferred!
  // booking.pricing_breakdown.base_total ✅
}
```

---

### Issue: useLoaderData() not recognized

**Symptom:**

```
Error: Property 'useLoaderData' does not exist on type 'typeof Route'
```

**Cause:** TanStack Router version mismatch

**Solution:**

```bash
# Check TanStack Router version
npm ls @tanstack/react-router

# Should be v1.x.x

# If outdated, update
npm install @tanstack/react-router@latest

# Regenerate route tree
npx tsr generate
```

---

## Performance Issues

### Issue: Page loads slowly

**Symptom:**

- Confirmation page takes 5+ seconds to load
- Loading spinner visible for long time

**Cause:** API request slow or multiple requests

**Debug:**

```typescript
loader: async ({ params }) => {
  console.time("Fetch booking");

  const response = await fetch(`/api/guest-booking/${params.bookingReference}`);

  console.timeEnd("Fetch booking");
  // Should be <1 second

  const data = await response.json();
  return data.booking;
};
```

**Common causes:**

1. **Database query slow** - Add indexes (Chunk 001)
2. **API cold start** - Cloudflare Workers warm-up delay
3. **Network latency** - Test local vs production

**Solution:**

**Add loading timeout:**

```typescript
loader: async ({ params }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`/api/guest-booking/${params.bookingReference}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    // ...
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timeout - please try again");
    }
    throw error;
  }
};
```

---

## Still Stuck?

### Debugging Steps

**1. Enable verbose logging:**

```typescript
// In confirmation page
console.log("Route params:", Route.useParams());
console.log("Loader data:", Route.useLoaderData());
console.log("Booking reference:", booking?.booking_reference);
```

**2. Check browser console:**

- Open DevTools → Console
- Look for errors or warnings
- Check Network tab for failed requests

**3. Verify API endpoint:**

```bash
# Test API directly
curl http://localhost:8788/api/guest-booking/BK-2025-001234

# Should return booking data
```

**4. Check form submission (Chunk 009):**

- Ensure form redirects correctly
- Verify booking reference generated
- Check API creates booking in database

### Getting Help

If issue persists after trying solutions:

**Create minimal reproduction:**

1. Isolate problematic component
2. Create minimal test case
3. Include error messages
4. Note browser/environment

**Check related chunks:**

- **Chunk 009**: Form submission and redirect
- **Chunk 004**: API endpoints
- **Chunk 001**: Database schema

**Review documentation:**

- TanStack Router docs: https://tanstack.com/router
- React printing guides
- Clipboard API MDN docs

### Escalation Path

1. **Re-read documentation** (CHUNKING-STRATEGY.md, README.md)
2. **Check previous chunks** (009, 004) for missing prerequisites
3. **Search GitHub issues** in project repo
4. **Ask team/community** with detailed error description
5. **Rollback and retry** if fundamentally broken

---

## Prevention Tips

**Future implementations:**

1. **Test each component independently** before integration
2. **Verify API responses** match expected types
3. **Use TypeScript strictly** for type safety
4. **Test print layout early** (don't wait until end)
5. **Check mobile responsiveness** during development
6. **Test copy function** in different browsers

---

**Remember:** Most issues are simple configuration or import problems. Check the basics first (file names, imports, types) before diving into complex debugging.
