# Chunk 007: Payment Summary with Preview - Checkpoint Verification

## Purpose

This checkpoint ensures your server-side pricing preview component is correctly implemented, tested, and displays accurate pricing from the PostgreSQL function.

**Success Criteria**: All automated checks pass AND all manual checks verified.

---

## Automated Checks

Run these commands to verify technical correctness.

### 1. TypeScript Compilation

**Command**:

```bash
npm run type-check
```

**Expected Output**:

```
✓ TypeScript compilation successful
No errors found
```

**If Fails**: See [Troubleshooting](#typescript-errors) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 2. Linting

**Command**:

```bash
npm run lint
```

**Expected Output**:

```
✓ ESLint passed
0 errors, 0 warnings
```

**Acceptable**: Minor warnings OK, but NO errors.

**If Fails**: See [Troubleshooting](#linting-errors) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 3. Unit Tests

**Command**:

```bash
npm run test:run src/components/guest-booking/__tests__/PaymentSummary.test.tsx
```

**Expected Output**:

```
✓ PaymentSummary.test.tsx (7 tests)

Test Files  1 passed (1)
     Tests  7 passed (7)
```

**If Fails**: See [Troubleshooting](#test-failures) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 4. Build for Production

**Command**:

```bash
npm run build
```

**Expected Output**:

```
✓ TypeScript compiled
✓ Vite build completed
dist/ directory created
```

**If Fails**: See [Troubleshooting](#build-failures) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

## Manual Checks

Perform these UI/UX verification steps in the browser.

### 1. Preview API Endpoint Responding

**How to Test**:

```bash
curl -X POST https://your-domain.com/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [{"guests_per_unit": 2}],
    "check_in": "2025-02-01T00:00:00Z",
    "check_out": "2025-02-08T00:00:00Z"
  }'
```

**Verify**:

- [ ] HTTP 200 response
- [ ] JSON body with `success: true`
- [ ] `pricing` object contains:
  - [ ] `nights` (number)
  - [ ] `total_units` (number)
  - [ ] `base_total` (number)
  - [ ] `total` (number)
  - [ ] `downpayment_required` (number)

**Expected Response Structure**:

```json
{
  "success": true,
  "pricing": {
    "nights": 7,
    "total_units": 1,
    "total_guests": 2,
    "base_total": 14000,
    "weekend_surcharge": 1000,
    "extra_person_fees": 0,
    "subtotal": 15000,
    "discount": { "percent": 5, "amount": 750, "rule_name": "7-Night Discount" },
    "total": 14250,
    "downpayment_required": 7125,
    "downpayment_percent": 50
  }
}
```

**If Fails**: See [Troubleshooting](#preview-endpoint-errors) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 2. PaymentSummary Component Renders

**How to Test**:

1. Start dev server: `npm run dev`
2. Navigate to guest booking page
3. Select dates (e.g., Feb 1 - Feb 8, 2025)
4. Add at least 1 unit
5. Observe PaymentSummary component below unit selector

**Verify**:

- [ ] Component loads without errors
- [ ] "Calculating Pricing..." skeleton appears briefly
- [ ] "Booking Summary" card displays
- [ ] Preview warning banner visible at top
- [ ] Stay details section shows: Units, Guests, Nights
- [ ] Pricing breakdown shows: Base Total, Weekend Surcharge (if applicable), Extra Person Fees (if applicable)
- [ ] Subtotal displayed
- [ ] Total displayed in large bold text
- [ ] Downpayment displayed with percentage

**If Fails**: See [Troubleshooting](#component-not-rendering) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 3. Pricing Updates on Form Changes

**How to Test**:

1. With booking form loaded and 1 unit selected
2. Add another unit (click "Add Another Unit")
3. Observe PaymentSummary component

**Verify**:

- [ ] "Calculating..." appears for ~500ms
- [ ] Pricing recalculates
- [ ] `total_units` increases from 1 to 2
- [ ] `base_total` doubles (approximately)
- [ ] `total` updates to reflect new units

**Next Test**:

1. Change guest count in Unit #1 from 2 to 5
2. Observe PaymentSummary

**Verify**:

- [ ] "Calculating..." appears again
- [ ] `total_guests` increases from 2 to 5
- [ ] `extra_person_fees` appears (3 extra guests × rate)
- [ ] `total` increases by extra person fees

**Next Test**:

1. Change check-out date to extend stay by 1 week
2. Observe PaymentSummary

**Verify**:

- [ ] "Calculating..." appears
- [ ] `nights` increases
- [ ] `base_total` increases (more nights)
- [ ] Discount MAY appear if stay now qualifies (e.g., 14-night discount)

**If Fails**: See [Troubleshooting](#pricing-not-updating) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 4. Debouncing Works Correctly

**How to Test**:

1. Open browser DevTools → Network tab
2. Filter by "preview-pricing"
3. Rapidly change guest count multiple times: 2 → 3 → 4 → 5 → 6
4. Observe network requests

**Verify**:

- [ ] Only 1 API call made (after 500ms of no changes)
- [ ] NOT 4 separate API calls for each change
- [ ] Final request has correct data (guests_per_unit: 6)

**If Fails**: See [Troubleshooting](#debouncing-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 5. Discount Display (When Applicable)

**How to Test**:

1. Select dates: Feb 1 - Feb 8 (7 nights)
2. Add 1 unit with 2 guests
3. Observe pricing breakdown

**Verify**:

- [ ] Discount section appears (if 7-night discount configured)
- [ ] Badge shows discount rule name (e.g., "7-Night Discount")
- [ ] Discount percentage displayed (e.g., "5%")
- [ ] Discount amount shown with minus sign (e.g., "-₱750")
- [ ] Total is less than Subtotal

**If No Discount Shows**:

- Verify discount rules exist in database:
  ```sql
  SELECT * FROM discount_rules WHERE is_active = true;
  ```
- If no rules, this is expected behavior (discount section hidden)

**Next Test**:

1. Change dates to Feb 1 - Feb 15 (14 nights)
2. Observe discount changes

**Verify**:

- [ ] Discount percentage increases (e.g., 5% → 10%)
- [ ] Badge updates to new rule (e.g., "14-Night Discount")
- [ ] Discount amount increases

**If Fails**: See [Troubleshooting](#discount-not-showing) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 6. Weekend Surcharge Calculation

**How to Test**:

1. Select dates that include Friday and/or Saturday nights
   - Example: Check-in Thursday Feb 6, Check-out Monday Feb 10 (4 nights, includes Fri + Sat)
2. Observe pricing breakdown

**Verify**:

- [ ] "Weekend Surcharge" line item appears
- [ ] Surcharge amount > 0
- [ ] Amount reflects weekend rate difference × weekend nights

**Test Scenario**:

- Base rate: ₱2,000/night
- Weekend rate: ₱2,500/night
- Difference: ₱500/night
- Weekend nights: 2 (Fri, Sat)
- Expected surcharge: ₱1,000

**If Fails**: See [Troubleshooting](#weekend-surcharge-incorrect) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 7. Extra Person Fees Display

**How to Test**:

1. Add 1 unit
2. Set guests_per_unit to value ABOVE base_occupancy
   - Example: If base_occupancy = 2, set guests to 5
3. Observe pricing breakdown

**Verify**:

- [ ] "Extra Person Fees" line item appears
- [ ] Fee amount > 0
- [ ] Calculation correct: (guests - base_occupancy) × extra_person_rate × nights

**Test Scenario**:

- Guests: 5
- Base occupancy: 2
- Extra persons: 3
- Extra person rate: ₱300/night
- Nights: 7
- Expected fees: 3 × ₱300 × 7 = ₱6,300

**If Fails**: See [Troubleshooting](#extra-person-fees-incorrect) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 8. Loading and Error States

**How to Test (Loading State)**:

1. Open DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Change form data (add unit)
4. Observe PaymentSummary

**Verify**:

- [ ] "Calculating Pricing..." header appears
- [ ] Skeleton loading animation visible
- [ ] Component responsive during loading
- [ ] Pricing appears after loading completes

**How to Test (Error State)**:

1. Open DevTools → Network tab
2. Block `/api/guest-booking/preview-pricing` request
3. Change form data
4. Observe PaymentSummary

**Verify**:

- [ ] Error alert appears after loading fails
- [ ] Error message clear: "Unable to calculate pricing"
- [ ] Form remains usable (doesn't crash)
- [ ] Retrying (change form again) works

**If Fails**: See [Troubleshooting](#loading-error-states) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 9. Preview Warning Banner

**How to Test**:

1. Load guest booking form with valid data
2. Scroll to PaymentSummary component
3. Observe top of component

**Verify**:

- [ ] Warning banner visible (yellow/amber background)
- [ ] Warning icon present
- [ ] Text includes: "Preview Only"
- [ ] Text explains: "Final pricing calculated by server at booking submission"
- [ ] Banner positioned above pricing card

**If Fails**: See [Troubleshooting](#preview-warning-missing) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 10. Responsive Design

**How to Test**:

1. Open DevTools → Toggle device toolbar
2. Test on various screen sizes: 320px, 768px, 1024px, 1920px

**Verify**:

- [ ] Pricing card renders correctly on mobile (320px)
- [ ] Line items don't wrap awkwardly
- [ ] Currency amounts align right
- [ ] Badge doesn't overflow on narrow screens
- [ ] Skeleton loading responsive
- [ ] No horizontal scrolling

**If Fails**: See [Troubleshooting](#responsive-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

## Success Criteria Checklist

**All items must be checked for chunk completion**:

### Automated Checks

- [ ] TypeScript compilation passes (no errors)
- [ ] ESLint passes (no errors, warnings acceptable)
- [ ] Unit tests pass (all 7+ tests)
- [ ] Production build succeeds

### Manual Checks: API

- [ ] Preview endpoint responds with HTTP 200
- [ ] Endpoint returns correct pricing structure
- [ ] PostgreSQL function executes without errors

### Manual Checks: Component Behavior

- [ ] PaymentSummary renders without errors
- [ ] Pricing updates when form changes
- [ ] Debouncing prevents excessive API calls (500ms delay)
- [ ] Discount displays when applicable
- [ ] Weekend surcharge calculates correctly
- [ ] Extra person fees calculate correctly
- [ ] Loading state displays during API call
- [ ] Error state displays on API failure
- [ ] Preview warning banner visible
- [ ] Responsive design works on all screen sizes

### Integration Readiness

- [ ] Component exports correctly
- [ ] TypeScript types available for import
- [ ] API client function testable
- [ ] No console errors in browser
- [ ] Downpayment amount available for Chunk 008

---

## If Any Check Fails

### TypeScript Errors

**Common Issues**:

1. **"Cannot find type 'PricingPreview'"**

   ```bash
   # Verify type exists in file
   grep "interface PricingPreview" src/types/guest-booking-multi-unit.ts

   # Ensure export statement present
   grep "export interface PricingPreview" src/types/guest-booking-multi-unit.ts
   ```

2. **"Property 'discount' is possibly undefined"**
   - This is expected - discount is optional
   - Use optional chaining: `pricing.discount?.percent`
   - Or conditional rendering: `{pricing.discount && ...}`

**Solution**: See `troubleshooting.md` section "TypeScript Compilation Errors"

---

### Linting Errors

**Common Issues**:

1. **"React Hook useEffect has missing dependency"**
   - Verify dependencies array includes: unitRequests, checkIn, checkOut
   - If using callback, ensure it's memoized or defined outside useEffect

2. **"Unexpected console statement"**
   - Keep console.error for error logging
   - Remove console.log from production code

**Solution**: Run `npm run lint:fix` to auto-fix

---

### Test Failures

**Common Issues**:

1. **"previewPricing is not a function"**
   - Verify mock setup at top of test file
   - Check import path matches actual implementation

2. **"Unable to find element with text"**
   - Add `await waitFor()` for async operations
   - Check if component actually renders pricing data

**Solution**: See `troubleshooting.md` section "Test Failures"

---

### Preview Endpoint Errors

**Common Issues**:

1. **HTTP 404 - Endpoint not found**
   - Verify Chunk 004 completed (endpoint deployed)
   - Check API_BASE URL in client matches deployment
   - Test with curl to isolate frontend vs backend issue

2. **HTTP 500 - Internal server error**
   - Check server logs for PostgreSQL function errors
   - Verify `calculate_booking_pricing()` function exists
   - Test function directly in database

**Solution**: See `troubleshooting.md` section "API Endpoint Errors"

---

### Component Not Rendering

**Common Issues**:

1. **Component doesn't appear**
   - Verify parent component imports and renders PaymentSummary
   - Check props passed correctly (unitRequests, checkIn, checkOut)
   - Look for errors in browser console

2. **Blank space where component should be**
   - Check if unitRequests.length > 0
   - Verify checkIn and checkOut are defined Date objects
   - Test with minimal props

**Solution**: See `troubleshooting.md` section "Component Rendering Issues"

---

### Pricing Not Updating

**Common Issues**:

1. **Stale pricing displayed**
   - Verify useEffect dependencies array correct
   - Check debounce timer not preventing updates
   - Clear browser cache and reload

2. **API not called on form changes**
   - Check Network tab for blocked requests
   - Verify CORS not blocking requests
   - Ensure API endpoint accessible

**Solution**: See `troubleshooting.md` section "Pricing Update Issues"

---

### Debouncing Issues

**Common Issues**:

1. **Multiple API calls on single change**
   - Verify useEffect cleanup function returns clearTimeout
   - Check dependencies array triggers re-run correctly

2. **No debouncing (instant API calls)**
   - Verify setTimeout delay set to 500
   - Check useEffect structure matches instructions

**Solution**: See `troubleshooting.md` section "Debouncing Not Working"

---

### Discount Not Showing

**Common Issues**:

1. **Discount exists but not displayed**
   - Verify `pricing.discount` object exists in API response
   - Check conditional rendering: `{pricing.discount && ...}`
   - Look for typos in property names

2. **Wrong discount rule applied**
   - This is server-side logic (PostgreSQL function)
   - Verify discount_rules table has correct conditions
   - Test `calculate_booking_pricing()` function directly

**Solution**: See `troubleshooting.md` section "Discount Display Issues"

---

## When All Checks Pass

**Congratulations!** Chunk 007 is complete.

### Commit Your Work

```bash
git add .
git commit -m "feat: complete chunk 007-payment-summary-preview

- Add PricingPreview TypeScript interface
- Implement previewPricing() API client function
- Create PaymentSummary component with server-side pricing
- Add debouncing (500ms) for API call optimization
- Display comprehensive pricing breakdown
- Show discount with badge when applicable
- Calculate and display downpayment requirement
- Include loading, error, and success states
- Comprehensive component unit tests

Chunk 007 of 17 (Phase 2: Guest Booking Flow)
Estimated time: 75 minutes

Tests: 7+ passed
Coverage: Component fully tested
Server-side pricing: Verified via PostgreSQL function

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Tag Commit (Optional)

```bash
git tag chunk-007
```

### Next Steps

**Proceed to Chunk 008: Payment Proof Upload**

File: `docs/implementation/guest-booking-multi-unit/chunks/008-payment-proof-upload/README.md`

**Dependencies Met**:

- ✅ Downpayment amount from this chunk (displayed in upload instructions)
- ✅ Form state structure established
- ✅ API endpoint ready (`/api/guest-booking/upload-url` from Chunk 004)

**What Chunk 008 Adds**:

- File upload component with drag-and-drop
- Client-side image compression (~2MB target)
- Magic number file validation
- Signed URL generation for secure uploads
- Progress indicator during upload
- Private Supabase storage integration

---

## Time Tracking

**Estimated Time**: 75 minutes
**Actual Time**: **\_\_\_** minutes

**Time Breakdown**:

- TypeScript types: **\_** min
- API client extension: **\_** min
- PaymentSummary component: **\_** min
- Testing: **\_** min
- Debugging: **\_** min

**Issues Encountered**: **\*\***\*\***\*\***\_\_\_**\*\***\*\***\*\***

**Notes**: **\*\***\*\***\*\***\_\_\_**\*\***\*\***\*\***

---

**Status**: [ ] All Checks Pass - Ready for Chunk 008
