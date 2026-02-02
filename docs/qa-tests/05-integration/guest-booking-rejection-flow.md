# QA Test: Guest Booking Rejection Flow (End-to-End)

| Field              | Value            |
| ------------------ | ---------------- |
| **Test ID**        | INT-008          |
| **Priority**       | High             |
| **Roles Required** | Anonymous, Admin |
| **Estimated Time** | 18 minutes       |

## Objective

Verify the rejection path: anonymous guest submits booking → admin rejects payment → booking remains pending → calendars remain unaffected (dates still bookable).

## Prerequisites

- [ ] At least 1 available unit for the test date range
- [ ] Admin account ready (admin@okaeri.ph)
- [ ] Invalid/poor quality payment proof for rejection scenario
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
  Check Status               Reject Payment
      ↓                              ↓
  Status: Pending            Enter Reason
      ↓                              ↓
  payment_status: Rejected <─ Rejection Complete
      ↓                              ↓
  Calendar: UNCHANGED ──────> Unit Still Available
```

---

## Phase 1: Submit Booking with Invalid Payment (Anonymous)

**Role: Anonymous (Public Portal)**

| Step | Action                                | Expected Result             | Pass/Fail |
| ---- | ------------------------------------- | --------------------------- | --------- |
| 1.1  | Navigate to `/booking`                | Guest booking form loads    |           |
| 1.2  | Fill guest name: "Test Reject Guest"  | Field accepts input         |           |
| 1.3  | Fill email: "test-reject@example.com" | Field accepts email         |           |
| 1.4  | Fill phone: "+63 918 999 8888"        | Field accepts phone         |           |
| 1.5  | Select available unit                 | Unit selected               |           |
| 1.6  | Select check-in/out dates             | Dates selected              |           |
| 1.7  | Enter guest count: 2                  | Count entered               |           |
| 1.8  | Upload blurry/invalid payment proof   | File uploaded               |           |
| 1.9  | Complete CAPTCHA                      | CAPTCHA passed              |           |
| 1.10 | Submit booking                        | Success, reference received |           |
| 1.11 | Note booking reference                | Record for later            |           |

**Record the booking reference:** `________________`

**Record selected unit:** `________________`

**Record selected dates:** `________________` to `________________`

### Checkpoint A

- [ ] Booking submitted successfully
- [ ] Reference number received
- [ ] Questionable payment proof uploaded

---

## Phase 2: Note Calendar State Before Rejection

**Role: Anonymous (Public Portal)**

| Step | Action                            | Expected Result           | Pass/Fail |
| ---- | --------------------------------- | ------------------------- | --------- |
| 2.1  | Navigate to `/` (public calendar) | Calendar loads            |           |
| 2.2  | Check selected dates for unit     | Note current availability |           |
| 2.3  | Record: Is unit available?        | Should still be available |           |

**Pre-rejection calendar state:** Unit is [ ] Available [ ] Blocked

### Checkpoint B

- [ ] Calendar state recorded
- [ ] Pending booking does NOT block calendar (expected behavior)

---

## Phase 3: Admin Rejects Payment

**Role: Admin (Login as admin@okaeri.ph)**

| Step | Action                                  | Expected Result              | Pass/Fail |
| ---- | --------------------------------------- | ---------------------------- | --------- |
| 3.1  | Login as admin@okaeri.ph                | Admin dashboard loads        |           |
| 3.2  | Navigate to `/admin/bookings/queue`     | Queue loads                  |           |
| 3.3  | Locate "Test Reject Guest" booking      | Booking found                |           |
| 3.4  | Click "Review Payment"                  | Verify payment page loads    |           |
| 3.5  | View payment proof                      | Blurry/invalid image shown   |           |
| 3.6  | Click "Reject Payment" button           | Rejection dialog appears     |           |
| 3.7  | **Verify reason is required**           | Cannot submit without reason |           |
| 3.8  | Enter reason: "Payment proof illegible" | Reason field accepts text    |           |
| 3.9  | Confirm rejection                       | Processing indicator         |           |
| 3.10 | Verify success message                  | "Payment rejected" toast     |           |
| 3.11 | Verify payment_status: "Rejected"       | Status changed to Rejected   |           |

### Checkpoint C

- [ ] Payment rejected successfully
- [ ] Rejection reason was required
- [ ] Status updated to Rejected

---

## Phase 4: Verify Booking Cannot Proceed

**Role: Admin (continuing)**

| Step | Action                                              | Expected Result                  | Pass/Fail |
| ---- | --------------------------------------------------- | -------------------------------- | --------- |
| 4.1  | Check for "Assign Cabins" button                    | Button NOT visible               |           |
| 4.2  | Try direct URL: `/admin/bookings/{id}/assign-units` | Access blocked or error          |           |
| 4.3  | Verify message about payment status                 | "Payment must be verified first" |           |

### Checkpoint D

- [ ] Unit assignment is blocked
- [ ] Proper error message shown
- [ ] Rejected booking cannot proceed to confirmation

---

## Phase 5: Verify Calendars Unaffected

**Role: Anonymous then Admin**

| Step | Action                            | Expected Result           | Pass/Fail |
| ---- | --------------------------------- | ------------------------- | --------- |
| 5.1  | Logout from admin                 | Logged out                |           |
| 5.2  | Navigate to `/` (public calendar) | Calendar loads            |           |
| 5.3  | Check same dates for same unit    | Dates still available     |           |
| 5.4  | Compare to pre-rejection state    | No change in availability |           |
| 5.5  | Try to book same unit/dates       | Should allow new booking  |           |
| 5.6  | Login as admin                    | Admin logged in           |           |
| 5.7  | Check admin calendar view         | No booking block on dates |           |

### Checkpoint E

- [ ] Public calendar unaffected
- [ ] Unit still available for booking
- [ ] Admin calendar shows no blocking

---

## Phase 6: Verify Guest Status View

**Role: Anonymous (Final Verification)**

| Step | Action                                    | Expected Result               | Pass/Fail |
| ---- | ----------------------------------------- | ----------------------------- | --------- |
| 6.1  | Logout from admin                         | Logged out                    |           |
| 6.2  | Navigate to `/booking/check-status`       | Status lookup loads           |           |
| 6.3  | Enter rejected booking reference          | Reference entered             |           |
| 6.4  | Enter email                               | Email entered                 |           |
| 6.5  | Check status                              | Status retrieved              |           |
| 6.6  | Verify booking_status: "Pending"          | Still pending (not cancelled) |           |
| 6.7  | Verify payment_status: "Rejected"         | Shows rejection               |           |
| 6.8  | Verify rejection reason/message displayed | Guest informed of issue       |           |

### Final Checkpoint

- [ ] Guest can see rejection status
- [ ] Booking remains Pending (not cancelled)
- [ ] Rejection reason visible to guest
- [ ] Calendars remain unchanged

---

## Data Consistency Checks

| Check                                     | Expected | Actual | Pass/Fail |
| ----------------------------------------- | -------- | ------ | --------- |
| booking_status: Pending                   | Yes      |        |           |
| payment_status: Rejected                  | Yes      |        |           |
| Rejection reason recorded                 | Yes      |        |           |
| Unit assignment blocked                   | Yes      |        |           |
| Public calendar unchanged                 | Yes      |        |           |
| Admin calendar unchanged                  | Yes      |        |           |
| Same dates can be booked by another guest | Yes      |        |           |
| Audit trail records rejection             | Yes      |        |           |

## Rejection Reason Validation

| Test Case                           | Expected Result      | Pass/Fail |
| ----------------------------------- | -------------------- | --------- |
| Submit rejection without reason     | Validation error     |           |
| Submit rejection with empty reason  | Validation error     |           |
| Submit with single character reason | May require minimum  |           |
| Submit with valid reason            | Rejection successful |           |

## Cleanup

| Action                         | Notes                |
| ------------------------------ | -------------------- |
| Optionally delete test booking | Or leave as rejected |
| Verify no calendar impact      | After any cleanup    |
| Clear any test audit entries   | Optional             |

## Expected Results

- Rejected bookings do NOT block calendar dates
- Admin must provide rejection reason
- Guest can view rejection status and reason
- Booking remains in Pending status (not cancelled)
- Same dates remain available for other bookings
- Unit assignment is properly blocked for rejected payments
- Audit trail captures rejection action with reason

## Comparison with Approval Flow

| Aspect               | Approval (INT-007) | Rejection (INT-008)    |
| -------------------- | ------------------ | ---------------------- |
| Final booking_status | Confirmed          | Pending                |
| Final payment_status | Verified           | Rejected               |
| Calendar impact      | Dates blocked      | Dates remain available |
| Unit assignment      | Allowed & required | Blocked                |
| Guest next step      | Await check-in     | Submit new payment     |

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Booking Reference: _______________
Selected Unit: _______________
Date Range: _______________ to _______________
Rejection Reason Used: _______________
Total Test Duration: _______________

Issues Found:
_________________________________
_________________________________

Calendar Issues:
_________________________________
_________________________________

Error Handling Issues:
_________________________________
_________________________________
```
