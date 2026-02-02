# QA Test: Guest Booking Approval Flow (End-to-End)

| Field              | Value            |
| ------------------ | ---------------- |
| **Test ID**        | INT-007          |
| **Priority**       | Critical         |
| **Roles Required** | Anonymous, Admin |
| **Estimated Time** | 25 minutes       |

## Objective

Verify the complete happy path from anonymous guest submission through admin approval: guest submits booking → admin verifies payment → admin assigns cabin → booking confirmed → calendars updated.

## Prerequisites

- [ ] At least 1 available unit for the test date range
- [ ] Admin account ready (admin@okaeri.ph)
- [ ] Test payment proof image (JPG/PNG, < 2MB)
- [ ] Browser DevTools open to monitor network requests
- [ ] Multiple browser windows/incognito for role switching

## Test Flow Overview

```
Anonymous Guest                    Admin
      ↓                              ↓
  Submit Booking ────────────> View in Queue
      ↓                              ↓
  Get Reference              Review Payment
      ↓                              ↓
  Check Status               Verify Payment
      ↓                              ↓
  Status: Pending            Assign Unit
      ↓                              ↓
  Status: Confirmed <─────── Booking Complete
      ↓                              ↓
  Calendar Blocked <──────── Calendar Updated
```

---

## Phase 1: Anonymous Guest Submits Booking

**Role: Anonymous (Public Portal)**

| Step | Action                                | Expected Result               | Pass/Fail |
| ---- | ------------------------------------- | ----------------------------- | --------- |
| 1.1  | Navigate to `/` (home)                | Public calendar loads         |           |
| 1.2  | Verify available dates shown          | Calendar shows bookable dates |           |
| 1.3  | Note a specific date range            | Record dates for verification |           |
| 1.4  | Navigate to `/booking`                | Guest booking form loads      |           |
| 1.5  | Fill guest name: "Test E2E Guest"     | Field accepts input           |           |
| 1.6  | Fill email: "test-e2e@example.com"    | Field accepts valid email     |           |
| 1.7  | Fill phone: "+63 917 123 4567"        | Field accepts PH format       |           |
| 1.8  | Select available unit                 | Unit dropdown populated       |           |
| 1.9  | Select check-in date (future)         | Date picker works             |           |
| 1.10 | Select check-out date                 | Must be after check-in        |           |
| 1.11 | Enter guest count: 2                  | Within unit capacity          |           |
| 1.12 | Enter special request: "Test booking" | Optional field accepts text   |           |
| 1.13 | Upload payment proof image            | File uploaded, preview shown  |           |
| 1.14 | Complete Turnstile CAPTCHA            | CAPTCHA verified              |           |
| 1.15 | Click "Submit Booking"                | Loading state shown           |           |
| 1.16 | Wait for confirmation                 | Success message displayed     |           |
| 1.17 | Note booking reference                | Format: BK-YYYY-XXXXXX        |           |

**Record the booking reference:** `________________`

**Record selected dates:** `________________` to `________________`

**Record selected unit:** `________________`

### Checkpoint A

- [ ] Booking reference received
- [ ] Guest sees confirmation page
- [ ] No console errors in DevTools

---

## Phase 2: Verify Booking Status (Guest View)

**Role: Anonymous (Public Portal)**

| Step | Action                              | Expected Result          | Pass/Fail |
| ---- | ----------------------------------- | ------------------------ | --------- |
| 2.1  | Navigate to `/booking/check-status` | Status lookup form loads |           |
| 2.2  | Enter booking reference             | Field accepts reference  |           |
| 2.3  | Enter email used in booking         | Field accepts email      |           |
| 2.4  | Click "Check Status"                | Status retrieved         |           |
| 2.5  | Verify booking_status: "Pending"    | Status shows pending     |           |
| 2.6  | Verify payment_status: "Pending"    | Payment not yet verified |           |

### Checkpoint B

- [ ] Guest can track their booking
- [ ] Status correctly shows Pending
- [ ] Guest details displayed correctly

---

## Phase 3: Admin Reviews Pending Booking

**Role: Admin (Login as admin@okaeri.ph)**

| Step | Action                              | Expected Result                  | Pass/Fail |
| ---- | ----------------------------------- | -------------------------------- | --------- |
| 3.1  | Login as admin@okaeri.ph            | Admin dashboard loads            |           |
| 3.2  | Navigate to `/admin/bookings/queue` | Pending queue loads              |           |
| 3.3  | Locate test booking by reference    | Booking visible in queue         |           |
| 3.4  | Verify urgency indicator shown      | Badge visible (based on time)    |           |
| 3.5  | Verify guest name displayed         | "Test E2E Guest" shown           |           |
| 3.6  | Verify dates displayed              | Correct check-in/out dates       |           |
| 3.7  | Verify payment_status: "Pending"    | Payment needs review             |           |
| 3.8  | Click "Review Payment" button       | Navigates to verify-payment page |           |

### Checkpoint C

- [ ] Admin can see pending booking in queue
- [ ] All guest details are accurate
- [ ] Navigation to payment review works

---

## Phase 4: Admin Verifies Payment

**Role: Admin (continuing)**

| Step | Action                                | Expected Result                 | Pass/Fail |
| ---- | ------------------------------------- | ------------------------------- | --------- |
| 4.1  | On `/admin/verify-payment/{id}`       | Payment review page loads       |           |
| 4.2  | View payment proof image              | Uploaded image displayed        |           |
| 4.3  | View booking details                  | Dates, amount, guest info shown |           |
| 4.4  | Click "Verify Payment"                | Confirmation dialog appears     |           |
| 4.5  | Confirm verification                  | Success toast displayed         |           |
| 4.6  | Verify payment_status changed         | Now shows "Verified"            |           |
| 4.7  | Verify "Assign Cabins" button appears | Action available after verify   |           |

### Checkpoint D

- [ ] Payment successfully verified
- [ ] UI reflects status change
- [ ] Assign Cabins action becomes available

---

## Phase 5: Admin Assigns Unit

**Role: Admin (continuing)**

| Step | Action                             | Expected Result              | Pass/Fail |
| ---- | ---------------------------------- | ---------------------------- | --------- |
| 5.1  | Click "Assign Cabins" button       | Unit assignment page loads   |           |
| 5.2  | Verify available units listed      | Units for date range shown   |           |
| 5.3  | Select appropriate unit            | Unit checkbox/radio selected |           |
| 5.4  | Click "Confirm Assignment"         | Processing indicator shown   |           |
| 5.5  | Wait for confirmation              | Success message displayed    |           |
| 5.6  | Verify booking_status: "Confirmed" | Status changed               |           |
| 5.7  | Verify unit_assignment_status      | Shows "assigned"             |           |

### Checkpoint E

- [ ] Unit successfully assigned
- [ ] Booking status changed to Confirmed
- [ ] Assignment reflected in booking details

---

## Phase 6: Verify Booking in Admin Table

**Role: Admin (continuing)**

| Step | Action                          | Expected Result           | Pass/Fail |
| ---- | ------------------------------- | ------------------------- | --------- |
| 6.1  | Navigate to `/admin/bookings`   | Bookings table loads      |           |
| 6.2  | Search for booking reference    | Booking found in table    |           |
| 6.3  | Verify status shows "Confirmed" | Green/confirmed indicator |           |
| 6.4  | Verify payment shows "Verified" | Payment column correct    |           |
| 6.5  | Verify unit name displayed      | Assigned unit shown       |           |
| 6.6  | Verify dates correct            | Check-in/out as submitted |           |

### Checkpoint F

- [ ] Booking visible in main bookings table
- [ ] All statuses correctly displayed
- [ ] Data consistency maintained

---

## Phase 7: Verify Calendar Updates

**Role: Anonymous then Admin**

| Step | Action                            | Expected Result              | Pass/Fail |
| ---- | --------------------------------- | ---------------------------- | --------- |
| 7.1  | Logout from admin                 | Logged out                   |           |
| 7.2  | Navigate to `/` (public calendar) | Public calendar loads        |           |
| 7.3  | Navigate to booked date range     | Dates visible                |           |
| 7.4  | Verify unit shows as booked       | Unit unavailable for dates   |           |
| 7.5  | Try to book same unit/dates       | Should show unavailable      |           |
| 7.6  | Login as admin@okaeri.ph          | Admin logged in              |           |
| 7.7  | View admin calendar/bookings      | Admin view loads             |           |
| 7.8  | Verify booking appears on dates   | Visual indicator on calendar |           |

### Checkpoint G

- [ ] Public calendar shows dates as blocked
- [ ] Same dates cannot be double-booked
- [ ] Admin calendar reflects the booking

---

## Phase 8: Guest Verifies Updated Status

**Role: Anonymous (Final Verification)**

| Step | Action                              | Expected Result     | Pass/Fail |
| ---- | ----------------------------------- | ------------------- | --------- |
| 8.1  | Logout from admin                   | Logged out          |           |
| 8.2  | Navigate to `/booking/check-status` | Status lookup loads |           |
| 8.3  | Enter booking reference             | Reference entered   |           |
| 8.4  | Enter email                         | Email entered       |           |
| 8.5  | Click "Check Status"                | Status retrieved    |           |
| 8.6  | Verify booking_status: "Confirmed"  | Shows confirmed     |           |
| 8.7  | Verify payment_status: "Verified"   | Payment confirmed   |           |
| 8.8  | Verify unit name displayed          | Assigned unit shown |           |

### Final Checkpoint

- [ ] Guest can see updated confirmed status
- [ ] All booking details accurate
- [ ] Complete end-to-end flow verified

---

## Data Consistency Checks

| Check                             | Expected   | Actual | Pass/Fail |
| --------------------------------- | ---------- | ------ | --------- |
| Booking status: Confirmed         | Yes        |        |           |
| Payment status: Verified          | Yes        |        |           |
| Unit properly assigned            | Yes        |        |           |
| Calendar dates blocked            | Yes        |        |           |
| Guest status view shows confirmed | Yes        |        |           |
| Audit trail has all actions       | 4+ entries |        |           |
| No duplicate bookings possible    | Yes        |        |           |

## Cleanup

| Action                            | Notes                |
| --------------------------------- | -------------------- |
| Delete test booking               | Or mark as test data |
| Verify unit availability restored | If booking deleted   |
| Clear any test audit entries      | Optional             |

## Expected Results

- Anonymous guest can successfully submit booking with payment proof
- Admin can review pending bookings in queue
- Payment verification process works correctly
- Unit assignment updates booking status to Confirmed
- Calendar blocking works for confirmed bookings
- Guest can track booking status throughout the process
- All state changes are properly synchronized

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Booking Reference: _______________
Selected Unit: _______________
Date Range: _______________ to _______________
Total Test Duration: _______________

Issues Found:
_________________________________
_________________________________

State Transition Issues:
_________________________________
_________________________________

Calendar Sync Issues:
_________________________________
_________________________________
```
