# QA Test: Real-time Multi-User Updates

| Field              | Value                        |
| ------------------ | ---------------------------- |
| **Test Category**  | Complex Integration          |
| **Test IDs**       | INT-MULTI-001, INT-MULTI-002 |
| **Priority**       | High / Critical              |
| **Roles Required** | Admin + Staff, Anonymous x2  |
| **Estimated Time** | 20 minutes                   |

## Overview

These tests verify that changes made by one user are properly visible to other users viewing the same data. This includes cross-role synchronization and concurrent booking conflict detection.

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `12345678`):
  - Staff: `jasonacido+staff@gmail.com`
  - Admin: `jasonacido+admin@gmail.com`

## Prerequisites

- [ ] Two browser windows/tabs ready
- [ ] Staff and Admin accounts available
- [ ] Browser DevTools open to monitor network requests
- [ ] Understanding of real-time update expectations (refresh vs live)

---

## INT-MULTI-001: Staff Sees Admin's Booking Changes

| Field          | Value |
| -------------- | ----- |
| **Complexity** | High  |
| **Priority**   | High  |

### Scenario

Changes made by Admin should be visible to Staff viewing the same data after refresh or via real-time updates.

### Test Configuration

```
Session A (Staff): Browser Tab 1
Session B (Admin): Browser Tab 2 or different browser

Test Booking: _______________
Initial Status: Pending
```

### Test Steps

#### Phase 1: Setup Both Sessions

| Step | Action                                   | Expected Result       | Pass/Fail |
| ---- | ---------------------------------------- | --------------------- | --------- |
| 1    | **Tab 1**: Open browser tab              | Tab opens             |           |
| 2    | **Tab 1**: Navigate to `/login`          | Login page loads      |           |
| 3    | **Tab 1**: Login as Staff                | Staff dashboard loads |           |
| 4    | **Tab 1**: Navigate to `/admin/bookings` | Bookings table loads  |           |
| 5    | **Tab 2**: Open second browser tab       | Tab opens             |           |
| 6    | **Tab 2**: Navigate to `/login`          | Login page loads      |           |
| 7    | **Tab 2**: Login as Admin                | Admin dashboard loads |           |
| 8    | **Tab 2**: Navigate to `/admin/bookings` | Bookings table loads  |           |

#### Phase 2: Staff Notes Initial State

| Step | Action                                    | Expected Result          | Pass/Fail |
| ---- | ----------------------------------------- | ------------------------ | --------- |
| 9    | **Tab 1 (Staff)**: Find a Pending booking | Booking visible          |           |
| 10   | **Tab 1 (Staff)**: Note booking reference | Ref: ******\_\_\_******  |           |
| 11   | **Tab 1 (Staff)**: Note current status    | Status: Pending          |           |
| 12   | **Tab 1 (Staff)**: Note timestamp         | Time: ******\_\_\_****** |           |

#### Phase 3: Admin Makes Changes

| Step | Action                                     | Expected Result               | Pass/Fail |
| ---- | ------------------------------------------ | ----------------------------- | --------- |
| 13   | **Tab 2 (Admin)**: Find same booking       | Booking visible               |           |
| 14   | **Tab 2 (Admin)**: Click Actions → Confirm | Confirmation dialog appears   |           |
| 15   | **Tab 2 (Admin)**: Confirm action          | Status changes to "Confirmed" |           |
| 16   | **Tab 2 (Admin)**: Verify in table         | Shows Confirmed badge         |           |
| 17   | Note timestamp of change                   | Time: ******\_\_\_******      |           |

#### Phase 4: Staff Sees Update

| Step | Action                               | Expected Result                       | Pass/Fail |
| ---- | ------------------------------------ | ------------------------------------- | --------- |
| 18   | **Tab 1 (Staff)**: Refresh page (F5) | Page reloads                          |           |
| 19   | **Tab 1 (Staff)**: Find same booking | Booking visible                       |           |
| 20   | **Tab 1 (Staff)**: Check status      | NOW shows "Confirmed"                 |           |
| 21   | Measure time delta                   | Update visible within: \_\_\_ seconds |           |

### Real-time Check (Optional)

If the system has real-time updates (without refresh):

| Step | Action                                 | Expected Result                    | Pass/Fail |
| ---- | -------------------------------------- | ---------------------------------- | --------- |
| 22   | **Tab 2 (Admin)**: Make another change | Status changes                     |           |
| 23   | **Tab 1 (Staff)**: DO NOT refresh      | Wait for auto-update               |           |
| 24   | **Tab 1 (Staff)**: Observe status      | Updates automatically within 5 sec |           |

### Verification Checklist

- [ ] Staff sees initial booking status correctly
- [ ] Admin can change booking status
- [ ] Staff sees updated status after refresh
- [ ] No stale data displayed
- [ ] Timestamps update correctly
- [ ] (Optional) Real-time updates work without refresh

### Update Timing Results

| Update Type        | Time to Visibility | Acceptable? |
| ------------------ | ------------------ | ----------- |
| After page refresh | \_\_\_ seconds     | [ ] Yes     |
| Real-time (if any) | \_\_\_ seconds     | [ ] Yes     |

---

## INT-MULTI-002: Concurrent Booking Conflict Detection

| Field          | Value     |
| -------------- | --------- |
| **Complexity** | Very High |
| **Priority**   | Critical  |

### Scenario

Two users attempting to book the same unit for overlapping dates - only one should succeed. This tests the system's conflict detection and prevention.

### Test Configuration

```
Session A (User A): Browser Tab 1 or Browser 1
Session B (User B): Browser Tab 2 or Browser 2 (incognito)

Target Unit: _______________
Overlapping Dates:
  User A: Feb 10-12, 2026
  User B: Feb 11-13, 2026 (overlaps Feb 11-12)
```

### Test Setup

| Step | Action                             | Expected Result             | Pass/Fail |
| ---- | ---------------------------------- | --------------------------- | --------- |
| 1    | Verify unit is available Feb 10-13 | Calendar shows available    |           |
| 2    | Open two browser windows/incognito | Two separate sessions ready |           |
| 3    | Both navigate to `/booking`        | Guest booking forms load    |           |

### Test Steps

#### Phase 1: Both Users Start Booking Flow

| Step | Action                             | Expected Result                 | Pass/Fail |
| ---- | ---------------------------------- | ------------------------------- | --------- |
| 4    | **User A**: Select target unit     | Unit selected                   |           |
| 5    | **User A**: Select dates Feb 10-12 | Dates selected, shows available |           |
| 6    | **User A**: Fill guest information | Form fields populated           |           |
| 7    | **User A**: DO NOT submit yet      | Form ready to submit            |           |
| 8    | **User B**: Select same unit       | Unit selected                   |           |
| 9    | **User B**: Select dates Feb 11-13 | Dates selected, shows available |           |
| 10   | **User B**: Fill guest information | Form fields populated           |           |
| 11   | **User B**: DO NOT submit yet      | Form ready to submit            |           |

#### Phase 2: User A Submits First

| Step | Action                             | Expected Result              | Pass/Fail |
| ---- | ---------------------------------- | ---------------------------- | --------- |
| 12   | **User A**: Click Submit           | Form submits                 |           |
| 13   | **User A**: Wait for confirmation  | Booking created successfully |           |
| 14   | **User A**: Note booking reference | Ref: ******\_\_\_******      |           |
| 15   | **User A**: Note submission time   | Time: ******\_\_\_******     |           |

#### Phase 3: User B Attempts Overlapping Booking

| Step | Action                         | Expected Result                      | Pass/Fail |
| ---- | ------------------------------ | ------------------------------------ | --------- |
| 16   | **User B**: Click Submit       | Form submits                         |           |
| 17   | **User B**: Observe result     | One of the following:                |           |
|      |                                | a) Error: Dates no longer available  |           |
|      |                                | b) Conflict warning message          |           |
|      |                                | c) Redirect with availability notice |           |
| 18   | **User B**: Note error message | Message: ******\_\_\_******          |           |

### Expected Outcomes

| User   | Action        | Expected Result                  | Actual Result |
| ------ | ------------- | -------------------------------- | ------------- |
| User A | Submit first  | Booking SUCCESS                  |               |
| User B | Submit second | Booking FAIL (conflict detected) |               |

### Conflict Detection Analysis

| Check                                              | Result | Pass/Fail |
| -------------------------------------------------- | ------ | --------- |
| Only ONE booking created for overlapping dates     |        |           |
| User B received clear error message                |        |           |
| No double-booking occurred                         |        |           |
| Calendar shows correct availability after conflict |        |           |
| Error message explains why booking failed          |        |           |

### Post-Conflict Verification

| Step | Action                              | Expected Result                      | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------------ | --------- |
| 19   | Check public calendar for Feb 10-12 | Shows UNAVAILABLE (User A's booking) |           |
| 20   | Check public calendar for Feb 13    | Shows AVAILABLE (no booking)         |           |
| 21   | Login as Admin, check bookings      | Only ONE booking for the date range  |           |
| 22   | Verify no duplicate entries         | Single booking record only           |           |

### Verification Checklist

- [ ] First submission succeeds with confirmation
- [ ] Second submission fails with clear error message
- [ ] No double-booking occurs in database
- [ ] Calendar reflects correct availability post-conflict
- [ ] Error message is user-friendly and explains the issue
- [ ] System maintains data integrity

---

## Race Condition Scenarios

### Scenario Matrix

| Race Condition                | Expected Behavior              | Tested? |
| ----------------------------- | ------------------------------ | ------- |
| Exact same dates, same unit   | Second submission fails        | [ ]     |
| Overlapping dates, same unit  | Second submission fails        | [ ]     |
| Adjacent dates, same unit     | Both succeed (no overlap)      | [ ]     |
| Same dates, different units   | Both succeed (different units) | [ ]     |
| Near-simultaneous submissions | Only one succeeds              | [ ]     |

### Extreme Timing Test

| Step | Action                              | Expected Result                  | Pass/Fail |
| ---- | ----------------------------------- | -------------------------------- | --------- |
| 1    | Coordinate near-simultaneous submit | Both users click within 1 second |           |
| 2    | Observe both results                | One success, one failure         |           |
| 3    | Check database for duplicates       | No duplicates exist              |           |

## Common Failure Patterns

1. **Double Booking Created**: Both submissions succeed
   - Root cause: Missing database constraints or transaction isolation
   - Impact: Critical - data integrity compromised

2. **Both Submissions Fail**: Neither user can book
   - Root cause: Overly aggressive locking
   - Impact: Medium - poor user experience

3. **Unclear Error Message**: User doesn't understand why booking failed
   - Root cause: Poor error handling
   - Impact: Low - UX issue

4. **Stale Availability**: Second user's form showed available but booking fails
   - Root cause: Cache not invalidated
   - Impact: Medium - UX issue

## Technical Considerations

### Database Level

- [ ] UNIQUE constraint on (unit_id, date range overlap)
- [ ] Transaction isolation level appropriate
- [ ] Optimistic vs pessimistic locking strategy

### Application Level

- [ ] Availability checked before and during submission
- [ ] Proper error handling for constraint violations
- [ ] Clear user messaging on conflicts

## Test Data Cleanup

After completing multi-user sync tests:

- [ ] Cancel test bookings created
- [ ] Verify overlapping dates now available
- [ ] Confirm no orphaned booking records

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Browser Configuration:
  Session A: _______________ (Browser/Tab)
  Session B: _______________ (Browser/Tab)

Test Unit: _______________

Booking Attempts:
  User A: Dates _______________, Result: _______________
  User B: Dates _______________, Result: _______________

Conflict Detection Results:
_________________________________
_________________________________

Race Condition Observations:
_________________________________
_________________________________

Total Test Duration: _______________

Issues Found:
_________________________________
_________________________________
```
