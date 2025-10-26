# Troubleshooting: Form Validation and Submission

## Common Issues and Solutions

This guide addresses common problems encountered during Chunk 009 implementation. Issues are organized by symptom with step-by-step solutions.

---

## TypeScript Errors

### Issue: "Type 'string' is not assignable to type 'UnitRequest'"

**Symptom:**

```
Error: Type 'string' is not assignable to type 'UnitRequest'
File: MultiUnitGuestBookingForm.tsx
```

**Cause:** Form default values don't match schema type

**Solution:**

```typescript
// ❌ Wrong
defaultValues: {
  unit_requests: ["invalid"], // Wrong type
}

// ✅ Correct
defaultValues: {
  unit_requests: [{ guests_per_unit: 2 }], // Correct array-based format
}
```

**Verification:**

```bash
npm run type-check
# Should pass without errors
```

---

### Issue: "Property 'guests_per_unit' does not exist on type 'never'"

**Symptom:**

```
Error: Property 'guests_per_unit' does not exist on type 'never'
File: BookingReviewStep.tsx
```

**Cause:** TypeScript can't infer array type when mapping

**Solution:**

```typescript
// ❌ Wrong
{formData.unit_requests.map((req, index) => (
  <div>{req.guests_per_unit}</div> // Type error
))}

// ✅ Correct
{formData.unit_requests && formData.unit_requests.length > 0 &&
  formData.unit_requests.map((req, index) => (
    <div>{req.guests_per_unit}</div> // Type inferred correctly
  ))
}
```

**Alternative solution (type assertion):**

```typescript
{(formData.unit_requests || []).map((req: UnitRequest, index: number) => (
  <div>{req.guests_per_unit}</div>
))}
```

---

### Issue: "Cannot find name 'STEP_FIELDS'"

**Symptom:**

```
Error: Cannot find name 'STEP_FIELDS'
File: MultiUnitGuestBookingForm.tsx
```

**Cause:** Not imported from schema file

**Solution:**

```typescript
// Add to imports
import {
  multiUnitBookingSchema,
  STEP_FIELDS, // ← Add this
  type MultiUnitBookingRequest,
} from "@/lib/validation/booking-schema";
```

**Verification:**
Check that `STEP_FIELDS` is exported in `booking-schema.ts`:

```typescript
export const STEP_FIELDS = {
  1: ["check_in", "check_out"],
  // ... rest of mapping
} as const;
```

---

## Validation Issues

### Issue: Validation not triggering on step advance

**Symptom:**

- Click "Next" button
- No validation errors shown
- Advances to next step with empty fields

**Cause:** `form.trigger()` not awaited or wrong field names

**Solution 1:** Ensure async/await

```typescript
// ❌ Wrong
const handleNext = () => {
  form.trigger(fields); // Not awaited
  setCurrentStep((prev) => prev + 1);
};

// ✅ Correct
const handleNext = async () => {
  const isValid = await form.trigger(fields);
  if (isValid) {
    setCurrentStep((prev) => prev + 1);
  }
};
```

**Solution 2:** Verify field names match schema

```typescript
// Check STEP_FIELDS mapping
export const STEP_FIELDS = {
  1: ["check_in", "check_out"], // Must match schema field names exactly
  2: ["unit_requests"],
  // ...
};
```

**Debug validation:**

```typescript
const validateStep = async (step: number) => {
  const fields = STEP_FIELDS[step as keyof typeof STEP_FIELDS];
  console.log("Validating fields:", fields); // Debug output

  const result = await form.trigger(fields as any);
  console.log("Validation result:", result); // Debug output
  console.log("Form errors:", form.formState.errors); // Show errors

  return result;
};
```

---

### Issue: Phone number validation always fails

**Symptom:**

- Enter valid Philippine number: "+63 917 123 4567"
- Error: "Invalid Philippine phone number format"

**Cause:** Regex pattern too strict or format mismatch

**Solution:** Test regex pattern

```typescript
// Test your phone number format
const testPhone = "+63 917 123 4567";
const regex = /^\+?63\s?[-.]?\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$|^0\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$/;

console.log(regex.test(testPhone)); // Should be true
```

**Valid formats:**

- `+639171234567` (no spaces)
- `+63 917 123 4567` (spaces)
- `+63-917-123-4567` (dashes)
- `09171234567` (local format)
- `0917 123 4567` (local with spaces)

**If still failing, update regex:**

```typescript
// More permissive regex
const philippinePhoneRegex = /^(\+?63|0)\s?[-.]?\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$/;
```

---

### Issue: Date validation error "Check-in must be in the future" even for future dates

**Symptom:**

- Select tomorrow's date
- Error: "Check-in date must be today or in the future"

**Cause:** Time zone comparison issue

**Solution:**

```typescript
// ❌ Wrong (compares with current time)
.refine((date) => new Date(date) > new Date(), {
  message: "Check-in date must be in the future",
})

// ✅ Correct (compares dates only, ignores time)
.refine((date) => {
  const checkIn = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to midnight
  checkIn.setHours(0, 0, 0, 0); // Reset to midnight
  return checkIn >= now;
}, {
  message: "Check-in date must be today or in the future",
})
```

---

## Turnstile Issues

### Issue: Turnstile widget not loading

**Symptom:**

- Review step shows empty space where Turnstile should be
- Console error: "Failed to load Turnstile script"

**Cause 1:** Missing or invalid site key

**Solution:**

```bash
# Check environment variable
echo $VITE_TURNSTILE_SITE_KEY

# Should output your Turnstile site key
# If empty, add to .env.local:
VITE_TURNSTILE_SITE_KEY=your_actual_site_key_here
```

**Restart dev server after adding:**

```bash
# Stop server (Ctrl+C)
npm run dev
```

**Cause 2:** Network blocking Cloudflare CDN

**Solution:**

1. Check browser DevTools Console for network errors
2. Verify CDN not blocked by firewall/extensions
3. Disable ad blockers (they may block Turnstile)
4. Try in incognito mode

**Cause 3:** Import error

**Solution:**

```typescript
// Verify correct import
import { Turnstile } from "@marsidev/react-turnstile";

// Check package installed
npm ls @marsidev/react-turnstile
// Should show version number

// If not installed:
npm install @marsidev/react-turnstile
```

---

### Issue: Turnstile error "Invalid site key"

**Symptom:**

- Turnstile widget displays error message
- Console: "Invalid site key"

**Cause:** Wrong site key or development/production mismatch

**Solution:**

**Development (local testing):**
Use Cloudflare test site key for development:

```env
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

**Production:**
Use real site key from Cloudflare dashboard:

```env
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA... (your real key)
```

**Get a site key:**

1. Go to https://dash.cloudflare.com
2. Select your account
3. Navigate to "Turnstile"
4. Create new site
5. Copy site key

---

### Issue: Submit button disabled even after completing Turnstile

**Symptom:**

- Complete Turnstile challenge
- Submit button still disabled
- No token in state

**Cause:** `onSuccess` handler not setting token

**Debug:**

```typescript
<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onSuccess={(token) => {
    console.log("Turnstile token received:", token); // Debug
    setTurnstileToken(token);
  }}
  onError={(error) => {
    console.error("Turnstile error:", error); // Debug
  }}
/>
```

**Solution:**

```typescript
// Ensure state update function is correct
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

// Pass setter directly
<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onSuccess={setTurnstileToken} // ← Correct
/>
```

---

## Form Submission Issues

### Issue: Form submission fails with 400 Bad Request

**Symptom:**

- Fill form correctly
- Click Submit
- Error: "Booking failed"
- Network tab shows 400 status

**Cause:** Request payload doesn't match API schema

**Debug:**

1. Open DevTools Network tab
2. Find POST request to `/api/guest-booking`
3. Check Request Payload
4. Compare to expected format

**Expected payload:**

```json
{
  "guest_name": "John Doe",
  "email": "john@example.com",
  "phone_number": "+639171234567",
  "check_in": "2025-03-01T14:00:00Z",
  "check_out": "2025-03-08T10:00:00Z",
  "unit_requests": [{ "guests_per_unit": 2 }, { "guests_per_unit": 3 }],
  "special_requests": "Ground floor please",
  "payment_proof_url": null,
  "turnstile_token": "...",
  "terms_accepted": true,
  "idempotency_key": "..."
}
```

**Common payload errors:**

**Error 1:** Dates in wrong format

```typescript
// ❌ Wrong
check_in: "2025-03-01"; // Date only

// ✅ Correct
check_in: "2025-03-01T14:00:00Z"; // ISO 8601 with time
```

**Error 2:** Unit requests wrong structure

```typescript
// ❌ Wrong
unit_requests: [
  { quantity: 2, guests: 3 }, // Wrong keys
];

// ✅ Correct
unit_requests: [{ guests_per_unit: 3 }];
```

---

### Issue: API returns 500 Internal Server Error

**Symptom:**

- Form submission fails
- Network tab shows 500 status
- Console error: "Internal server error"

**Cause:** Server-side error (likely Chunk 004 issue)

**Solution:**

**Check API logs:**

```bash
# If using Cloudflare Workers
wrangler tail

# Look for error messages in logs
```

**Test API directly:**

```bash
curl -X POST http://localhost:8788/api/guest-booking \
  -H "Content-Type: application/json" \
  -d @test-booking.json

# If this fails, issue is in Chunk 004 (API)
```

**Common API issues:**

1. Database connection failed → Check Supabase credentials
2. Pricing function error → Verify Chunk 002 implementation
3. Idempotency check failed → Check Chunk 005 implementation

**Escalate to Chunk 004 troubleshooting if API is the issue.**

---

## Sanitization Issues

### Issue: Sanitization not removing HTML tags

**Symptom:**

- Enter `<b>Bold</b> text` in special requests
- Network payload shows: `"special_requests": "<b>Bold</b> text"`
- HTML not stripped

**Cause:** Sanitization not called before submission

**Solution:**

```typescript
const onSubmit = async (data: MultiUnitBookingRequest) => {
  // Ensure sanitization happens
  const sanitized = sanitizeBookingData(data);

  console.log("Before sanitization:", data.special_requests);
  console.log("After sanitization:", sanitized.special_requests);

  // Use sanitized data
  const payload = {
    ...sanitized,
    turnstile_token: turnstileToken,
  };

  // Submit payload
  await fetch("/api/guest-booking", {
    body: JSON.stringify(payload),
  });
};
```

**Verify sanitization function:**

```typescript
// Test sanitizeInput directly
import { sanitizeInput } from "@/lib/security/sanitize";

console.log(sanitizeInput("<b>Bold</b> text"));
// Should output: "Bold text"
```

---

### Issue: DOMPurify is undefined

**Symptom:**

```
Error: DOMPurify is not defined
File: sanitize.ts
```

**Cause:** Package not installed or import error

**Solution:**

```bash
# Install DOMPurify
npm install dompurify

# Install TypeScript types
npm install --save-dev @types/dompurify

# Verify installation
npm ls dompurify
```

**Check import:**

```typescript
// ✅ Correct import
// Not this:
import DOMPurify, { DOMPurify } from "dompurify";

// ❌ Wrong
```

---

## Step Navigation Issues

### Issue: Cannot go back to previous steps

**Symptom:**

- Click "Back" button
- Nothing happens
- Still on current step

**Cause:** `handleBack` function not decrementing state correctly

**Solution:**

```typescript
// Check implementation
const handleBack = () => {
  if (currentStep > 1) {
    setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

// Debug
const handleBack = () => {
  console.log("Current step before:", currentStep);
  if (currentStep > 1) {
    const newStep = (currentStep - 1) as 1 | 2 | 3 | 4 | 5;
    console.log("Setting step to:", newStep);
    setCurrentStep(newStep);
  }
};
```

**Common mistake:**

```typescript
// ❌ Wrong (missing type assertion)
setCurrentStep(currentStep - 1); // Type error

// ✅ Correct
setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
```

---

### Issue: Clicking step indicator doesn't navigate

**Symptom:**

- Click step 2 in indicator
- Nothing happens
- Still on current step

**Cause:** `onStepClick` not passed or not implemented

**Solution:**

```typescript
<FormStepIndicator
  steps={STEPS}
  currentStep={currentStep}
  completedSteps={completedSteps}
  onStepClick={handleStepClick} // ← Must be passed
/>
```

**Verify `handleStepClick` implementation:**

```typescript
const handleStepClick = async (stepNumber: number) => {
  // Allow navigation to previous steps only
  if (stepNumber < currentStep || completedSteps.has(stepNumber)) {
    setCurrentStep(stepNumber as 1 | 2 | 3 | 4 | 5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
```

---

## UI/UX Issues

### Issue: Form fields not showing validation errors

**Symptom:**

- Enter invalid data
- No error message displayed
- Red border not appearing

**Cause:** `<FormMessage />` component missing

**Solution:**

```typescript
<FormField
  control={form.control}
  name="guest_name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Full Name</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* ← Must be included */}
    </FormItem>
  )}
/>
```

**Verify shadcn/ui form components installed:**

```bash
npm ls @radix-ui/react-label @radix-ui/react-slot
# Should show installed versions
```

---

### Issue: Payment summary not updating when dates change

**Symptom:**

- Change check-in/check-out dates
- Payment summary still shows old pricing
- Preview not recalculating

**Cause:** `PaymentSummary` not re-fetching when dates change

**Solution:**

**Verify props passed correctly:**

```typescript
<PaymentSummary
  unitRequests={watchedValues.unit_requests}
  checkIn={new Date(watchedValues.check_in)}  // ← Must be watched
  checkOut={new Date(watchedValues.check_out)} // ← Must be watched
/>
```

**Check `PaymentSummary` useEffect dependencies:**

```typescript
// In PaymentSummary component
useEffect(() => {
  fetchPricing();
}, [unitRequests, checkIn, checkOut]); // ← Dependencies must include all props
```

---

### Issue: Turnstile widget overlapping other content

**Symptom:**

- Turnstile widget renders
- Overlaps with submit button
- Z-index issues

**Cause:** CSS positioning conflict

**Solution:**

```typescript
// Wrap Turnstile in centered container
<div className="flex flex-col items-center justify-center space-y-4">
  <Turnstile
    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
    onSuccess={setTurnstileToken}
  />
</div>
```

**Add spacing in parent:**

```typescript
<CardContent className="py-6">
  {/* Turnstile wrapper */}
</CardContent>
```

---

## Build and Deployment Issues

### Issue: Build fails with "Cannot find module 'dompurify'"

**Symptom:**

```bash
npm run build
# Error: Cannot find module 'dompurify'
```

**Cause:** Dependency not in production dependencies

**Solution:**

```bash
# Install as production dependency (not dev)
npm install dompurify

# Verify
cat package.json | grep dompurify
# Should be in "dependencies", not "devDependencies"
```

---

### Issue: Environment variables not available in build

**Symptom:**

- Production build succeeds
- Deployed app shows "Invalid site key"
- `import.meta.env.VITE_TURNSTILE_SITE_KEY` is undefined

**Cause:** Environment variables not set in production

**Solution:**

**For Cloudflare Pages:**

1. Go to Pages dashboard
2. Select your project
3. Settings → Environment variables
4. Add: `VITE_TURNSTILE_SITE_KEY` = your production site key
5. Redeploy

**For Vercel:**

```bash
vercel env add VITE_TURNSTILE_SITE_KEY production
# Enter your production site key
vercel --prod
```

---

## Performance Issues

### Issue: Form submission very slow

**Symptom:**

- Click Submit
- Loading spinner shows for 10+ seconds
- Eventually succeeds

**Cause:** Likely API performance (Chunk 004) or network latency

**Debug:**

```typescript
const onSubmit = async (data: MultiUnitBookingRequest) => {
  console.time("Form submission");

  const startSanitize = Date.now();
  const sanitized = sanitizeBookingData(data);
  console.log("Sanitization time:", Date.now() - startSanitize, "ms");

  const startFetch = Date.now();
  const response = await fetch("/api/guest-booking", { ... });
  console.log("API call time:", Date.now() - startFetch, "ms");

  console.timeEnd("Form submission");
};
```

**Common causes:**

- API cold start (Cloudflare Workers)
- Database query slow (Chunk 002 pricing function)
- Large file upload (payment proof)

**Solutions:**

1. Optimize pricing function (Chunk 002)
2. Add request timeout
3. Show progress indicator with estimated time

---

## Still Stuck?

### Debugging Steps

**1. Enable verbose logging:**

```typescript
// Add to form component
useEffect(() => {
  console.log("Current step:", currentStep);
  console.log("Form values:", form.watch());
  console.log("Form errors:", form.formState.errors);
}, [currentStep, form]);
```

**2. Check browser console:**

- Open DevTools → Console
- Look for error messages
- Check for warnings

**3. Check network tab:**

- Open DevTools → Network
- Filter for Fetch/XHR
- Inspect request/response payloads

**4. Validate against source docs:**

- Re-read 03-frontend-components.md lines 760-1050
- Compare your implementation to examples
- Verify all props passed correctly

### Getting Help

If issue persists after trying solutions:

**Create minimal reproduction:**

1. Isolate the problematic component
2. Create CodeSandbox/StackBlitz reproduction
3. Include error messages and console logs

**Check related chunks:**

- **Chunk 004**: API endpoint issues
- **Chunk 006**: UnitRequestSelector issues
- **Chunk 007**: PaymentSummary issues
- **Chunk 008**: PaymentProofUpload issues

**Review architectural decisions:**

- See 09-implementation-decisions.md for rationale
- Verify you're following array-based model
- Check security requirements met

### Escalation Path

1. **Re-read documentation** (CHUNKING-STRATEGY.md, 03-frontend-components.md)
2. **Check previous chunks** (004, 006, 007, 008) for missing prerequisites
3. **Search GitHub issues** in project repo for similar problems
4. **Ask team/community** with detailed error description
5. **Rollback and retry** if implementation fundamentally broken

---

## Prevention Tips

**Future implementations:**

1. **Test early and often** - Don't wait until end to test
2. **Validate step-by-step** - Complete checkpoint after each major section
3. **Use TypeScript strictly** - Don't use `any` types
4. **Follow examples exactly** - Deviate only when necessary
5. **Keep dependencies updated** - Run `npm update` regularly
6. **Read error messages carefully** - They usually indicate the problem

---

**Remember:** Every error is an opportunity to learn the system better. If you encounter an issue not covered here, document your solution for future reference.
