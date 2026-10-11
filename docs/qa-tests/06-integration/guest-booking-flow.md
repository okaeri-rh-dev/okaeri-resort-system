# QA Test: Guest Booking End-to-End Flows

| Field              | Value                         |
| ------------------ | ----------------------------- |
| **Test Category**  | Complex Integration           |
| **Test IDs**       | INT-GUEST-001, INT-GUEST-002  |
| **Priority**       | Critical                      |
| **Roles Required** | Anonymous + Admin + Anonymous |
| **Estimated Time** | 25 minutes                    |

## Overview

These tests verify the complete end-to-end flows for guest bookings: from anonymous submission through admin processing to public calendar reflection. This covers both the approval and rejection pathways.

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `<see password manager>`):
  - Admin: `jasonacido+admin@gmail.com`

## Prerequisites

- [ ] Two to three browser tabs ready (Guest A, Admin, Guest B/Public)
- [ ] Test unit available for the target dates
- [ ] Camera/screenshot tool for proof capture
- [ ] Test payment proof image ready

---

## INT-GUEST-001: Guest Booking → Admin Queue → Calendar Flow

| Field          | Value     |
| -------------- | --------- |
| **Complexity** | Very High |
| **Priority**   | Critical  |

### Scenario

Complete flow from guest submission to admin approval to public calendar visibility.

### Test Configuration

```
Target Unit: _______________
Target Dates: Mar 1-3, 2026 (or available dates)
Guest Name: Test Guest QA
Guest Email: test.qa@example.com
Guest Phone: 09171234567
```

### Test Steps

#### Phase 1: Guest Submits Booking

**Session: Guest A (Anonymous)**

| Step | Action                             | Expected Result                   | Pass/Fail |
| ---- | ---------------------------------- | --------------------------------- | --------- |
| 1    | Open new browser tab (Guest A)     | Tab opens                         |           |
| 2    | Navigate to `/booking`             | Guest booking form loads          |           |
| 3    | Verify form is accessible          | All fields visible                |           |
| 4    | Select target unit                 | Unit selected                     |           |
| 5    | Select dates: Mar 1-3, 2026        | Dates selected, shows available   |           |
| 6    | Enter guest name: Test Guest QA    | Name entered                      |           |
| 7    | Enter email: test.qa@example.com   | Email entered                     |           |
| 8    | Enter phone: 09171234567           | Phone entered                     |           |
| 9    | Enter number of guests: 2          | Count entered                     |           |
| 10   | Upload payment proof (if required) | File uploaded                     |           |
| 11   | Complete any CAPTCHA/verification  | Verification passed               |           |
| 12   | Click Submit                       | Form submits                      |           |
| 13   | Wait for confirmation              | Confirmation page/message appears |           |
| 14   | Note booking reference             | Ref: **\*\***\_\_\_**\*\***       |           |
| 15   | Note submission timestamp          | Time: **\*\***\_\_\_**\*\***      |           |

**Guest Confirmation Record:**

```
Booking Reference: _______________
Confirmation Message: _______________
Status Shown: _______________
```

#### Phase 2: Admin Sees Booking in Queue

**Session: Admin**

| Step | Action                                                   | Expected Result                       | Pass/Fail |
| ---- | -------------------------------------------------------- | ------------------------------------- | --------- |
| 16   | Open new browser tab (Admin)                             | Tab opens                             |           |
| 17   | Navigate to `/login`                                     | Login page loads                      |           |
| 18   | Login as Admin                                           | Dashboard loads                       |           |
| 19   | Check for new booking notification                       | Notification/badge visible (if any)   |           |
| 20   | Navigate to `/admin/bookings/queue` OR `/admin/bookings` | Queue/list loads                      |           |
| 21   | Find the new pending booking                             | Booking visible with "Pending" status |           |
| 22   | Verify guest name matches                                | Test Guest QA visible                 |           |
| 23   | Verify dates match: Mar 1-3                              | Correct dates displayed               |           |
| 24   | Verify unit matches                                      | Correct unit displayed                |           |

**Admin Queue Verification:**

```
Booking found in queue: [ ] Yes [ ] No
Reference matches: [ ] Yes [ ] No
Guest info matches: [ ] Yes [ ] No
```

#### Phase 3: Admin Approves Booking

**Session: Admin**

| Step | Action                               | Expected Result               | Pass/Fail |
| ---- | ------------------------------------ | ----------------------------- | --------- |
| 25   | Click on booking to view details     | Booking details panel opens   |           |
| 26   | Review payment proof (if applicable) | Payment proof visible         |           |
| 27   | Click "Verify Payment" (if needed)   | Payment verified              |           |
| 28   | Click "Confirm Booking" or similar   | Confirmation dialog appears   |           |
| 29   | Confirm the approval                 | Status changes to "Confirmed" |           |
| 30   | Verify status in bookings table      | Shows "Confirmed" badge       |           |
| 31   | Note approval timestamp              | Time: **\*\***\_\_\_**\*\***  |           |

#### Phase 4: Public Calendar Reflects Booking

**Session: Guest B (New Anonymous Tab)**

| Step | Action                            | Expected Result                      | Pass/Fail |
| ---- | --------------------------------- | ------------------------------------ | --------- |
| 32   | Open new browser tab (Guest B)    | Tab opens                            |           |
| 33   | Navigate to `/` (public calendar) | Public calendar loads                |           |
| 34   | Select the same unit              | Unit calendar displayed              |           |
| 35   | Check Mar 1-3 availability        | Shows UNAVAILABLE (blocked)          |           |
| 36   | Verify visual indicator changed   | Different color/styling for blocked  |           |
| 37   | Try to select Mar 1-3 for booking | Selection prevented or warning shown |           |

#### Phase 5: Guest Checks Booking Status

**Session: Guest A (Original)**

| Step | Action                              | Expected Result                 | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------- | --------- |
| 38   | Navigate to `/booking/check-status` | Status lookup page loads        |           |
| 39   | Enter booking reference             | Reference entered               |           |
| 40   | Click Search/Check                  | Status result displayed         |           |
| 41   | Verify status shows "Confirmed"     | Confirmed status visible        |           |
| 42   | Verify booking details match        | Dates, unit, guest info correct |           |

### Verification Checklist

- [ ] Guest booking creates Pending record
- [ ] Admin sees booking in queue/dashboard
- [ ] Admin can verify payment (if applicable)
- [ ] Admin can confirm/approve booking
- [ ] Approval changes status to Confirmed
- [ ] Calendar immediately reflects unavailability
- [ ] New guests cannot book same dates
- [ ] Status lookup returns correct Confirmed state

### End-to-End Flow Summary

```
Guest A Submits → Pending Booking Created
                         ↓
Admin Reviews → Verifies Payment → Confirms Booking
                         ↓
Status: Confirmed → Calendar: Blocked
                         ↓
Guest A Checks Status → Shows Confirmed
Guest B Sees Calendar → Dates Unavailable
```

---

## INT-GUEST-002: Booking Rejection Flow

| Field          | Value |
| -------------- | ----- |
| **Complexity** | High  |
| **Priority**   | High  |

### Scenario

Admin rejects a guest booking - dates should remain available for other guests.

### Test Configuration

```
Target Unit: _______________
Target Dates: Mar 5-7, 2026 (or available dates)
Guest Name: Reject Test QA
Guest Email: reject.test@example.com
```

### Test Steps

#### Phase 1: Guest Submits Booking

**Session: Guest**

| Step | Action                          | Expected Result                 | Pass/Fail |
| ---- | ------------------------------- | ------------------------------- | --------- |
| 1    | Navigate to `/booking`          | Guest booking form loads        |           |
| 2    | Select target unit              | Unit selected                   |           |
| 3    | Select dates: Mar 5-7           | Dates selected, shows available |           |
| 4    | Fill guest info: Reject Test QA | Info entered                    |           |
| 5    | Submit booking                  | Booking created                 |           |
| 6    | Note booking reference          | Ref: **\*\***\_\_\_**\*\***     |           |

#### Phase 2: Verify Pending Doesn't Block Calendar

**Session: Public**

| Step | Action                             | Expected Result             | Pass/Fail |
| ---- | ---------------------------------- | --------------------------- | --------- |
| 7    | Navigate to `/` (public calendar)  | Calendar loads              |           |
| 8    | Check Mar 5-7 for target unit      | Still shows AVAILABLE       |           |
| 9    | Note: Pending bookings don't block | Dates can still be selected |           |

#### Phase 3: Admin Rejects Booking

**Session: Admin**

| Step | Action                        | Expected Result                        | Pass/Fail |
| ---- | ----------------------------- | -------------------------------------- | --------- |
| 10   | Login as Admin                | Dashboard loads                        |           |
| 11   | Navigate to `/admin/bookings` | Bookings page loads                    |           |
| 12   | Find the pending booking      | Booking visible                        |           |
| 13   | Click on booking for details  | Details panel opens                    |           |
| 14   | Click "Reject" or "Decline"   | Rejection dialog appears               |           |
| 15   | Enter rejection reason        | Reason: "Payment not received"         |           |
| 16   | Confirm rejection             | Status changes to "Cancelled/Rejected" |           |
| 17   | Verify status in table        | Shows cancelled/rejected badge         |           |

**Rejection Details:**

```
Rejection Reason: _______________
Final Status: _______________
```

#### Phase 4: Guest Checks Rejected Status

**Session: Guest**

| Step | Action                              | Expected Result                   | Pass/Fail |
| ---- | ----------------------------------- | --------------------------------- | --------- |
| 18   | Navigate to `/booking/check-status` | Status lookup page loads          |           |
| 19   | Enter booking reference             | Reference entered                 |           |
| 20   | Click Search/Check                  | Status result displayed           |           |
| 21   | Verify status shows rejected        | Cancelled/Rejected status visible |           |
| 22   | Check if reason is displayed        | Reason shown (if feature exists)  |           |

#### Phase 5: Calendar Remains Available

**Session: Public**

| Step | Action                             | Expected Result            | Pass/Fail |
| ---- | ---------------------------------- | -------------------------- | --------- |
| 23   | Navigate to `/` (public calendar)  | Calendar loads             |           |
| 24   | Check Mar 5-7 for target unit      | Still shows AVAILABLE      |           |
| 25   | Try to start new booking           | New booking can be started |           |
| 26   | Confirm no blocking from rejection | Dates fully available      |           |

### Verification Checklist

- [ ] Guest booking creates Pending record
- [ ] Pending booking does NOT block calendar
- [ ] Admin can reject with reason
- [ ] Status changes to Cancelled/Rejected
- [ ] Guest can check and see rejected status
- [ ] Rejection reason visible (if feature exists)
- [ ] Calendar dates remain AVAILABLE after rejection
- [ ] Other guests can book rejected dates

---

## Status Flow Diagrams

### Approval Flow

```
[Guest Submit]
      ↓
[Pending] ──────────────────────────→ Calendar: Available
      ↓
[Admin Review]
      ↓
[Payment Verify] (optional)
      ↓
[Confirm]
      ↓
[Confirmed] ────────────────────────→ Calendar: BLOCKED
```

### Rejection Flow

```
[Guest Submit]
      ↓
[Pending] ──────────────────────────→ Calendar: Available
      ↓
[Admin Review]
      ↓
[Reject with Reason]
      ↓
[Cancelled/Rejected] ───────────────→ Calendar: Still Available
```

## Notification Verification (If Applicable)

| Event             | Guest Notified? | Method    | Content Correct? |
| ----------------- | --------------- | --------- | ---------------- |
| Booking submitted | [ ]             | Email/SMS | [ ]              |
| Booking confirmed | [ ]             | Email/SMS | [ ]              |
| Booking rejected  | [ ]             | Email/SMS | [ ]              |

## Common Failure Patterns

1. **Pending Blocking Calendar**: Pending bookings shouldn't block dates
   - Check: Only Confirmed bookings should block
   - Impact: Reduces booking opportunities

2. **Rejection Leaves Ghost Block**: Rejected booking still blocks calendar
   - Check: Status correctly updates availability
   - Impact: Critical - dates unusable

3. **Status Lookup Fails**: Guest can't find booking status
   - Check: Reference number handling
   - Impact: Poor guest experience

4. **Missing Rejection Reason**: Guest doesn't know why rejected
   - Check: Reason field captured and displayed
   - Impact: Guest confusion

## Email/Notification Testing (Optional)

If email notifications are enabled:

| Step | Action                 | Expected Result                      | Pass/Fail |
| ---- | ---------------------- | ------------------------------------ | --------- |
| 1    | After guest submission | Confirmation email received          |           |
| 2    | After admin approval   | Confirmation email received          |           |
| 3    | After admin rejection  | Rejection email received with reason |           |

## Test Data Cleanup

After completing guest booking flow tests:

- [ ] Cancel/delete test bookings created
- [ ] Verify calendar shows test dates as available
- [ ] Remove any test guest records (if separate table)

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Test Bookings:
  Approval Flow:
    Reference: _______________
    Dates: _______________
    Unit: _______________
    Final Status: _______________

  Rejection Flow:
    Reference: _______________
    Dates: _______________
    Unit: _______________
    Final Status: _______________
    Rejection Reason: _______________

Calendar Sync Observations:
_________________________________
_________________________________

Guest Status Lookup Issues:
_________________________________
_________________________________

Notification Issues (if tested):
_________________________________
_________________________________

Total Test Duration: _______________
```
