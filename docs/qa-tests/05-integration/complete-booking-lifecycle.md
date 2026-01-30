# QA Test: Complete Booking Lifecycle (End-to-End)

| Field              | Value                          |
| ------------------ | ------------------------------ |
| **Test ID**        | INT-001                        |
| **Priority**       | Critical                       |
| **Roles Required** | Anonymous, Staff, Admin, Owner |
| **Estimated Time** | 25 minutes                     |

## Objective

Verify the complete booking lifecycle from public booking creation through payment verification to checkout, testing the flow across all user roles.

## Prerequisites

- [ ] Test credentials for all roles available
- [ ] At least one unit is available for booking
- [ ] System is running in a test environment
- [ ] Multiple browser windows/incognito for role switching

## Test Flow Overview

```
Anonymous → Admin → Staff → Admin → Owner
   ↓          ↓        ↓        ↓        ↓
 Create    Confirm   View    Verify   Review
 Booking   Booking  Status  Payment  Reports
```

---

## Phase 1: Anonymous Guest Creates Booking

**Role: Anonymous (Public Portal)**

| Step | Action                              | Expected Result                 | Pass/Fail |
| ---- | ----------------------------------- | ------------------------------- | --------- |
| 1.1  | Navigate to public booking page     | Booking form loads              |           |
| 1.2  | Select available unit               | Unit details shown              |           |
| 1.3  | Select check-in date (tomorrow)     | Date accepted                   |           |
| 1.4  | Select check-out date (+3 days)     | Date accepted, total calculated |           |
| 1.5  | Enter guest name: "Test Guest E2E"  | Name accepted                   |           |
| 1.6  | Enter email: "e2e-test@example.com" | Email accepted                  |           |
| 1.7  | Enter phone: "09171234567"          | Phone accepted                  |           |
| 1.8  | Enter guest count: 4                | Count accepted                  |           |
| 1.9  | Submit booking                      | Success message shown           |           |
| 1.10 | Note booking reference number       | Reference: ******\_******       |           |

**Record the booking reference:** `________________`

---

## Phase 2: Staff Views New Booking

**Role: Staff (Login as staff@okaeri.ph)**

| Step | Action                           | Expected Result                | Pass/Fail |
| ---- | -------------------------------- | ------------------------------ | --------- |
| 2.1  | Login as staff                   | Dashboard loads                |           |
| 2.2  | Navigate to Bookings             | Bookings list shown            |           |
| 2.3  | Search for booking reference     | Booking found in list          |           |
| 2.4  | Verify booking status: "Pending" | Status is Pending              |           |
| 2.5  | Verify guest name matches        | "Test Guest E2E" shown         |           |
| 2.6  | Verify dates are correct         | Dates match input              |           |
| 2.7  | Attempt to edit booking          | Edit button disabled/hidden    |           |
| 2.8  | Attempt to confirm booking       | Confirm button disabled/hidden |           |
| 2.9  | Logout                           | Logged out successfully        |           |

---

## Phase 3: Admin Confirms Booking

**Role: Admin (Login as admin@okaeri.ph)**

| Step | Action                           | Expected Result                       | Pass/Fail |
| ---- | -------------------------------- | ------------------------------------- | --------- |
| 3.1  | Login as admin                   | Dashboard loads                       |           |
| 3.2  | Navigate to Bookings             | Bookings list shown                   |           |
| 3.3  | Find booking by reference        | Booking located                       |           |
| 3.4  | Click on booking to view details | Details panel opens                   |           |
| 3.5  | Verify booking information       | All details correct                   |           |
| 3.6  | Click "Confirm Booking"          | Confirmation dialog appears           |           |
| 3.7  | Confirm the action               | Booking status changes to "Confirmed" |           |
| 3.8  | Verify status updated in list    | Status shows "Confirmed"              |           |
| 3.9  | Verify audit log entry created   | Audit shows confirmation action       |           |

---

## Phase 4: Guest Submits Payment (Simulated)

**Role: Admin (simulating guest payment submission)**

| Step | Action                                | Expected Result                            | Pass/Fail |
| ---- | ------------------------------------- | ------------------------------------------ | --------- |
| 4.1  | Navigate to Payments                  | Payments section loads                     |           |
| 4.2  | Click "Record Payment"                | Payment form opens                         |           |
| 4.3  | Select the test booking               | Booking linked                             |           |
| 4.4  | Enter payment amount (50% deposit)    | Amount accepted                            |           |
| 4.5  | Select payment method: "GCash"        | Method selected                            |           |
| 4.6  | Enter reference number: "GCASH123456" | Reference entered                          |           |
| 4.7  | Upload test receipt image             | Image uploaded                             |           |
| 4.8  | Submit payment                        | Payment recorded as "Pending Verification" |           |
| 4.9  | Note payment ID                       | Payment ID: ******\_******                 |           |

**Record the payment ID:** `________________`

---

## Phase 5: Admin Verifies Payment

**Role: Admin (continuing)**

| Step | Action                        | Expected Result                      | Pass/Fail |
| ---- | ----------------------------- | ------------------------------------ | --------- |
| 5.1  | Find payment in Pending list  | Payment shown with "Pending" status  |           |
| 5.2  | Click to view payment details | Payment details displayed            |           |
| 5.3  | View uploaded receipt         | Receipt image visible                |           |
| 5.4  | Click "Verify Payment"        | Confirmation dialog appears          |           |
| 5.5  | Confirm verification          | Payment status changes to "Verified" |           |
| 5.6  | Navigate back to booking      | Booking details shown                |           |
| 5.7  | Verify payment reflected      | Payment amount shown on booking      |           |
| 5.8  | Verify remaining balance      | Balance = Total - Payment            |           |

---

## Phase 6: Staff Confirms View Updates

**Role: Staff (Login as staff@okaeri.ph)**

| Step | Action                       | Expected Result                    | Pass/Fail |
| ---- | ---------------------------- | ---------------------------------- | --------- |
| 6.1  | Login as staff               | Dashboard loads                    |           |
| 6.2  | Navigate to Bookings         | Bookings list shown                |           |
| 6.3  | Find test booking            | Booking located                    |           |
| 6.4  | Verify status is "Confirmed" | Status correct                     |           |
| 6.5  | View payment information     | Payment visible in booking details |           |
| 6.6  | Navigate to Payments         | Payments list shown                |           |
| 6.7  | Find verified payment        | Payment shows "Verified" status    |           |
| 6.8  | Logout                       | Logged out successfully            |           |

---

## Phase 7: Owner Reviews Full Picture

**Role: Owner (Login as owner@okaeri.ph)**

| Step | Action                            | Expected Result                        | Pass/Fail |
| ---- | --------------------------------- | -------------------------------------- | --------- |
| 7.1  | Login as owner                    | Dashboard with metrics loads           |           |
| 7.2  | Check dashboard metrics           | Revenue reflects new payment           |           |
| 7.3  | Navigate to Bookings              | Test booking visible                   |           |
| 7.4  | View booking with full details    | All information accessible             |           |
| 7.5  | Navigate to Audit Logs            | Audit section loads                    |           |
| 7.6  | Filter for test booking ID        | Audit entries shown                    |           |
| 7.7  | Verify audit trail complete       | Creation, confirmation, payment logged |           |
| 7.8  | Navigate to Financial Reports     | Reports section loads                  |           |
| 7.9  | Verify payment in today's revenue | Amount included in totals              |           |

---

## Phase 8: Cleanup (Optional)

**Role: Admin or Owner**

| Step | Action                          | Expected Result            | Pass/Fail |
| ---- | ------------------------------- | -------------------------- | --------- |
| 8.1  | Cancel or delete test booking   | Booking removed/cancelled  |           |
| 8.2  | Verify financial totals updated | Revenue adjusted           |           |
| 8.3  | Verify availability restored    | Unit dates available again |           |

---

## Data Consistency Checks

| Check                                 | Expected   | Actual | Pass/Fail |
| ------------------------------------- | ---------- | ------ | --------- |
| Booking appears in all role views     | Yes        |        |           |
| Payment amount consistent everywhere  | Same value |        |           |
| Status updates propagate to all views | Yes        |        |           |
| Audit trail has all actions           | 3+ entries |        |           |
| Dashboard metrics update in real-time | Yes        |        |           |

## Expected Results

- Booking flows smoothly from creation to confirmation
- Role permissions are enforced at each step
- Payment verification works correctly
- All roles see consistent data
- Audit trail captures all actions
- Financial reports reflect actual transactions

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Booking Reference: _______________
Payment ID: _______________
Total Test Duration: _______________

Issues Found:
_________________________________
_________________________________

Role Transition Issues:
_________________________________
_________________________________
```
