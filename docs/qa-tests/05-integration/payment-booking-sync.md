# QA Test: Payment-Booking Synchronization

| Field              | Value        |
| ------------------ | ------------ |
| **Test ID**        | INT-004      |
| **Priority**       | Critical     |
| **Roles Required** | Admin, Owner |
| **Estimated Time** | 15 minutes   |

## Objective

Verify that payment records and booking records remain synchronized, including balance calculations, status updates, and financial reporting consistency.

## Prerequisites

- [ ] Existing booking with known total amount
- [ ] Admin access for payment management
- [ ] Owner access for financial verification
- [ ] Calculator for manual verification

## Test Configuration

```
Test Booking Reference: _______________
Booking Total Amount: ₱_______________
Unit: _______________
Guest: _______________
```

---

## Test 1: Initial Payment Recording

**Role: Admin**

### Record First Partial Payment

| Step | Action                            | Expected                  | Pass/Fail |
| ---- | --------------------------------- | ------------------------- | --------- |
| 1    | Navigate to booking details       | Booking displayed         |           |
| 2    | Note current balance: ₱**\_\_\_** | Shows full amount         |           |
| 3    | Click "Record Payment"            | Payment form opens        |           |
| 4    | Enter amount: 50% of total        | Amount accepted           |           |
| 5    | Select method: GCash              | Method selected           |           |
| 6    | Enter reference: TEST-PAY-001     | Reference entered         |           |
| 7    | Submit payment                    | Payment recorded          |           |
| 8    | Verify booking balance updated    | Balance = Total - Payment |           |

### Balance Calculation Check

```
Booking Total: ₱_______________
Payment Amount: ₱_______________
Expected Balance: ₱_______________
Displayed Balance: ₱_______________
Match: [ ] Yes [ ] No
```

---

## Test 2: Payment Verification Effect

**Role: Admin**

### Verify Payment

| Step | Action                  | Expected                                            | Pass/Fail |
| ---- | ----------------------- | --------------------------------------------------- | --------- |
| 1    | Navigate to Payments    | Payment list shown                                  |           |
| 2    | Find test payment       | Status: "Pending Verification"                      |           |
| 3    | Click "Verify"          | Verification dialog opens                           |           |
| 4    | Confirm verification    | Payment status: "Verified"                          |           |
| 5    | Navigate to booking     | Booking details shown                               |           |
| 6    | Check payment reflected | Verified payment shown                              |           |
| 7    | Check booking status    | Appropriate status (may change to "Partially Paid") |           |

### Status Synchronization

| Location                  | Expected Status       | Actual | Pass/Fail |
| ------------------------- | --------------------- | ------ | --------- |
| Payment record            | Verified              |        |           |
| Booking payment section   | Shows verified amount |        |           |
| Booking balance           | Reduced by payment    |        |           |
| Dashboard (if applicable) | Revenue updated       |        |           |

---

## Test 3: Multiple Payments

**Role: Admin**

### Record Second Payment

| Step | Action                                  | Expected                   | Pass/Fail |
| ---- | --------------------------------------- | -------------------------- | --------- |
| 1    | On same booking, record another payment | Payment form opens         |           |
| 2    | Enter remaining balance amount          | Amount accepted            |           |
| 3    | Select method: Bank Transfer            | Method selected            |           |
| 4    | Submit and verify payment               | Payment verified           |           |
| 5    | Check booking balance                   | Balance = ₱0.00            |           |
| 6    | Check booking status                    | "Fully Paid" or equivalent |           |

### Cumulative Payment Check

```
Payment 1: ₱_______________
Payment 2: ₱_______________
Total Paid: ₱_______________
Booking Total: ₱_______________
Final Balance: ₱_______________
Match: [ ] Yes (should be 0) [ ] No
```

---

## Test 4: Overpayment Handling

**Role: Admin**

### Attempt Overpayment

| Step | Action                           | Expected                  | Pass/Fail |
| ---- | -------------------------------- | ------------------------- | --------- |
| 1    | Select fully paid booking        | Booking shown             |           |
| 2    | Try to record additional payment | Behavior observed         |           |
| 3a   | If prevented: Error message      | "Booking fully paid"      |           |
| 3b   | If allowed: Record small amount  | Payment created           |           |
| 4    | Check balance display            | Negative or credit shown  |           |
| 5    | Verify handling is appropriate   | System handles gracefully |           |

**Overpayment Behavior:** [ ] Prevented [ ] Allowed with warning [ ] Allowed (shows credit) [ ] Other

---

## Test 5: Payment Rejection Effect

**Role: Admin**

### Create and Reject Payment

| Step | Action                         | Expected                     | Pass/Fail |
| ---- | ------------------------------ | ---------------------------- | --------- |
| 1    | Create new booking             | Booking created              |           |
| 2    | Record payment (50%)           | Payment pending verification |           |
| 3    | Verify booking balance reduced | Balance shows reduction      |           |
| 4    | Reject the payment             | Payment marked "Rejected"    |           |
| 5    | Check booking balance          | Balance restored to full     |           |
| 6    | Check booking status           | Reverts to unpaid status     |           |

### Rejection Recovery

```
Before Rejection:
  Booking Balance: ₱_______________
  Payment Status: Pending

After Rejection:
  Booking Balance: ₱_______________
  Payment Status: Rejected

Balance Restored: [ ] Yes [ ] No
```

---

## Test 6: Financial Report Consistency

**Role: Owner**

### Dashboard Verification

| Step | Action                          | Expected        | Pass/Fail |
| ---- | ------------------------------- | --------------- | --------- |
| 1    | Login as owner                  | Dashboard loads |           |
| 2    | Check "Total Revenue" metric    | Value noted     |           |
| 3    | Check "Pending Payments" metric | Value noted     |           |
| 4    | Navigate to Financial Reports   | Reports load    |           |

### Cross-Reference Check

| Source                       | Verified Revenue | Pending Revenue | Pass/Fail |
| ---------------------------- | ---------------- | --------------- | --------- |
| Dashboard cards              | ₱**\_\_\_**      | ₱**\_\_\_**     |           |
| Payments list (sum verified) | ₱**\_\_\_**      | ₱**\_\_\_**     |           |
| Financial report             | ₱**\_\_\_**      | ₱**\_\_\_**     |           |

All three sources should show matching values.

---

## Test 7: Booking Modification with Payments

**Role: Admin**

### Modify Paid Booking

| Step | Action                              | Expected                                | Pass/Fail |
| ---- | ----------------------------------- | --------------------------------------- | --------- |
| 1    | Select booking with partial payment | Booking shown                           |           |
| 2    | Edit booking dates (extend stay)    | Edit form opens                         |           |
| 3    | Save with increased total           | Total recalculated                      |           |
| 4    | Check balance updated               | Balance = New Total - Existing Payments |           |

### Price Change Effect

```
Original Total: ₱_______________
Payments Made: ₱_______________
Original Balance: ₱_______________

New Total (after edit): ₱_______________
New Balance: ₱_______________
Expected Balance: ₱_______________ (New Total - Payments)
Match: [ ] Yes [ ] No
```

---

## Test 8: Booking Cancellation with Payments

**Role: Admin/Owner**

### Cancel Paid Booking

| Step | Action                                | Expected                        | Pass/Fail |
| ---- | ------------------------------------- | ------------------------------- | --------- |
| 1    | Select booking with verified payments | Booking shown                   |           |
| 2    | Attempt to cancel booking             | Cancellation dialog             |           |
| 3    | Check for payment warning             | Warning about existing payments |           |
| 4    | Confirm cancellation                  | Booking cancelled               |           |
| 5    | Check payment records                 | Payments remain for audit       |           |
| 6    | Check financial reports               | Appropriate handling            |           |

**Cancellation Handling:**

- [ ] Payments voided automatically
- [ ] Payments marked as refund pending
- [ ] Payments retained with booking marked cancelled
- [ ] Other: ******\_\_\_******

---

## Data Integrity Checklist

| Check                                                 | Method                   | Result | Pass/Fail |
| ----------------------------------------------------- | ------------------------ | ------ | --------- |
| Sum of verified payments = Dashboard revenue          | Manual calculation       |        |           |
| Each booking balance = Total - Sum(verified payments) | Check 3 bookings         |        |           |
| No orphaned payments (payments without bookings)      | Review payments list     |        |           |
| No negative balances (unless overpayment allowed)     | Scan booking balances    |        |           |
| Rejected payments don't affect balances               | Verify rejected bookings |        |           |

## Expected Results

- Payment recording immediately updates booking balance
- Payment verification updates dashboard revenue
- Payment rejection restores original balance
- Multiple payments cumulate correctly
- Booking modifications recalculate balances
- All financial views show consistent data
- Cancellations handle payments appropriately

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Bookings Used:
1. Reference: _______________ Total: ₱_______________
2. Reference: _______________ Total: ₱_______________

Synchronization Issues Found:
_________________________________
_________________________________

Balance Calculation Errors:
_________________________________
_________________________________
```
