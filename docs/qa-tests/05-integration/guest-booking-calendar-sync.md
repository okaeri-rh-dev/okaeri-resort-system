# QA Test: Guest Booking Calendar Synchronization

| Field              | Value            |
| ------------------ | ---------------- |
| **Test ID**        | INT-009          |
| **Priority**       | Critical         |
| **Roles Required** | Anonymous, Admin |
| **Estimated Time** | 15 minutes       |

## Objective

Comprehensive verification that booking status changes properly affect both public and admin calendars, ensuring no double-booking is possible and availability accurately reflects booking states.

## Prerequisites

- [ ] At least 2 available units for testing
- [ ] Admin account ready (admin@okaeri.ph)
- [ ] Test payment proof image ready
- [ ] Browser DevTools open to monitor network requests
- [ ] Multiple browser windows for concurrent view testing

## Calendar State Matrix

This test verifies the following expected behaviors:

| Booking Status | Payment Status | Public Calendar | Admin Calendar            |
| -------------- | -------------- | --------------- | ------------------------- |
| Pending        | Pending        | Available       | Shows in queue            |
| Pending        | Verified       | Available       | Shows awaiting assignment |
| Pending        | Rejected       | Available       | Shows as rejected         |
| Confirmed      | Verified       | **Blocked**     | **Blocked**               |
| Cancelled      | Any            | Available       | Shows as cancelled        |

---

## Part A: Pending Booking (Not Blocking)

**Objective:** Verify pending bookings do NOT block calendar dates

### Setup

| Step | Action                              | Expected Result          | Pass/Fail |
| ---- | ----------------------------------- | ------------------------ | --------- |
| A.1  | Navigate to `/booking`              | Guest booking form loads |           |
| A.2  | Submit new booking (any valid data) | Booking created          |           |
| A.3  | Note booking reference              | Reference recorded       |           |
| A.4  | Note selected unit and dates        | Details recorded         |           |

**Record Details:**

- Booking Reference: `________________`
- Unit: `________________`
- Dates: `________________` to `________________`

### Verification

| Step | Action                                  | Expected Result               | Pass/Fail |
| ---- | --------------------------------------- | ----------------------------- | --------- |
| A.5  | Navigate to `/` (public calendar)       | Calendar loads                |           |
| A.6  | Check booked dates for the unit         | Unit still shows as available |           |
| A.7  | Try to start new booking for same dates | Form allows booking           |           |
| A.8  | Login as admin@okaeri.ph                | Admin dashboard loads         |           |
| A.9  | Navigate to `/admin/bookings/queue`     | Booking visible in queue      |           |
| A.10 | Check admin calendar for dates          | Dates not blocked             |           |

### Checkpoint A

- [ ] Pending booking does NOT block public calendar
- [ ] Other guests can potentially book same dates
- [ ] Admin queue shows pending booking

---

## Part B: Confirmed Booking (Blocking)

**Objective:** Verify confirmed bookings DO block calendar dates

### Approve the Pending Booking

| Step | Action                                 | Expected Result            | Pass/Fail |
| ---- | -------------------------------------- | -------------------------- | --------- |
| B.1  | Navigate to `/admin/bookings/queue`    | Queue loads                |           |
| B.2  | Click "Review Payment" on test booking | Payment review page loads  |           |
| B.3  | Click "Verify Payment"                 | Payment verified           |           |
| B.4  | Click "Assign Cabins"                  | Unit assignment page loads |           |
| B.5  | Select and confirm unit assignment     | Status: Confirmed          |           |

### Verification

| Step | Action                            | Expected Result                              | Pass/Fail |
| ---- | --------------------------------- | -------------------------------------------- | --------- |
| B.6  | Logout from admin                 | Logged out                                   |           |
| B.7  | Navigate to `/` (public calendar) | Calendar loads                               |           |
| B.8  | Check booked dates for the unit   | Unit now shows as **unavailable**            |           |
| B.9  | Navigate to `/booking`            | Booking form loads                           |           |
| B.10 | Try to select same unit/dates     | Form prevents selection or shows unavailable |           |
| B.11 | Login as admin@okaeri.ph          | Admin logged in                              |           |
| B.12 | Check admin bookings table        | Booking shows as confirmed                   |           |
| B.13 | Check admin calendar for dates    | Dates blocked on calendar                    |           |

### Checkpoint B

- [ ] Confirmed booking BLOCKS public calendar
- [ ] Same dates cannot be double-booked
- [ ] Admin calendar reflects the booking

---

## Part C: Cancelled Booking (Unblocking)

**Objective:** Verify cancelled bookings FREE UP calendar dates

### Cancel the Confirmed Booking

| Step | Action                        | Expected Result             | Pass/Fail |
| ---- | ----------------------------- | --------------------------- | --------- |
| C.1  | Navigate to `/admin/bookings` | Bookings table loads        |           |
| C.2  | Find the test booking         | Booking located             |           |
| C.3  | Open booking details          | Details panel opens         |           |
| C.4  | Click "Cancel Booking"        | Confirmation dialog appears |           |
| C.5  | Enter cancellation reason     | Reason required             |           |
| C.6  | Confirm cancellation          | Status: Cancelled           |           |

### Verification

| Step | Action                            | Expected Result                 | Pass/Fail |
| ---- | --------------------------------- | ------------------------------- | --------- |
| C.7  | Logout from admin                 | Logged out                      |           |
| C.8  | Navigate to `/` (public calendar) | Calendar loads                  |           |
| C.9  | Check previously booked dates     | Unit now shows as **available** |           |
| C.10 | Navigate to `/booking`            | Booking form loads              |           |
| C.11 | Try to book same unit/dates       | Form allows booking             |           |
| C.12 | Login as admin@okaeri.ph          | Admin logged in                 |           |
| C.13 | Check admin view                  | Booking shows cancelled         |           |
| C.14 | Check admin calendar              | Dates no longer blocked         |           |

### Checkpoint C

- [ ] Cancelled booking FREES calendar dates
- [ ] Same dates can now be booked
- [ ] Admin view shows cancelled status

---

## Part D: Real-time Synchronization

**Objective:** Verify calendar updates propagate in real-time

### Test Setup

| Step | Action                               | Expected Result           | Pass/Fail |
| ---- | ------------------------------------ | ------------------------- | --------- |
| D.1  | Open two browser windows             | Both windows open         |           |
| D.2  | Window 1: Navigate to `/` (calendar) | Public calendar displayed |           |
| D.3  | Window 2: Login as admin             | Admin dashboard displayed |           |
| D.4  | Note a specific available date/unit  | Date/unit recorded        |           |

### Synchronization Test

| Step | Action                                 | Expected Result            | Pass/Fail |
| ---- | -------------------------------------- | -------------------------- | --------- |
| D.5  | Window 2: Create and confirm a booking | Booking confirmed          |           |
| D.6  | Window 1: Refresh public calendar      | Calendar updates           |           |
| D.7  | Window 1: Check the booked dates       | Dates now show unavailable |           |
| D.8  | Window 2: Cancel the booking           | Booking cancelled          |           |
| D.9  | Window 1: Refresh public calendar      | Calendar updates           |           |
| D.10 | Window 1: Check the dates again        | Dates now show available   |           |

### Checkpoint D

- [ ] Calendar updates propagate after refresh
- [ ] Blocking and unblocking work in near real-time
- [ ] No stale data after page refresh

---

## Edge Case Tests

### E1: Overlapping Date Ranges

| Step | Action                              | Expected Result                | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------ | --------- |
| E1.1 | Create confirmed booking: Jan 10-15 | Booking confirmed              |           |
| E1.2 | Try to book same unit: Jan 12-18    | Should be blocked (overlap)    |           |
| E1.3 | Try to book same unit: Jan 5-12     | Should be blocked (overlap)    |           |
| E1.4 | Try to book same unit: Jan 11-14    | Should be blocked (contained)  |           |
| E1.5 | Try to book same unit: Jan 16-20    | Should be allowed (no overlap) |           |
| E1.6 | Try to book same unit: Jan 1-9      | Should be allowed (no overlap) |           |

### E2: Multi-Unit Availability

| Step | Action                                | Expected Result             | Pass/Fail |
| ---- | ------------------------------------- | --------------------------- | --------- |
| E2.1 | Confirm booking for Unit A: Jan 10-15 | Unit A blocked              |           |
| E2.2 | Check Unit B availability: Jan 10-15  | Unit B still available      |           |
| E2.3 | Confirm booking for Unit B: Jan 10-15 | Unit B now blocked          |           |
| E2.4 | Check public calendar for Jan 10-15   | Both units show unavailable |           |

### E3: Same-Day Check-out/Check-in

| Step | Action                                                  | Expected Result                       | Pass/Fail |
| ---- | ------------------------------------------------------- | ------------------------------------- | --------- |
| E3.1 | Confirm booking: Jan 10 (check-in) - Jan 15 (check-out) | Booking confirmed                     |           |
| E3.2 | Try new booking: Jan 15 (check-in) - Jan 20             | Should be allowed (same-day turnover) |           |
| E3.3 | Verify Jan 15 handling                                  | Jan 15 available for check-in         |           |

---

## Data Consistency Summary

| Scenario                           | Public Calendar | Admin Calendar  | Pass/Fail |
| ---------------------------------- | --------------- | --------------- | --------- |
| New pending booking                | Available       | Shows in queue  |           |
| Payment verified, not assigned     | Available       | Awaiting assign |           |
| Booking confirmed                  | Blocked         | Blocked         |           |
| Booking cancelled                  | Available       | Shows cancelled |           |
| Overlapping dates (different unit) | Available       | Available       |           |
| Overlapping dates (same unit)      | Blocked         | Blocked         |           |

## Expected Results

- Pending bookings never block calendar dates
- Only Confirmed bookings block calendar dates
- Cancelled bookings immediately free up dates
- Overlapping date ranges are properly detected
- Different units are independent
- Same-day turnover (check-out/check-in) is handled correctly
- Calendar updates propagate on page refresh

## Critical Path Summary

```
Status Transition          Calendar Impact
─────────────────          ───────────────
Pending → Pending          No change (Available)
Pending → Confirmed        Block dates
Confirmed → Cancelled      Unblock dates
Any → Any (different unit) No impact on other units
```

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Unit A tested: _______________
Unit B tested: _______________
Date ranges tested: _______________
Total Test Duration: _______________

Calendar Sync Issues:
_________________________________
_________________________________

Overlap Detection Issues:
_________________________________
_________________________________

Real-time Update Issues:
_________________________________
_________________________________
```
