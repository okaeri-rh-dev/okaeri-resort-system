# QA Test: Concurrent Booking Conflict Handling

| Field              | Value                      |
| ------------------ | -------------------------- |
| **Test ID**        | INT-003                    |
| **Priority**       | Critical                   |
| **Roles Required** | Anonymous (2 users), Admin |
| **Estimated Time** | 15 minutes                 |

## Objective

Verify that the system correctly handles race conditions when multiple users attempt to book the same unit for overlapping dates simultaneously.

## Prerequisites

- [ ] Unit with available dates for testing
- [ ] Two separate browser sessions (different browsers or incognito)
- [ ] Admin access to verify results
- [ ] Note the unit and dates being tested

## Test Configuration

```
Unit Under Test: _______________
Test Dates: Check-in: _______________ Check-out: _______________
Browser 1: _______________
Browser 2: _______________
```

---

## Test Scenario 1: Simultaneous Submission

### Setup

| Step | Action                         | Browser   | Result         |
| ---- | ------------------------------ | --------- | -------------- | --- |
| 1    | Open public booking page       | Browser 1 | Page loads     |     |
| 2    | Open public booking page       | Browser 2 | Page loads     |     |
| 3    | Select same unit               | Both      | Unit selected  |     |
| 4    | Select same dates              | Both      | Dates selected |     |
| 5    | Fill guest details (different) | Both      | Forms filled   |     |

### Browser 1 Guest Details

```
Name: "Race Test User A"
Email: "race-a@example.com"
Phone: "09171111111"
```

### Browser 2 Guest Details

```
Name: "Race Test User B"
Email: "race-b@example.com"
Phone: "09172222222"
```

### Simultaneous Submission

| Step | Action                              | Expected Result           | Pass/Fail |
| ---- | ----------------------------------- | ------------------------- | --------- |
| 6    | Prepare to submit (don't click yet) | Both browsers ready       |           |
| 7    | Click submit on both simultaneously | Race condition created    |           |
| 8    | Observe Browser 1 result            | Success OR conflict error |           |
| 9    | Observe Browser 2 result            | Success OR conflict error |           |
| 10   | Verify only ONE booking created     | Single booking exists     |           |

### Expected Outcomes

| Outcome            | Description                                  | Occurred |
| ------------------ | -------------------------------------------- | -------- |
| First Wins         | First submission succeeds, second gets error | [ ]      |
| Optimistic Lock    | Both see conflict, asked to refresh          | [ ]      |
| Graceful Error     | One succeeds, other gets "dates unavailable" | [ ]      |
| Both Succeed (BUG) | Both bookings created - DOUBLE BOOKING       | [ ]      |

### Result Recording

```
Browser 1 Result: [ ] Success  [ ] Error  [ ] Pending
Browser 2 Result: [ ] Success  [ ] Error  [ ] Pending

Error Message (if any): _______________
Successful Booking Reference: _______________
```

---

## Test Scenario 2: Overlapping Date Ranges

### Setup

| Browser   | Check-in | Check-out | Overlap Type |
| --------- | -------- | --------- | ------------ |
| Browser 1 | Jan 15   | Jan 20    | Base range   |
| Browser 2 | Jan 18   | Jan 22    | Overlaps end |

### Execution

| Step | Action                             | Expected                | Pass/Fail |
| ---- | ---------------------------------- | ----------------------- | --------- |
| 1    | Browser 1 books Jan 15-20 first    | Booking succeeds        |           |
| 2    | Browser 2 attempts Jan 18-22       | Error: Dates conflict   |           |
| 3    | Verify error message is clear      | Shows conflicting dates |           |
| 4    | Verify calendar shows booked dates | Jan 15-20 blocked       |           |

---

## Test Scenario 3: Adjacent Dates (No Conflict)

### Setup

| Browser   | Check-in | Check-out | Expected                             |
| --------- | -------- | --------- | ------------------------------------ |
| Browser 1 | Jan 15   | Jan 17    | Should succeed                       |
| Browser 2 | Jan 17   | Jan 19    | Should succeed (checkout=checkin OK) |

### Execution

| Step | Action                      | Expected                        | Pass/Fail |
| ---- | --------------------------- | ------------------------------- | --------- |
| 1    | Browser 1 books Jan 15-17   | Booking succeeds                |           |
| 2    | Browser 2 books Jan 17-19   | Booking succeeds                |           |
| 3    | Verify both bookings exist  | Two separate bookings           |           |
| 4    | Verify no overlap in system | Calendar shows continuous block |           |

---

## Test Scenario 4: Same User Different Tabs

### Setup

Test if same user can accidentally double-book:

| Step | Action                          | Expected              | Pass/Fail |
| ---- | ------------------------------- | --------------------- | --------- |
| 1    | Open booking form in Tab 1      | Form loads            |           |
| 2    | Open same booking form in Tab 2 | Form loads            |           |
| 3    | Fill same dates in both tabs    | Forms filled          |           |
| 4    | Submit Tab 1                    | Booking succeeds      |           |
| 5    | Submit Tab 2                    | Error: Already booked |           |

---

## Test Scenario 5: Admin Override Conflict

### Setup

Anonymous user and admin try to book same slot:

| Step | Action                               | Expected                         | Pass/Fail |
| ---- | ------------------------------------ | -------------------------------- | --------- |
| 1    | Anonymous fills booking form         | Form ready                       |           |
| 2    | Admin creates booking for same dates | Admin booking created            |           |
| 3    | Anonymous submits                    | Error: Dates no longer available |           |
| 4    | Verify admin booking persists        | Admin booking intact             |           |

---

## Data Integrity Verification

### After All Tests - Admin Check

**Login as Admin**

| Check | Action                          | Expected                          | Pass/Fail |
| ----- | ------------------------------- | --------------------------------- | --------- |
| 1     | List all bookings for test unit | See all test bookings             |           |
| 2     | Verify no double bookings       | No overlapping confirmed bookings |           |
| 3     | Check availability calendar     | Properly reflects bookings        |           |
| 4     | Review any error/conflict logs  | Conflicts logged appropriately    |           |

### Database Consistency (if accessible)

| Query                             | Expected Result            | Pass/Fail |
| --------------------------------- | -------------------------- | --------- |
| Count bookings for test unit      | Matches UI count           |           |
| Check for overlapping date ranges | None found (for same unit) |           |
| Verify booking statuses           | Appropriate statuses set   |           |

---

## Error Message Quality

| Scenario                 | Error Message Shown | Is It Clear?   | Pass/Fail |
| ------------------------ | ------------------- | -------------- | --------- |
| Same dates conflict      |                     | [ ] Yes [ ] No |           |
| Overlapping dates        |                     | [ ] Yes [ ] No |           |
| Unit no longer available |                     | [ ] Yes [ ] No |           |

Good error messages should:

- [ ] Clearly state the dates are unavailable
- [ ] Suggest alternative dates if possible
- [ ] Not expose technical/database errors
- [ ] Provide a clear next action

---

## Performance Under Conflict

| Metric                            | Observed Value | Acceptable | Pass/Fail |
| --------------------------------- | -------------- | ---------- | --------- |
| Time to conflict detection        | \_\_\_ ms      | < 2000ms   |           |
| UI responsiveness during conflict |                | Not frozen |           |
| Error display time                | \_\_\_ ms      | < 1000ms   |           |

## Expected Results

- System prevents double bookings for same unit/dates
- Race conditions result in one success, one failure
- Error messages are clear and helpful
- Adjacent bookings (checkout=checkin) are allowed
- Calendar/availability updates reflect new bookings
- No data corruption under concurrent access

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Unit ID: _______________
Test Date Range: _______________

Double Booking Detected: [ ] Yes (BUG!)  [ ] No (Correct)

Conflict Handling Method Observed:
[ ] First-wins with error for second
[ ] Optimistic locking with refresh prompt
[ ] Real-time availability check
[ ] Other: _______________

Issues Found:
_________________________________
_________________________________
```
