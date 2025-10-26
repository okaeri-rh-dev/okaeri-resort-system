# Checkpoint: Form Validation and Submission Verification

## Purpose

This checkpoint ensures your multi-step booking form implementation is complete, secure, and functional. Complete all automated and manual checks before proceeding to Chunk 010.

---

## Automated Checks

Run these commands to verify your implementation meets technical requirements.

### 1. TypeScript Compilation

```bash
# Check for TypeScript errors
npm run type-check

# Expected output:
# ✓ No errors found
```

**What this verifies:**

- All components have correct TypeScript types
- Form schema types are properly inferred
- No type mismatches in form handling

**If this fails:** See troubleshooting section "TypeScript Errors"

---

### 2. ESLint Code Quality

```bash
# Run linter
npm run lint

# Expected output:
# ✓ No linting errors
```

**What this verifies:**

- Code follows project style guidelines
- No unused variables or imports
- React hooks rules followed
- Accessibility attributes present

**Auto-fix minor issues:**

```bash
npm run lint:fix
```

---

### 3. Unit Tests

```bash
# Run all form-related tests
npx vitest run src/lib/validation/
npx vitest run src/lib/security/
npx vitest run src/components/guest-booking/__tests__/

# Expected output:
# ✓ All tests pass
# Test Files: 3 passed (3)
# Tests: 10+ passed (10+)
```

**What this verifies:**

- Zod schema validates correctly
- DOMPurify sanitizes input
- Form navigation works
- Validation errors display

**If tests fail:** See troubleshooting section "Test Failures"

---

### 4. Build Verification

```bash
# Build for production
npm run build

# Expected output:
# ✓ Build completed successfully
# No errors or warnings
```

**What this verifies:**

- All components bundle correctly
- No circular dependencies
- Tree-shaking works
- Production build succeeds

---

### 5. File Structure Verification

```bash
# Verify all files created
ls -la src/lib/validation/booking-schema.ts
ls -la src/lib/security/sanitize.ts
ls -la src/components/guest-booking/MultiUnitGuestBookingForm.tsx
ls -la src/components/guest-booking/FormStepIndicator.tsx
ls -la src/components/guest-booking/BookingReviewStep.tsx

# Expected: All files exist
```

**What this verifies:**

- All required files created
- Correct directory structure
- No missing components

---

## Manual Checks

Perform these manual verification steps in your browser.

### 1. Development Server Test

```bash
# Start development server
npm run dev

# Navigate to: http://localhost:5173/guest-booking
```

**Visual checks:**

- [ ] Page loads without errors
- [ ] Step indicator displays all 5 steps
- [ ] Current step (1) is highlighted
- [ ] Form fields are visible and styled correctly

---

### 2. Step Navigation Verification

**Test forward navigation:**

**Step 1 → 2:**

- [ ] Fill check-in date: March 1, 2025, 2:00 PM
- [ ] Fill check-out date: March 8, 2025, 10:00 AM
- [ ] Click "Next" button
- [ ] Should navigate to Step 2 (Unit Selection)
- [ ] Step 1 marked complete (checkmark icon)

**Step 2 → 3:**

- [ ] Unit selector displays with 1 unit card
- [ ] Can add second unit (click "Add Another Unit")
- [ ] Can remove unit (X button)
- [ ] Guest count adjustable per unit
- [ ] Click "Next" button
- [ ] Should navigate to Step 3 (Contact Information)

**Step 3 → 4:**

- [ ] Fill name: "Test Guest"
- [ ] Fill email: "test@example.com"
- [ ] Fill phone: "+63 917 123 4567" or "0917 123 4567"
- [ ] Optional: Fill special requests
- [ ] Click "Next" button
- [ ] Should navigate to Step 4 (Payment Proof)

**Step 4 → 5:**

- [ ] Payment upload component displays
- [ ] Click "Next" button (upload optional)
- [ ] Should navigate to Step 5 (Review)

**Test backward navigation:**

- [ ] Click "Back" button from Step 5
- [ ] Should return to Step 4
- [ ] Click Step 2 in progress indicator
- [ ] Should jump to Step 2
- [ ] Form data preserved (units still there)

---

### 3. Validation Testing

**Date validation:**

- [ ] Try setting check-out before check-in → Error displayed
- [ ] Try setting check-in in the past → Error displayed
- [ ] Valid dates → No error

**Unit validation:**

- [ ] Try 0 guests per unit → Error displayed
- [ ] Try 21 guests per unit → Error displayed
- [ ] Try adding 11 units → Maximum limit enforced
- [ ] Valid guest counts (1-20) → No error

**Contact validation:**

- [ ] Leave name empty → "Guest name is required" error
- [ ] Enter 1-character name → "At least 2 characters" error
- [ ] Enter invalid email ("test@") → "Invalid email format" error
- [ ] Enter invalid phone ("123") → "Invalid Philippine phone number" error
- [ ] Valid inputs → No errors

**Terms validation:**

- [ ] Try submitting without accepting terms → Cannot submit
- [ ] Accept terms → Submit button enabled (if Turnstile complete)

---

### 4. Security Verification

**Input sanitization:**

Open browser DevTools Network tab, then:

1. Navigate to Step 3 (Contact)
2. Enter name: `John <script>alert('xss')</script> Doe`
3. Enter special requests: `<b>Bold</b> text <script>evil()</script>`
4. Complete all steps and submit
5. Check Network tab → POST request payload

**Expected payload:**

```json
{
  "guest_name": "John  Doe", // Scripts removed
  "special_requests": "Bold text ", // HTML tags removed
  "email": "test@example.com",
  "phone_number": "+639171234567"
}
```

**Verify:**

- [ ] `<script>` tags removed from name
- [ ] HTML tags removed from special requests
- [ ] No XSS vulnerabilities

**Turnstile verification:**

- [ ] Turnstile widget loads in Step 5
- [ ] Widget displays security challenge
- [ ] After completing: "✓ Verification complete" message
- [ ] Submit button disabled without Turnstile token
- [ ] Submit button enabled with valid token

**Idempotency key:**

Check Network tab payload:

- [ ] `idempotency_key` field present
- [ ] Value is a valid UUID
- [ ] Same UUID for all submission attempts

---

### 5. Form Submission Test

**Happy path (successful booking):**

1. Complete all 5 steps with valid data
2. Accept terms checkbox
3. Complete Turnstile verification
4. Click "Submit Booking" button

**Expected behavior:**

- [ ] Button shows loading state: "Creating Booking..."
- [ ] Button disabled during submission
- [ ] No console errors
- [ ] Redirects to confirmation page after success
- [ ] OR displays clear error message if API fails

**Test API endpoint:**

```bash
# Verify API responds correctly
curl -X POST http://localhost:8788/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+639171234567",
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T10:00:00Z",
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true,
    "idempotency_key": "test-uuid-123"
  }'

# Expected: 200 OK with booking response
```

**Verify API response:**

- [ ] `success: true`
- [ ] `booking.booking_reference` present
- [ ] `booking.total_amount` calculated
- [ ] `unit_requests` array returned

---

### 6. Error Handling Test

**Network error simulation:**

1. Start form submission
2. Before it completes, disable network in DevTools (Offline mode)
3. Click Submit

**Expected behavior:**

- [ ] Error message displayed: "Network error. Please try again."
- [ ] Form data preserved (not lost)
- [ ] Can retry submission
- [ ] Submit button re-enabled

**Validation error:**

1. Fill form with invalid data
2. Try to advance to next step

**Expected behavior:**

- [ ] Inline error messages below fields
- [ ] Field borders turn red
- [ ] Cannot advance until valid
- [ ] Clear error messaging

---

### 7. Accessibility Check

**Keyboard navigation:**

- [ ] Can tab through all form fields
- [ ] Can navigate with Enter/Space keys
- [ ] Focus visible on all interactive elements
- [ ] Step indicator buttons keyboard-accessible

**Screen reader test:**

Using browser screen reader or accessibility tools:

- [ ] Form labels read correctly
- [ ] Error messages announced
- [ ] Step indicator reads current step
- [ ] Submit button state announced

**ARIA attributes:**

- [ ] `aria-current="step"` on current step
- [ ] `aria-describedby` on fields with errors
- [ ] `aria-label` on icon buttons
- [ ] Form has proper heading hierarchy

---

### 8. Mobile Responsiveness

**Test on mobile viewport (375px width):**

1. Open DevTools → Device Mode
2. Select "iPhone SE" or similar
3. Navigate through all form steps

**Verify:**

- [ ] Steps display vertically (not horizontally)
- [ ] Form fields full width
- [ ] Touch targets large enough (min 44px)
- [ ] Text readable without zoom
- [ ] Navigation buttons accessible
- [ ] Turnstile widget fits viewport

---

## Success Criteria

Mark each criterion as complete:

### Core Functionality

- [ ] All 5 steps render correctly
- [ ] Step navigation works (forward/backward)
- [ ] Can jump to completed steps via indicator
- [ ] Form state persists across steps
- [ ] Unit requests array-based (no quantity field)
- [ ] Payment proof upload optional
- [ ] Terms acceptance required

### Validation

- [ ] Zod schema validates all fields
- [ ] Date validation enforces future dates
- [ ] Check-out after check-in enforced
- [ ] Guest count limits enforced (1-20 per unit)
- [ ] Maximum 10 units enforced
- [ ] Philippine phone format validated
- [ ] Email format validated
- [ ] Name length validated (2-100 chars)

### Security

- [ ] DOMPurify sanitizes all text inputs
- [ ] HTML tags stripped from name
- [ ] Scripts stripped from special requests
- [ ] Turnstile token required for submission
- [ ] Idempotency key included in payload
- [ ] No XSS vulnerabilities detected

### Error Handling

- [ ] Field-level errors display correctly
- [ ] Cannot advance with invalid data
- [ ] Network errors handled gracefully
- [ ] API errors display user-friendly messages
- [ ] Form data preserved on error

### User Experience

- [ ] Loading state during submission
- [ ] Clear progress indication
- [ ] Responsive on mobile
- [ ] Keyboard accessible
- [ ] Screen reader compatible
- [ ] Error messages clear and actionable

### Integration

- [ ] Integrates with UnitRequestSelector (Chunk 006)
- [ ] Integrates with PaymentSummary (Chunk 007)
- [ ] Integrates with PaymentProofUpload (Chunk 008)
- [ ] Calls POST `/api/guest-booking` (Chunk 004)
- [ ] Redirects to confirmation page on success

### Code Quality

- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] All tests pass
- [ ] Production build succeeds
- [ ] No console errors or warnings

---

## Status Tracking

| Check Category         | Status                             | Time Taken | Issues Found | Notes |
| ---------------------- | ---------------------------------- | ---------- | ------------ | ----- |
| TypeScript Compilation | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| ESLint                 | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Unit Tests             | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Build Verification     | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Step Navigation        | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Validation             | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Security               | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Form Submission        | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Error Handling         | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Accessibility          | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |
| Mobile Responsive      | ⬜ Pass / ❌ Fail / 🔄 In Progress | \_\_\_ min | \_\_\_       |       |

**Total Time:** \_\_\_ minutes

---

## If Any Check Fails

**DO NOT PROCEED** to Chunk 010 until all checks pass. Refer to `troubleshooting.md` for specific solutions.

### Common Failure Points

1. **TypeScript errors in form component**
   → See troubleshooting section "TypeScript Errors"

2. **Validation not triggering on step advance**
   → Check `STEP_FIELDS` mapping in schema
   → Verify `form.trigger()` called correctly

3. **Turnstile widget not loading**
   → Check `VITE_TURNSTILE_SITE_KEY` environment variable
   → Verify internet connection (widget loads from CDN)

4. **Form submission fails**
   → Check API endpoint is running
   → Verify request payload structure
   → Check for CORS errors

5. **Sanitization not working**
   → Verify DOMPurify imported correctly
   → Check `sanitizeBookingData()` called before submission

---

## When All Checks Pass

### Celebrate! 🎉

You've successfully implemented a production-ready multi-step booking form with:

- ✅ Comprehensive validation
- ✅ Security hardening (XSS prevention, CAPTCHA)
- ✅ Excellent user experience
- ✅ Error handling
- ✅ Accessibility

### Commit Your Changes

```bash
# Stage all changes
git add src/lib/validation/
git add src/lib/security/
git add src/components/guest-booking/
git add src/routes/guest-booking.tsx

# Commit with descriptive message
git commit -m "feat: complete chunk 009 - form validation and submission

- Implement Zod validation schema for multi-unit bookings
- Add DOMPurify sanitization for XSS prevention
- Create multi-step wizard (5 steps: dates, units, contact, payment, review)
- Integrate Cloudflare Turnstile for bot prevention
- Add idempotency protection with client-generated UUIDs
- Implement comprehensive error handling
- Add form state management with React Hook Form
- Create FormStepIndicator and BookingReviewStep components
- Add unit tests for validation and sanitization
- Ensure mobile responsiveness and accessibility

Dependencies: Chunks 004, 006, 007, 008
Next: Chunk 010 - Booking Confirmation Flow

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Tag the commit
git tag chunk-009

# Push changes
git push origin main --tags
```

### Update Progress Tracker

Mark Chunk 009 as complete in your project tracker:

```
Phase 2: Guest Booking Flow
├── 006: Date and Unit Selection UI ✅
├── 007: Payment Summary with Preview ✅
├── 008: Payment Proof Upload ✅
├── 009: Form Validation and Submission ✅ (COMPLETED)
└── 010: Booking Confirmation Flow (NEXT)
```

### Next Steps

Proceed to **Chunk 010: Booking Confirmation Flow**

**What Chunk 010 will build:**

- Confirmation page with booking reference
- Payment instructions display
- Unit request summary
- Print/download confirmation option
- Manual contact workflow documentation

**Estimated time:** 60 minutes

---

## Verification Log

**Completed by:** ******\_\_\_******
**Date:** ******\_\_\_******
**Total time:** **_ hours _** minutes
**Issues encountered:** ******\_\_\_******
**Resolution notes:** ******\_\_\_******

**Reviewer (if applicable):** ******\_\_\_******
**Review date:** ******\_\_\_******
**Approved:** ⬜ Yes / ❌ No

---

**Chunk 009 Status:** ⬜ **VERIFIED AND COMPLETE**

Proceed to Chunk 010 when all checks pass and commit is pushed.
