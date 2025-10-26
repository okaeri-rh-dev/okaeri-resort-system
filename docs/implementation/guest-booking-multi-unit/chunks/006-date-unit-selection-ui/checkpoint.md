# Chunk 006: Date and Unit Selection UI - Checkpoint Verification

## Purpose

This checkpoint ensures your date picker and unit selection UI components are correctly implemented, tested, and ready for integration with the payment summary (Chunk 007).

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
npm run test:run src/components/guest-booking
```

**Expected Output**:

```
✓ UnitRequestCard.test.tsx (8 tests)
✓ UnitRequestSelector.test.tsx (5 tests)

Test Files  2 passed (2)
     Tests  13 passed (13)
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

### 1. Date Range Picker

**How to Test**:

1. Start dev server: `npm run dev`
2. Navigate to guest booking page (e.g., `/guest-booking`)
3. Click on date picker button

**Verify**:

- [ ] Calendar opens with current month displayed
- [ ] Past dates are disabled (greyed out)
- [ ] Can select check-in date
- [ ] Can select check-out date (after check-in)
- [ ] Number of nights displayed correctly
- [ ] Error shown if check-out before check-in
- [ ] Error shown if check-in is in the past
- [ ] Selected date range displays in button text

**Expected Behavior**:

- Selecting Jan 1 → Jan 3 shows "2 nights"
- Attempting to select check-out before check-in shows error
- Past dates cannot be clicked

**If Fails**: See [Troubleshooting](#date-picker-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 2. Unit Request Selector - Empty State

**How to Test**:

1. Load guest booking page with no units selected
2. Observe initial UI

**Verify**:

- [ ] "No units selected" message displayed
- [ ] "Add Unit Request" button visible
- [ ] Static rates card shows:
  - [ ] Base Rate (e.g., ₱2,000/night)
  - [ ] Weekend Rate (e.g., ₱2,500/night)
  - [ ] Base Occupancy (e.g., 2 guests)
  - [ ] Extra Person Rate (e.g., ₱300/night)
- [ ] Info banner explains admin will assign units

**If Fails**: See [Troubleshooting](#static-rates-not-loading) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 3. Unit Request Selector - Add Units

**How to Test**:

1. Click "Add Unit Request" button
2. Observe card appears
3. Click "Add Another Unit" button
4. Repeat until 10 units

**Verify**:

- [ ] First click creates "Unit #1" card
- [ ] Second click creates "Unit #2" card
- [ ] Each card has guest count input (default: base occupancy)
- [ ] Each card has remove button (X icon)
- [ ] "Add Another Unit" button visible while < 10 units
- [ ] Total display shows correct count (e.g., "2 units, 4 guests")
- [ ] Warning shown when 10 units reached
- [ ] "Add Another Unit" button hidden when 10 units reached

**Expected Behavior**:

- Adding 3 units (each with 2 guests) shows "Total: 3 units, 6 guests"
- 10th unit addition hides "Add Another Unit" button
- Warning: "Maximum of 10 units per booking reached"

**If Fails**: See [Troubleshooting](#unit-card-add-remove-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 4. Unit Request Card - Guest Count Validation

**How to Test**:

1. Add a unit card
2. Change guest count input to various values

**Verify**:

- [ ] Can set guest count to 1
- [ ] Can set guest count to base occupancy (e.g., 2)
- [ ] Can set guest count to max capacity (e.g., 10)
- [ ] Cannot set guest count to 0
- [ ] Cannot set guest count above max capacity
- [ ] Extra person indicator shows when > base occupancy
- [ ] Extra person indicator shows correct count and fee
- [ ] Input rejects invalid values (e.g., letters, decimals)

**Example**:

- Set guests to 5 (base occupancy = 2, max = 10)
- Should see: "⚠️ Extra person fee: ₱300/person/night (3 extra people)"

**If Fails**: See [Troubleshooting](#guest-count-validation-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 5. Unit Request Card - Remove Functionality

**How to Test**:

1. Add 3 units
2. Click remove button (X) on Unit #2
3. Observe remaining units

**Verify**:

- [ ] Remove button visible on all cards when > 1 unit
- [ ] Remove button hidden when only 1 unit
- [ ] Clicking remove deletes correct card
- [ ] Remaining units renumber correctly (Unit #3 becomes Unit #2)
- [ ] Total updates correctly after removal
- [ ] Cannot remove last remaining unit

**Expected Behavior**:

- Start: Unit #1, Unit #2, Unit #3
- Remove Unit #2
- Result: Unit #1, Unit #2 (former #3 renumbered)
- Total updates: "2 units, X guests"

**If Fails**: See [Troubleshooting](#unit-card-add-remove-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 6. Totals Calculation

**How to Test**:

1. Add 3 units:
   - Unit #1: 2 guests
   - Unit #2: 5 guests
   - Unit #3: 3 guests
2. Observe total display

**Verify**:

- [ ] Total units: 3
- [ ] Total guests: 10
- [ ] Total display shows "Total: 3 units, 10 guests"
- [ ] Total updates when changing guest count
- [ ] Total updates when adding unit
- [ ] Total updates when removing unit

**If Fails**: See [Troubleshooting](#totals-calculation-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

### 7. Responsive Design

**How to Test**:

1. Open browser DevTools
2. Toggle device toolbar (mobile view)
3. Test on various screen sizes: 320px, 768px, 1024px, 1920px

**Verify**:

- [ ] Components render correctly on mobile (320px)
- [ ] Components render correctly on tablet (768px)
- [ ] Components render correctly on desktop (1024px+)
- [ ] No horizontal scrolling
- [ ] Buttons remain clickable on all sizes
- [ ] Static rates card adjusts to screen width
- [ ] Date picker calendar fits on mobile

**If Fails**: See [Troubleshooting](#responsive-design-issues) below.

**Status**: [ ] Pass / [ ] Fail / [ ] In Progress

---

## Success Criteria Checklist

**All items must be checked for chunk completion**:

### Automated Checks

- [ ] TypeScript compilation passes (no errors)
- [ ] ESLint passes (no errors, warnings acceptable)
- [ ] Unit tests pass (all 13+ tests)
- [ ] Production build succeeds

### Manual Checks

- [ ] Date picker allows valid date selection
- [ ] Date picker prevents invalid dates
- [ ] Static rates display correctly from API
- [ ] Can add up to 10 unit cards
- [ ] Can remove unit cards (when > 1)
- [ ] Guest count validation works per unit
- [ ] Extra person indicator shows correctly
- [ ] Totals calculate accurately
- [ ] Responsive design works on all screen sizes

### Integration Readiness

- [ ] Components export correctly
- [ ] TypeScript types are available for import
- [ ] API client functions are testable
- [ ] No console errors in browser
- [ ] No console warnings (or only expected warnings)

---

## If Any Check Fails

### TypeScript Errors

**Common Issues**:

1. **"Cannot find module '@/types/guest-booking-multi-unit'"**

   ```bash
   # Verify file exists
   ls src/types/guest-booking-multi-unit.ts

   # Check tsconfig.json has path alias
   # "paths": { "@/*": ["./src/*"] }
   ```

2. **Type mismatch errors**
   - Verify `UnitRequest` interface matches usage
   - Check `StandardUnitRates` matches API response
   - Ensure all imports use correct paths

**Solution**: See `troubleshooting.md` section "TypeScript Compilation Errors"

---

### Linting Errors

**Common Issues**:

1. **"React Hook useEffect has a missing dependency"**
   - Add dependencies to useEffect array
   - Or add `// eslint-disable-next-line` if intentional

2. **"Unexpected console statement"**
   - Remove `console.log` from production code
   - Or replace with proper error handling

**Solution**: Run `npm run lint:fix` to auto-fix

---

### Test Failures

**Common Issues**:

1. **"fetchRates is not a function"**
   - Verify mock is set up correctly in test file
   - Check import path matches actual implementation

2. **"Cannot find element with text"**
   - Add `await waitFor()` for async operations
   - Verify test is rendering correct component

**Solution**: See `troubleshooting.md` section "Test Failures"

---

### Build Failures

**Common Issues**:

1. **"Module not found"**
   - Check all imports use correct paths
   - Verify shadcn/ui components installed

2. **"Type error in production build"**
   - Run `npm run type-check` to identify
   - Fix TypeScript errors before building

**Solution**: See `troubleshooting.md` section "Build Errors"

---

### Date Picker Issues

**Common Issues**:

1. **Calendar doesn't open**
   - Verify `Popover` component installed: `npx shadcn@latest add popover`
   - Check `Calendar` component installed: `npx shadcn@latest add calendar`

2. **Past dates not disabled**
   - Verify `disabled` prop set correctly: `disabled={(date) => date < new Date()}`

**Solution**: See `troubleshooting.md` section "Date Picker Not Working"

---

### Static Rates Not Loading

**Common Issues**:

1. **API endpoint returns 404**
   - Verify Chunk 004 completed (API endpoint deployed)
   - Test endpoint: `curl https://your-domain.com/api/guest-booking/rates`

2. **CORS error in browser console**
   - Check CORS headers in API endpoint
   - Verify allowed origins include localhost for development

**Solution**: See `troubleshooting.md` section "API Endpoint Errors"

---

### Unit Card Add/Remove Issues

**Common Issues**:

1. **Remove button doesn't appear**
   - Verify `canRemove` prop set correctly: `canRemove={value.length > 1}`

2. **Cards don't renumber after removal**
   - Verify `key` prop uses index: `key={index}`
   - Check `onChange` callback updates state correctly

**Solution**: See `troubleshooting.md` section "Unit Card Issues"

---

### Guest Count Validation Issues

**Common Issues**:

1. **Can enter values above max capacity**
   - Verify validation in `handleGuestsChange`: `value <= maxCapacityPerUnit`

2. **Extra person indicator doesn't show**
   - Check calculation: `extraPersons = Math.max(0, guestsPerUnit - baseOccupancy)`
   - Verify conditional rendering: `{extraPersons > 0 && ...}`

**Solution**: See `troubleshooting.md` section "Validation Errors"

---

### Totals Calculation Issues

**Common Issues**:

1. **Totals don't update**
   - Verify `onChange` prop passed correctly
   - Check parent component state updates

2. **Incorrect guest count**
   - Verify reduce calculation: `value.reduce((sum, r) => sum + r.guests_per_unit, 0)`

**Solution**: See `troubleshooting.md` section "Calculation Errors"

---

### Responsive Design Issues

**Common Issues**:

1. **Horizontal scrolling on mobile**
   - Add `className="container mx-auto"` to parent
   - Verify grid columns collapse on mobile: `grid-cols-1 md:grid-cols-2`

2. **Text too small on mobile**
   - Use responsive text sizes: `text-sm md:text-base`

**Solution**: See `troubleshooting.md` section "Responsive Design"

---

## When All Checks Pass

**Congratulations!** Chunk 006 is complete.

### Commit Your Work

```bash
git add .
git commit -m "feat: complete chunk 006-date-unit-selection-ui

- Add TypeScript types for multi-unit booking
- Implement date range picker with validation
- Create UnitRequestCard component (array-based model)
- Create UnitRequestSelector container with static rates
- Add API client for fetching pricing config
- Include comprehensive component unit tests

Chunk 006 of 17 (Phase 2: Guest Booking Flow)
Estimated time: 90 minutes

Tests: 13 passed
Coverage: Components fully tested
Responsive: Mobile, tablet, desktop verified

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Tag Commit (Optional)

```bash
git tag chunk-006
```

### Next Steps

**Proceed to Chunk 007: Payment Summary with Preview**

File: `docs/implementation/guest-booking-multi-unit/chunks/007-payment-summary-preview/README.md`

**Dependencies Met**:

- ✅ Form state from this chunk (date_range, unit_requests)
- ✅ API endpoint ready (`/api/guest-booking/preview-pricing` from Chunk 004)
- ✅ TypeScript types defined

**What Chunk 007 Adds**:

- Server-side pricing preview component
- Real-time pricing calculations (debounced)
- Discount display (if applicable)
- Downpayment calculation
- Warning banner about final pricing

---

## Time Tracking

**Estimated Time**: 90 minutes
**Actual Time**: **\_\_\_** minutes

**Time Breakdown**:

- Dependencies installation: **\_** min
- TypeScript types: **\_** min
- Components implementation: **\_** min
- Testing: **\_** min
- Debugging: **\_** min

**Issues Encountered**: **************\_\_\_**************

**Notes**: **************\_\_\_**************

---

**Status**: [ ] All Checks Pass - Ready for Chunk 007
