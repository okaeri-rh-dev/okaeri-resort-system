# QA Test: Booking → Calendar Synchronization

| Field              | Value                                 |
| ------------------ | ------------------------------------- |
| **Test Category**  | Complex Integration                   |
| **Test IDs**       | INT-CAL-001, INT-CAL-002, INT-CAL-003 |
| **Priority**       | Critical                              |
| **Roles Required** | Admin + Anonymous                     |
| **Estimated Time** | 20 minutes                            |

## Overview

These tests verify that booking status changes (confirm, cancel, date modification) properly synchronize with the public calendar. When Admin confirms a booking, those dates should become unavailable in the public calendar. When cancelled, they should become available again.

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `<see password manager>`):
  - Admin: `jasonacido+admin@gmail.com`

## Prerequisites

- [ ] At least 2 available units for testing
- [ ] Two browser tabs/windows ready (Session A: Anonymous, Session B: Admin)
- [ ] Browser DevTools open to monitor network requests
- [ ] A Pending booking exists or can be created for testing

---

## INT-CAL-001: Booking Confirmation Reflects in Anonymous Calendar

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

When Admin confirms a Pending booking, the dates should immediately show as unavailable in the public calendar.

### Setup

**Test Booking Details:**

- Unit: `________________`
- Dates: `Feb 15-17, 2026` (or available test dates)
- Booking Reference: `________________`

### Test Steps

#### Phase 1: Verify Initial Availability (Anonymous)

| Step | Action                              | Expected Result                      | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------------ | --------- |
| 1    | Open anonymous browser tab          | Browser opens                        |           |
| 2    | Navigate to `/` (home page)         | Public calendar loads                |           |
| 3    | Select test unit (e.g., Cabin 1)    | Unit calendar displayed              |           |
| 4    | Check Feb 15-17 availability        | Dates show as AVAILABLE (green/open) |           |
| 5    | Note the visual indicator for dates | Available styling visible            |           |

#### Phase 2: Admin Confirms Booking

| Step | Action                        | Expected Result               | Pass/Fail |
| ---- | ----------------------------- | ----------------------------- | --------- |
| 6    | Open admin browser tab        | New tab opens                 |           |
| 7    | Navigate to `/login`          | Login page loads              |           |
| 8    | Login as Admin                | Redirect to dashboard         |           |
| 9    | Navigate to `/admin/bookings` | Bookings table loads          |           |
| 10   | Find the Pending booking      | Booking located in table      |           |
| 11   | Click Actions → Confirm       | Confirmation dialog appears   |           |
| 12   | Confirm the action            | Status changes to "Confirmed" |           |
| 13   | Verify status in table        | Shows "Confirmed" badge       |           |

#### Phase 3: Verify Calendar Updated (Anonymous)

| Step | Action                              | Expected Result                              | Pass/Fail |
| ---- | ----------------------------------- | -------------------------------------------- | --------- |
| 14   | Switch to anonymous tab             | Anonymous tab active                         |           |
| 15   | Refresh the page (F5)               | Calendar reloads                             |           |
| 16   | Check Feb 15-17 for same unit       | Dates show as UNAVAILABLE (red/blocked)      |           |
| 17   | Verify color/styling changed        | Different visual indicator                   |           |
| 18   | Try to start booking for same dates | Form prevents selection OR shows unavailable |           |

### Verification Checklist

- [ ] Admin can confirm booking successfully
- [ ] Status changes from Pending to Confirmed
- [ ] Public calendar reflects booking as unavailable within 5 seconds of refresh
- [ ] Color coding matches (booked dates show different color)
- [ ] Other units for same dates remain available
- [ ] User cannot select unavailable dates in booking form

### Verification SQL (Optional)

```sql
SELECT b.id, b.status, b.check_in_date, b.check_out_date, u.name
FROM bookings b
JOIN booking_units bu ON b.id = bu.booking_id
JOIN units u ON bu.unit_id = u.id
WHERE b.status = 'Confirmed'
  AND b.check_in_date = '2026-02-15';
```

---

## INT-CAL-002: Booking Cancellation Restores Calendar Availability

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

When Admin cancels a Confirmed booking, the dates should become available again in the public calendar.

### Preconditions

- [ ] INT-CAL-001 completed (have a confirmed booking blocking Feb 15-17)
- [ ] Same two browser tabs ready

### Test Steps

#### Phase 1: Verify Currently Blocked (Anonymous)

| Step | Action                            | Expected Result               | Pass/Fail |
| ---- | --------------------------------- | ----------------------------- | --------- |
| 1    | Switch to anonymous tab           | Tab active                    |           |
| 2    | Navigate to `/` (public calendar) | Calendar loads                |           |
| 3    | Check Feb 15-17 for test unit     | Dates show as UNAVAILABLE     |           |
| 4    | Note the blocked styling          | Red/blocked indicator visible |           |

#### Phase 2: Admin Cancels Booking

| Step | Action                        | Expected Result               | Pass/Fail |
| ---- | ----------------------------- | ----------------------------- | --------- |
| 5    | Switch to admin tab           | Admin tab active              |           |
| 6    | Navigate to `/admin/bookings` | Bookings table loads          |           |
| 7    | Find the Confirmed booking    | Booking located in table      |           |
| 8    | Click Actions → Cancel        | Cancellation dialog appears   |           |
| 9    | Enter cancellation reason     | Reason field accepts input    |           |
| 10   | Confirm cancellation          | Status changes to "Cancelled" |           |
| 11   | Verify status in table        | Shows "Cancelled" badge       |           |

#### Phase 3: Verify Calendar Freed (Anonymous)

| Step | Action                              | Expected Result                      | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------------ | --------- |
| 12   | Switch to anonymous tab             | Anonymous tab active                 |           |
| 13   | Refresh the page (F5)               | Calendar reloads                     |           |
| 14   | Check Feb 15-17 for same unit       | Dates show as AVAILABLE (green/open) |           |
| 15   | Verify color/styling restored       | Available indicator visible          |           |
| 16   | Try to start booking for same dates | Form allows selection                |           |

### Verification Checklist

- [ ] Admin can cancel booking with reason
- [ ] Status changes from Confirmed to Cancelled
- [ ] Public calendar shows dates as available after refresh
- [ ] No "ghost" bookings blocking availability
- [ ] User can now select the freed dates in booking form

---

## INT-CAL-003: Date Modification Updates Calendar

| Field          | Value  |
| -------------- | ------ |
| **Complexity** | Medium |
| **Priority**   | High   |

### Scenario

When Admin edits booking dates, old dates become available and new dates become unavailable.

### Preconditions

- [ ] Create a new Confirmed booking for Feb 20-22
- [ ] Two browser tabs ready

### Test Steps

#### Phase 1: Setup & Initial State

| Step | Action                              | Expected Result                     | Pass/Fail |
| ---- | ----------------------------------- | ----------------------------------- | --------- |
| 1    | **Admin**: Create booking Feb 20-22 | Booking created with Pending status |           |
| 2    | **Admin**: Confirm the booking      | Status: Confirmed                   |           |
| 3    | **Anonymous**: Check Feb 20-22      | Shows UNAVAILABLE                   |           |
| 4    | **Anonymous**: Check Feb 25-27      | Shows AVAILABLE                     |           |

**Record Initial State:**

- Original Dates: `Feb 20-22`
- New Dates: `Feb 25-27`
- Unit: `________________`

#### Phase 2: Admin Modifies Dates

| Step | Action                             | Expected Result              | Pass/Fail |
| ---- | ---------------------------------- | ---------------------------- | --------- |
| 5    | Navigate to `/admin/bookings`      | Bookings table loads         |           |
| 6    | Find the test booking              | Booking located              |           |
| 7    | Click Edit or open booking details | Edit form opens              |           |
| 8    | Change dates to Feb 25-27          | New dates accepted           |           |
| 9    | Save changes                       | Booking updated successfully |           |
| 10   | Verify new dates in table          | Shows Feb 25-27              |           |

#### Phase 3: Verify Calendar Reflects Changes

| Step | Action                          | Expected Result         | Pass/Fail |
| ---- | ------------------------------- | ----------------------- | --------- |
| 11   | **Anonymous**: Refresh calendar | Calendar reloads        |           |
| 12   | Check Feb 20-22 for same unit   | NOW shows AVAILABLE     |           |
| 13   | Check Feb 25-27 for same unit   | NOW shows UNAVAILABLE   |           |
| 14   | Try booking Feb 20-22           | Form allows selection   |           |
| 15   | Try booking Feb 25-27           | Form prevents selection |           |

### Verification Checklist

- [ ] Admin can edit booking dates successfully
- [ ] Old dates (Feb 20-22) become available
- [ ] New dates (Feb 25-27) become unavailable
- [ ] Calendar updates correctly after refresh
- [ ] Booking form respects new availability

---

## Summary Test Matrix

| Test ID     | Status Change         | Expected Calendar Impact        |
| ----------- | --------------------- | ------------------------------- |
| INT-CAL-001 | Pending → Confirmed   | Dates become BLOCKED            |
| INT-CAL-002 | Confirmed → Cancelled | Dates become AVAILABLE          |
| INT-CAL-003 | Dates modified        | Old dates FREE, new dates BLOCK |

## Common Failure Patterns

1. **Stale Cache**: Calendar doesn't update even after refresh
   - Check: Network tab for fresh API calls
   - Solution: Hard refresh (Ctrl+Shift+R)

2. **Delayed Sync**: Updates take more than 5 seconds
   - Check: Real-time subscription working
   - Note: Document actual delay time

3. **Partial Updates**: Some dates update, others don't
   - Check: Multi-day booking edge cases
   - Verify: All days in range affected

## Test Data Cleanup

After completing all calendar sync tests:

- [ ] Cancel any test bookings created
- [ ] Verify calendar shows all test dates as available
- [ ] Document any lingering blocked dates

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Units Tested:
  Unit A: _______________
  Unit B: _______________

Date Ranges Tested:
  Range 1: _______________
  Range 2: _______________

Total Test Duration: _______________

Issues Found:
_________________________________
_________________________________
_________________________________

Real-time Sync Observations:
_________________________________
_________________________________
```
