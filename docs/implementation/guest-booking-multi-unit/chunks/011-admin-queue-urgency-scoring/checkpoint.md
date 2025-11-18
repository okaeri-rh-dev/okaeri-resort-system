# Checkpoint: Chunk 011 Verification

## Purpose

This document provides comprehensive verification procedures to ensure Chunk 011 (Admin Queue with Urgency Scoring) was implemented correctly. All tests must pass before proceeding to Chunk 012.

---

## Automated Checks

Run these commands to verify code quality and functionality.

### Check 1: TypeScript Compilation

```bash
npm run type-check
```

**Expected Output**:

```
✓ Type checking complete - no errors found
```

**Success Criteria**:

- No TypeScript errors in `src/lib/urgency-scoring.ts`
- No TypeScript errors in `src/components/admin/PendingBookingsQueue.tsx`
- No TypeScript errors in `functions/api/admin/pending-bookings.ts`
- No TypeScript errors in `src/routes/admin/queue.tsx`

**Status**: [ ] Pass [ ] Fail

**Issues** (if any):

```
[Record any TypeScript errors here]
```

---

### Check 2: ESLint Code Quality

```bash
npm run lint
```

**Expected Output**:

```
✓ No linting errors or warnings
```

**Success Criteria**:

- No ESLint errors in new files
- No ESLint warnings in new files
- All imports properly ordered
- No unused variables

**Status**: [ ] Pass [ ] Fail

**Issues** (if any):

```
[Record any linting errors here]
```

---

### Check 3: Unit Tests for Urgency Scoring

Create test file: `src/lib/__tests__/urgency-scoring.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateUrgencyScore, getUrgencyLevel, getUrgencyResult } from "../urgency-scoring";

describe("Urgency Scoring System", () => {
  const baseDate = new Date("2025-10-24T10:00:00Z");

  beforeEach(() => {
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 100 for check-in date in the past", () => {
    const score = calculateUrgencyScore({
      check_in_date: "2025-10-23T15:00:00Z", // Yesterday
      created_at: "2025-10-20T10:00:00Z",
      total_amount: 30000,
      requested_unit_count: 2,
    });
    expect(score).toBe(100);
  });

  it("should calculate high urgency for check-in <24h", () => {
    const score = calculateUrgencyScore({
      check_in_date: "2025-10-25T09:00:00Z", // Tomorrow (23h away)
      created_at: "2025-10-22T10:00:00Z", // 2 days ago
      total_amount: 45000, // ₱30k-50k = 10pts
      requested_unit_count: 3, // 3-5 units = 10pts
    });
    // 50 (check-in) + 15 (2-3 days pending) + 10 (amount) + 10 (units) = 85
    expect(score).toBe(85);
    expect(getUrgencyLevel(score)).toBe("critical");
  });

  it("should calculate medium urgency for check-in 48-72h", () => {
    const score = calculateUrgencyScore({
      check_in_date: "2025-10-27T10:00:00Z", // 3 days away (72h)
      created_at: "2025-10-23T10:00:00Z", // 1 day ago
      total_amount: 20000, // ₱15k-30k = 5pts
      requested_unit_count: 2, // 2 units = 5pts
    });
    // 20 (check-in) + 10 (1-2 days pending) + 5 (amount) + 5 (units) = 40
    expect(score).toBe(40);
    expect(getUrgencyLevel(score)).toBe("medium");
  });

  it("should calculate low urgency for distant check-in", () => {
    const score = calculateUrgencyScore({
      check_in_date: "2025-11-10T15:00:00Z", // 17 days away
      created_at: "2025-10-24T09:00:00Z", // <1 day ago
      total_amount: 12000, // <₱15k = 2pts
      requested_unit_count: 1, // 1 unit = 2pts
    });
    // 10 (check-in) + 5 (pending) + 2 (amount) + 2 (units) = 19
    expect(score).toBe(19);
    expect(getUrgencyLevel(score)).toBe("low");
  });

  it("should return correct badge variant", () => {
    const criticalResult = getUrgencyResult({
      check_in_date: "2025-10-25T08:00:00Z",
      created_at: "2025-10-20T10:00:00Z",
      total_amount: 60000,
      requested_unit_count: 6,
    });
    expect(criticalResult.badge_variant).toBe("destructive");

    const highResult = getUrgencyResult({
      check_in_date: "2025-10-26T15:00:00Z",
      created_at: "2025-10-23T10:00:00Z",
      total_amount: 40000,
      requested_unit_count: 3,
    });
    expect(highResult.badge_variant).toBe("warning");
  });

  it("should cap score at 100", () => {
    // Extreme scenario that would exceed 100
    const score = calculateUrgencyScore({
      check_in_date: "2025-10-25T08:00:00Z", // <24h = 50pts
      created_at: "2025-10-20T10:00:00Z", // >3 days = 20pts
      total_amount: 80000, // >₱50k = 15pts
      requested_unit_count: 10, // >5 units = 15pts
    });
    expect(score).toBe(100); // Max capped at 100
  });
});
```

Run tests:

```bash
npm test -- urgency-scoring.test.ts
```

**Expected Output**: All tests pass (6/6)

**Status**: [ ] Pass [ ] Fail

---

### Check 4: API Endpoint Response Structure

Test API endpoint returns correct schema:

```bash
# Start dev server (if not running)
npm run dev

# In another terminal, test endpoint
curl -X GET http://localhost:5173/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  | jq .
```

**Expected Output**:

```json
{
  "bookings": [
    {
      "booking_id": "uuid",
      "booking_reference": "string",
      "guest_name": "string",
      "guest_contact": "string",
      "check_in_date": "ISO8601",
      "check_out_date": "ISO8601",
      "requested_unit_count": "number",
      "total_amount": "number",
      "payment_status": "Pending|Verified|Rejected",
      "urgency_score": "number (0-100)",
      "urgency_level": "critical|high|medium|low",
      "created_at": "ISO8601"
    }
  ],
  "count": "number"
}
```

**Success Criteria**:

- Returns 200 status code
- JSON structure matches expected schema
- `urgency_score` is a number between 0-100
- `urgency_level` is one of: critical, high, medium, low
- Bookings sorted by `urgency_score` descending (highest first)

**Status**: [ ] Pass [ ] Fail

---

### Check 5: Build Success

```bash
npm run build
```

**Expected Output**: Build completes without errors

**Status**: [ ] Pass [ ] Fail

---

## Manual Checks

Perform these visual and functional tests in the browser.

### Check 6: Queue Displays Pending Bookings

**Test Steps**:

1. Navigate to `http://localhost:5173/admin/queue`
2. Ensure you're logged in as admin
3. Observe the queue table

**Expected Behavior**:

- [ ] Queue page loads without errors
- [ ] Table displays all pending multi-unit bookings
- [ ] Bookings sorted by urgency (highest score first)
- [ ] Each row shows: urgency badge, reference, guest, check-in, units, amount, payment status, pending time
- [ ] Auto-refresh badge visible ("Auto-refresh: 30s")

**Status**: [ ] Pass [ ] Fail

**Screenshot** (optional):

```
[Attach screenshot of queue with bookings]
```

---

### Check 7: Urgency Badges Color-Coded Correctly

**Test Steps**:

1. Create test bookings with different urgency levels (use SQL from instructions.md Step 5)
2. Observe badge colors in queue

**Expected Behavior**:

- [ ] Critical (≥75 score): Red badge ("destructive" variant)
- [ ] High (50-74 score): Orange badge ("warning" variant)
- [ ] Medium (25-49 score): Yellow badge ("default" variant)
- [ ] Low (<25 score): Gray badge ("secondary" variant)
- [ ] Score number displayed next to badge

**Status**: [ ] Pass [ ] Fail

**Test Data**:
| Booking | Check-in | Created | Amount | Units | Expected Score | Expected Level |
|---------|----------|---------|--------|-------|---------------|----------------|
| TEST-1 | Tomorrow | 2d ago | ₱45k | 3 | ~85 | Critical |
| TEST-2 | 3d away | 1d ago | ₱30k | 2 | ~50 | High |
| TEST-3 | 5d away | Today | ₱20k | 2 | ~30 | Medium |
| TEST-4 | 20d away | Today | ₱10k | 1 | ~19 | Low |

---

### Check 8: Search Filter Works

**Test Steps**:

1. Type booking reference in search box (e.g., "TEST")
2. Observe filtered results
3. Type guest name
4. Observe filtered results

**Expected Behavior**:

- [ ] Table filters in real-time as you type
- [ ] Matches booking reference (case-insensitive)
- [ ] Matches guest name (case-insensitive)
- [ ] Shows "No pending bookings found" if no matches
- [ ] Clearing search shows all bookings again

**Status**: [ ] Pass [ ] Fail

---

### Check 9: Urgency Filter Works

**Test Steps**:

1. Select "Critical" from urgency dropdown
2. Observe filtered results
3. Select "All Urgency"
4. Observe all bookings shown

**Expected Behavior**:

- [ ] Only bookings with selected urgency level displayed
- [ ] Card description updates (e.g., "5 pending bookings (Critical priority)")
- [ ] "All Urgency" shows all bookings
- [ ] Filter persists when search filter applied

**Status**: [ ] Pass [ ] Fail

---

### Check 10: Date Range Filter Works

**Test Steps**:

1. Select "Check-in Today" from date range dropdown
2. Observe filtered results
3. Select "Next 7 Days"
4. Select "All Dates"

**Expected Behavior**:

- [ ] "Check-in Today" shows only bookings with check-in date = today
- [ ] "Next 7 Days" shows bookings with check-in within 7 days
- [ ] "Next 30 Days" shows bookings with check-in within 30 days
- [ ] "All Dates" shows all bookings
- [ ] Filter works correctly with other filters

**Status**: [ ] Pass [ ] Fail

---

### Check 11: Auto-Refresh Functionality

**Test Steps**:

1. Open browser DevTools → Network tab
2. Wait 30 seconds
3. Observe network requests

**Expected Behavior**:

- [ ] API request to `/api/admin/pending-bookings` fires every 30 seconds
- [ ] Table updates if new bookings added during wait
- [ ] No page flicker or scroll position lost during refresh
- [ ] React Query DevTools shows `refetchInterval: 30000`

**Status**: [ ] Pass [ ] Fail

---

### Check 12: Mobile Responsive Design

**Test Steps**:

1. Open browser DevTools → Toggle device toolbar
2. Select "iPhone SE" (375px width)
3. Navigate to `/admin/queue`

**Expected Behavior**:

- [ ] Table columns stack appropriately
- [ ] Filter controls stack vertically on mobile
- [ ] Search input full width on mobile
- [ ] Urgency badge and score readable
- [ ] "Assign Units" button accessible
- [ ] No horizontal scroll
- [ ] Touch-friendly hit targets (buttons ≥44px)

**Status**: [ ] Pass [ ] Fail

**Screenshot** (375px width):

```
[Attach mobile screenshot]
```

---

### Check 13: Authentication Enforced

**Test Steps**:

1. Log out (clear auth token)
2. Navigate to `/admin/queue`
3. Observe redirect or error

**Expected Behavior**:

- [ ] Non-authenticated user redirected to login
- [ ] Non-admin user shown "Forbidden" error
- [ ] API returns 401 without valid JWT
- [ ] API returns 403 for non-admin role

**Status**: [ ] Pass [ ] Fail

---

### Check 14: "Assign Units" Navigation

**Test Steps**:

1. Click "Assign Units" button on any booking
2. Observe navigation

**Expected Behavior**:

- [ ] Navigates to `/admin/assign-units/{booking_id}`
- [ ] Booking ID passed correctly in URL
- [ ] (May show 404 until chunk 013 implemented - this is expected)

**Status**: [ ] Pass [ ] Fail

---

## Success Criteria Checklist

All of the following must be true:

- [ ] All automated checks pass (Checks 1-5)
- [ ] Queue displays bookings correctly (Check 6)
- [ ] Urgency badges color-coded correctly (Check 7)
- [ ] Search filter works (Check 8)
- [ ] Urgency level filter works (Check 9)
- [ ] Date range filter works (Check 10)
- [ ] Auto-refresh every 30s (Check 11)
- [ ] Mobile responsive at 375px (Check 12)
- [ ] Admin authentication enforced (Check 13)
- [ ] "Assign Units" navigation works (Check 14)
- [ ] No console errors in browser DevTools
- [ ] No React warnings in browser DevTools
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings

---

## If Any Check Fails

1. **Review troubleshooting.md** - Check for your specific issue
2. **Check instructions.md** - Verify you followed all steps
3. **Review error messages** - TypeScript/ESLint errors are usually helpful
4. **Check browser console** - Look for runtime errors
5. **Verify dependencies** - Ensure chunks 001-010 completed
6. **Check environment variables** - Ensure `.env.local` configured
7. **Clear cache** - `rm -rf node_modules/.vite && npm run dev`

**Common Issues**:

- Queue shows no bookings → Create test booking (SQL in instructions.md Step 5)
- Urgency scores all 0 → Check `created_at` and `check_in_date` populated
- API returns 403 → Verify JWT admin role claims
- TypeScript errors → Run `npm run type-check` for details

---

## When All Checks Pass

### Record Completion

**Chunk 011 Completion Status**: ✅ Complete

**Date Completed**: **\*\***\_\_\_**\*\***

**Time Taken**: **\*\***\_\_\_**\*\*** (Target: 90 minutes)

**Issues Encountered**:

```
[Record any issues and how they were resolved]
```

**Notes**:

```
[Any observations or improvements for future chunks]
```

### Commit Changes

```bash
# Stage all changes
git add .

# Commit with standardized message
git commit -m "feat: complete chunk 011-admin-queue-urgency-scoring

- Created urgency scoring utility (0-100 scale, 4 factors)
- Implemented PendingBookingsQueue component with filters
- Created admin API endpoint with JWT authentication
- Added admin queue route with authentication guard
- Updated admin navigation with queue link
- All tests passing, mobile responsive"

# Optional: Tag commit
git tag -a chunk-011 -m "Chunk 011: Admin Queue with Urgency Scoring"
```

### Update Progress Tracker

Update `docs/implementation/guest-booking-multi-unit/chunks/README.md`:

```markdown
- [x] 001: Database Schema Setup
- [x] 002: PostgreSQL Pricing Engine
- [x] 003: Security, RLS, and Constraints
- [x] 004: Core API Endpoints
- [x] 005: Idempotency and Rate Limiting
- [x] 006: Date and Unit Selection UI
- [x] 007: Payment Summary with Preview
- [x] 008: Payment Proof Upload
- [x] 009: Form Validation and Submission
- [x] 010: Booking Confirmation Flow
- [x] 011: Admin Queue with Urgency Scoring ← YOU ARE HERE
- [ ] 012: Payment Verification UI (NEXT)
```

### Next Chunk

**Proceed to Chunk 012: Payment Verification UI**

Chunk 012 requires chunk 011 to be complete (queue provides navigation to payment verification).

**Estimated Time**: 75 minutes

**What You'll Build**:

- Payment proof viewer component with signed URLs
- Image zoom/pan controls
- PDF viewer integration
- Verify/reject payment actions
- Audit logging integration

---

**Congratulations!** Chunk 011 is complete. The admin can now view and prioritize pending bookings.
