# QA Test: Payment → Booking Status Synchronization

| Field              | Value                    |
| ------------------ | ------------------------ |
| **Test Category**  | Complex Integration      |
| **Test IDs**       | INT-PAY-001, INT-PAY-002 |
| **Priority**       | Critical                 |
| **Roles Required** | Admin                    |
| **Estimated Time** | 15 minutes               |

## Overview

These tests verify that payment records and booking payment status remain synchronized. When payments are recorded, the booking's payment_status should automatically update based on the cumulative payment amount versus the booking total.

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `<see password manager>`):
  - Admin: `jasonacido+admin@gmail.com`

## Payment Status Logic

```
totalPaid = 0                  → "Pending" (or "Unpaid")
0 < totalPaid < total_amount   → "Partial"
totalPaid >= total_amount      → "Completed" (or "Paid")
```

## Prerequisites

- [ ] Admin account access
- [ ] Existing booking with known total amount (e.g., total_amount = ₱10,000)
- [ ] Booking payment_status currently "Pending"
- [ ] Calculator for verification

---

## INT-PAY-001: Payment Creates Updates Booking Payment Status

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

When Admin records a payment for a booking, the booking's payment_status should automatically update based on cumulative payments.

### Test Configuration

```
Test Booking Reference: _______________
Booking Total Amount: ₱_______________
Unit: _______________
Guest Name: _______________
Initial Payment Status: Pending
```

### Test Steps

#### Phase 1: Verify Initial State

| Step | Action                        | Expected Result                       | Pass/Fail |
| ---- | ----------------------------- | ------------------------------------- | --------- |
| 1    | Login as Admin                | Dashboard loads                       |           |
| 2    | Navigate to `/admin/bookings` | Bookings table loads                  |           |
| 3    | Find test booking             | Booking located                       |           |
| 4    | Note payment status column    | Shows "Pending" (or unpaid indicator) |           |
| 5    | Note total amount             | ₱10,000 (or configured amount)        |           |

#### Phase 2: Record First Partial Payment

| Step | Action                              | Expected Result               | Pass/Fail |
| ---- | ----------------------------------- | ----------------------------- | --------- |
| 6    | Navigate to `/admin/payments`       | Payments page loads           |           |
| 7    | Click "Record Payment" or similar   | Payment form opens            |           |
| 8    | Select the test booking             | Booking selected              |           |
| 9    | Enter amount: ₱5,000 (50%)          | Amount accepted               |           |
| 10   | Select payment method (e.g., GCash) | Method selected               |           |
| 11   | Enter reference number              | Reference entered             |           |
| 12   | Submit payment                      | Payment recorded successfully |           |

#### Phase 3: Verify Partial Payment Status

| Step | Action                        | Expected Result                        | Pass/Fail |
| ---- | ----------------------------- | -------------------------------------- | --------- |
| 13   | Navigate to `/admin/bookings` | Bookings table loads                   |           |
| 14   | Find same test booking        | Booking located                        |           |
| 15   | Check payment status column   | Shows "Partial" (or partial indicator) |           |
| 16   | Click to view booking details | Details panel opens                    |           |
| 17   | Verify total paid amount      | Shows ₱5,000 paid of ₱10,000           |           |
| 18   | Verify balance remaining      | Shows ₱5,000 remaining                 |           |

**Checkpoint - Partial Payment:**

```
Booking Total: ₱_______________
First Payment: ₱_______________
Expected Balance: ₱_______________
Displayed Balance: ₱_______________
Payment Status: _______________
Match: [ ] Yes [ ] No
```

#### Phase 4: Record Second Payment (Complete Balance)

| Step | Action                           | Expected Result               | Pass/Fail |
| ---- | -------------------------------- | ----------------------------- | --------- |
| 19   | Navigate to `/admin/payments`    | Payments page loads           |           |
| 20   | Click "Record Payment"           | Payment form opens            |           |
| 21   | Select the same booking          | Booking selected              |           |
| 22   | Enter amount: ₱5,000 (remaining) | Amount accepted               |           |
| 23   | Select payment method            | Method selected               |           |
| 24   | Submit payment                   | Payment recorded successfully |           |

#### Phase 5: Verify Complete Payment Status

| Step | Action                        | Expected Result                       | Pass/Fail |
| ---- | ----------------------------- | ------------------------------------- | --------- |
| 25   | Navigate to `/admin/bookings` | Bookings table loads                  |           |
| 26   | Find same test booking        | Booking located                       |           |
| 27   | Check payment status column   | Shows "Completed" (or paid indicator) |           |
| 28   | Click to view booking details | Details panel opens                   |           |
| 29   | Verify total paid amount      | Shows ₱10,000 paid of ₱10,000         |           |
| 30   | Verify balance remaining      | Shows ₱0 remaining                    |           |

**Checkpoint - Full Payment:**

```
Booking Total: ₱_______________
First Payment: ₱_______________
Second Payment: ₱_______________
Total Paid: ₱_______________
Expected Balance: ₱0
Displayed Balance: ₱_______________
Payment Status: _______________
Match: [ ] Yes [ ] No
```

### Verification Checklist

- [ ] First partial payment → status changes to "Partial"
- [ ] Full payment reached → status changes to "Completed"
- [ ] Booking details show correct total paid amount
- [ ] Balance calculation is accurate
- [ ] Multiple payments cumulate correctly
- [ ] Status updates immediately (no refresh required)

---

## INT-PAY-002: Payment Deletion Reverts Booking Payment Status

| Field          | Value  |
| -------------- | ------ |
| **Complexity** | Medium |
| **Priority**   | High   |

### Scenario

Deleting a payment should recalculate and update the booking's payment status accordingly.

### Preconditions

- [ ] INT-PAY-001 completed (booking has "Completed" status with ₱10,000 paid)
- [ ] Two payment records exist for the test booking

### Test Steps

#### Phase 1: Verify Initial Complete State

| Step | Action                         | Expected Result             | Pass/Fail |
| ---- | ------------------------------ | --------------------------- | --------- |
| 1    | Navigate to `/admin/bookings`  | Bookings table loads        |           |
| 2    | Find test booking              | Payment status: "Completed" |           |
| 3    | Navigate to `/admin/payments`  | Payments page loads         |           |
| 4    | Find payments for test booking | Two payment records visible |           |
| 5    | Note both payment amounts      | ₱5,000 + ₱5,000 = ₱10,000   |           |

#### Phase 2: Delete One Payment

| Step | Action                           | Expected Result              | Pass/Fail |
| ---- | -------------------------------- | ---------------------------- | --------- |
| 6    | Find the second payment (₱5,000) | Payment located              |           |
| 7    | Click Delete/Remove action       | Confirmation dialog appears  |           |
| 8    | Confirm deletion                 | Payment deleted successfully |           |
| 9    | Verify payment removed from list | Only one payment remains     |           |

#### Phase 3: Verify Partial Status Restored

| Step | Action                        | Expected Result              | Pass/Fail |
| ---- | ----------------------------- | ---------------------------- | --------- |
| 10   | Navigate to `/admin/bookings` | Bookings table loads         |           |
| 11   | Find test booking             | Booking located              |           |
| 12   | Check payment status          | Shows "Partial"              |           |
| 13   | View booking details          | Shows ₱5,000 paid of ₱10,000 |           |

**Checkpoint - After First Deletion:**

```
Remaining Payments: ₱_______________
Payment Status: _______________
Expected Status: Partial
Match: [ ] Yes [ ] No
```

#### Phase 4: Delete Remaining Payment

| Step | Action                          | Expected Result              | Pass/Fail |
| ---- | ------------------------------- | ---------------------------- | --------- |
| 14   | Navigate to `/admin/payments`   | Payments page loads          |           |
| 15   | Find remaining payment (₱5,000) | Payment located              |           |
| 16   | Delete the payment              | Confirmation dialog appears  |           |
| 17   | Confirm deletion                | Payment deleted successfully |           |

#### Phase 5: Verify Pending Status Restored

| Step | Action                           | Expected Result             | Pass/Fail |
| ---- | -------------------------------- | --------------------------- | --------- |
| 18   | Navigate to `/admin/bookings`    | Bookings table loads        |           |
| 19   | Find test booking                | Booking located             |           |
| 20   | Check payment status             | Shows "Pending" (or unpaid) |           |
| 21   | View booking details             | Shows ₱0 paid of ₱10,000    |           |
| 22   | Verify balance shows full amount | Balance = ₱10,000           |           |

**Checkpoint - After All Deletions:**

```
Remaining Payments: ₱0
Payment Status: _______________
Expected Status: Pending
Match: [ ] Yes [ ] No
```

### Verification Checklist

- [ ] Deleting one payment reverts status to "Partial"
- [ ] Deleting all payments reverts status to "Pending"
- [ ] Balance recalculates correctly after deletion
- [ ] No orphaned payment records
- [ ] Audit trail captures payment deletions

---

## Summary Test Matrix

| Test ID     | Action                   | Expected Status Change |
| ----------- | ------------------------ | ---------------------- |
| INT-PAY-001 | Record partial payment   | Pending → Partial      |
| INT-PAY-001 | Record remaining payment | Partial → Completed    |
| INT-PAY-002 | Delete one payment       | Completed → Partial    |
| INT-PAY-002 | Delete all payments      | Partial → Pending      |

## Edge Cases to Consider

### Overpayment Scenario

| Test | Action                  | Expected Behavior               |
| ---- | ----------------------- | ------------------------------- |
| E1   | Pay more than total     | Warning shown OR credit balance |
| E2   | Try booking with credit | Credit applied to balance       |

### Payment Rejection Scenario

| Test | Action                     | Expected Behavior            |
| ---- | -------------------------- | ---------------------------- |
| E3   | Reject verified payment    | Status reverts appropriately |
| E4   | Check balance after reject | Balance restored             |

## Common Failure Patterns

1. **Status Not Updating**: Payment recorded but booking status unchanged
   - Check: Trigger/database function execution
   - Verify: Payment linked to correct booking_id

2. **Incorrect Balance**: Math doesn't add up
   - Check: Sum of all payments for booking
   - Verify: No duplicate payment records

3. **Delayed Status Update**: Status updates after page refresh only
   - Check: Real-time subscription or cache invalidation
   - Note: Document actual delay time

## Data Integrity Checklist

| Check                                            | Method                | Result | Pass/Fail |
| ------------------------------------------------ | --------------------- | ------ | --------- |
| Sum of payments = Dashboard revenue              | Manual calculation    |        |           |
| Booking balance = Total - Sum(payments)          | Check booking details |        |           |
| No orphaned payments (payments without bookings) | Review payments list  |        |           |
| Deleted payments not counted in balance          | Verify calculation    |        |           |

## Test Data Cleanup

After completing payment sync tests:

- [ ] Delete test payments created
- [ ] Verify booking payment status resets to Pending
- [ ] Cancel test bookings if no longer needed

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Test Booking:
  Reference: _______________
  Total: ₱_______________
  Guest: _______________

Payment Records Created:
  Payment 1: ₱_______________ (Ref: _______________)
  Payment 2: ₱_______________ (Ref: _______________)

Total Test Duration: _______________

Synchronization Issues Found:
_________________________________
_________________________________

Balance Calculation Errors:
_________________________________
_________________________________
```
