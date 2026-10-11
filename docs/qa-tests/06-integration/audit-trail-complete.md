# QA Test: Audit Trail Completeness

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Test Category**  | Complex Integration                         |
| **Test IDs**       | INT-AUDIT-001, INT-AUDIT-002, INT-AUDIT-003 |
| **Priority**       | High                                        |
| **Roles Required** | Admin, Owner                                |
| **Estimated Time** | 15 minutes                                  |

## Overview

These tests verify that all critical operations in the system are properly logged to the audit trail. This ensures compliance, accountability, and debugging capability. Each action should create an audit log entry with appropriate metadata.

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `<see password manager>`):
  - Admin: `jasonacido+admin@gmail.com`
  - Owner: `jasonacido+owner@gmail.com`

## Audit Log Entry Structure

Each audit entry should include:

- **Timestamp**: When the action occurred
- **User**: Who performed the action (email/ID)
- **Action**: Type of operation (created, updated, deleted)
- **Entity Type**: What was affected (booking, payment, expense, etc.)
- **Entity ID**: The specific record affected
- **Changes**: Before/after values for updates
- **IP Address**: Origin of the request (optional)
- **User Agent**: Browser/client info (optional)

## Prerequisites

- [ ] Admin or Owner account access
- [ ] Access to `/admin/audit-logs` page
- [ ] Browser DevTools open for timestamp verification

---

## INT-AUDIT-001: Booking Status Changes Logged

| Field          | Value  |
| -------------- | ------ |
| **Complexity** | Medium |
| **Priority**   | High   |

### Scenario

All booking status transitions should appear in the audit log with before/after values.

### Test Steps

#### Phase 1: Create a New Booking

| Step | Action                        | Expected Result                  | Pass/Fail |
| ---- | ----------------------------- | -------------------------------- | --------- |
| 1    | Login as Admin                | Dashboard loads                  |           |
| 2    | Navigate to `/admin/bookings` | Bookings page loads              |           |
| 3    | Click "Create Booking"        | Booking form opens               |           |
| 4    | Fill required fields          | Form accepts input               |           |
| 5    | Submit booking                | Booking created (Pending status) |           |
| 6    | Note booking ID/reference     | ID: **\*\***\_\_\_**\*\***       |           |
| 7    | Note current time             | Time: **\*\***\_\_\_**\*\***     |           |

#### Phase 2: Confirm the Booking

| Step | Action                        | Expected Result              | Pass/Fail |
| ---- | ----------------------------- | ---------------------------- | --------- |
| 8    | Find the new booking in table | Booking visible              |           |
| 9    | Click Actions → Confirm       | Confirmation dialog          |           |
| 10   | Confirm the action            | Status: Confirmed            |           |
| 11   | Note current time             | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 3: Cancel the Booking

| Step | Action                            | Expected Result              | Pass/Fail |
| ---- | --------------------------------- | ---------------------------- | --------- |
| 12   | Find the confirmed booking        | Booking visible              |           |
| 13   | Click Actions → Cancel            | Cancellation dialog          |           |
| 14   | Enter reason: "Test cancellation" | Reason entered               |           |
| 15   | Confirm cancellation              | Status: Cancelled            |           |
| 16   | Note current time                 | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 4: Verify Audit Entries

| Step | Action                            | Expected Result                      | Pass/Fail |
| ---- | --------------------------------- | ------------------------------------ | --------- |
| 17   | Navigate to `/admin/audit-logs`   | Audit logs page loads                |           |
| 18   | Filter by entity type: "Bookings" | Filtered to booking entries          |           |
| 19   | Find "booking.created" entry      | Entry exists with correct booking ID |           |
| 20   | Verify creation timestamp         | Matches noted time                   |           |
| 21   | Verify user is logged             | Shows admin email                    |           |
| 22   | Find "booking.updated" (confirm)  | Entry shows Pending → Confirmed      |           |
| 23   | Verify before/after in changes    | before: Pending, after: Confirmed    |           |
| 24   | Find "booking.updated" (cancel)   | Entry shows Confirmed → Cancelled    |           |
| 25   | Verify before/after in changes    | before: Confirmed, after: Cancelled  |           |

### Expected Audit Entries

| Entry # | Action          | Before Status | After Status | Exists? |
| ------- | --------------- | ------------- | ------------ | ------- |
| 1       | booking.created | N/A           | Pending      | [ ]     |
| 2       | booking.updated | Pending       | Confirmed    | [ ]     |
| 3       | booking.updated | Confirmed     | Cancelled    | [ ]     |

### Verification Checklist

- [ ] All three audit entries exist
- [ ] Each entry has correct timestamp
- [ ] User/actor is correctly logged
- [ ] Before/after values are accurate
- [ ] Booking ID matches across all entries
- [ ] Cancellation reason is captured (if tracked)

---

## INT-AUDIT-002: Financial Operations Logged

| Field          | Value  |
| -------------- | ------ |
| **Complexity** | Medium |
| **Priority**   | High   |

### Scenario

All financial operations (expenses, transfers) should be logged for compliance.

### Preconditions

- [ ] Owner account access
- [ ] At least 2 financial accounts exist

### Test Steps

#### Phase 1: Create an Expense

| Step | Action                          | Expected Result              | Pass/Fail |
| ---- | ------------------------------- | ---------------------------- | --------- |
| 1    | Login as Owner                  | Dashboard loads              |           |
| 2    | Navigate to `/admin/expenses`   | Expenses page loads          |           |
| 3    | Click "Add Expense"             | Expense form opens           |           |
| 4    | Enter description: "Audit Test" | Description entered          |           |
| 5    | Enter amount: ₱500              | Amount entered               |           |
| 6    | Select category: Utilities      | Category selected            |           |
| 7    | Select account: Cash            | Account selected             |           |
| 8    | Submit expense                  | Expense created              |           |
| 9    | Note expense ID                 | ID: **\*\***\_\_\_**\*\***   |           |
| 10   | Note current time               | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 2: Create a Transfer

| Step | Action                         | Expected Result              | Pass/Fail |
| ---- | ------------------------------ | ---------------------------- | --------- |
| 11   | Navigate to `/admin/transfers` | Transfers page loads         |           |
| 12   | Click "New Transfer"           | Transfer form opens          |           |
| 13   | Select From: Cash              | Source selected              |           |
| 14   | Select To: GCash               | Destination selected         |           |
| 15   | Enter amount: ₱200             | Amount entered               |           |
| 16   | Submit transfer                | Transfer created             |           |
| 17   | Note transfer ID               | ID: **\*\***\_\_\_**\*\***   |           |
| 18   | Note current time              | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 3: Verify Audit Entries

| Step | Action                             | Expected Result           | Pass/Fail |
| ---- | ---------------------------------- | ------------------------- | --------- |
| 19   | Navigate to `/admin/audit-logs`    | Audit logs page loads     |           |
| 20   | Filter by entity type: "Expenses"  | Filtered results shown    |           |
| 21   | Find "expense.created" entry       | Entry exists              |           |
| 22   | Verify amount logged: ₱500         | Amount in details/changes |           |
| 23   | Verify category logged: Utilities  | Category in details       |           |
| 24   | Filter by entity type: "Transfers" | Filtered results shown    |           |
| 25   | Find "transfer.created" entry      | Entry exists              |           |
| 26   | Verify from/to accounts logged     | Cash → GCash in details   |           |
| 27   | Verify amount logged: ₱200         | Amount in details         |           |

### Expected Audit Entries

| Entry # | Action           | Key Details                         | Exists? |
| ------- | ---------------- | ----------------------------------- | ------- |
| 1       | expense.created  | Amount: ₱500, Category: Utilities   | [ ]     |
| 2       | transfer.created | From: Cash, To: GCash, Amount: ₱200 | [ ]     |

### Verification Checklist

- [ ] Expense creation logged with amount and category
- [ ] Transfer creation logged with from/to accounts
- [ ] Owner user correctly identified as actor
- [ ] Timestamps accurate
- [ ] Financial amounts match exactly

---

## INT-AUDIT-003: Payment Events with Severity Levels

| Field          | Value  |
| -------------- | ------ |
| **Complexity** | Medium |
| **Priority**   | Medium |

### Scenario

Payment events should log with appropriate severity levels (INFO for received, WARNING for refunds or deletions).

### Preconditions

- [ ] Admin account access
- [ ] Existing booking for payment testing

### Test Steps

#### Phase 1: Record a Payment

| Step | Action                        | Expected Result              | Pass/Fail |
| ---- | ----------------------------- | ---------------------------- | --------- |
| 1    | Login as Admin                | Dashboard loads              |           |
| 2    | Navigate to `/admin/payments` | Payments page loads          |           |
| 3    | Click "Record Payment"        | Payment form opens           |           |
| 4    | Select a booking              | Booking selected             |           |
| 5    | Enter amount: ₱1,000          | Amount entered               |           |
| 6    | Submit payment                | Payment created              |           |
| 7    | Note payment ID               | ID: **\*\***\_\_\_**\*\***   |           |
| 8    | Note current time             | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 2: Delete/Void the Payment (if feature exists)

| Step | Action                   | Expected Result              | Pass/Fail |
| ---- | ------------------------ | ---------------------------- | --------- |
| 9    | Find the payment in list | Payment visible              |           |
| 10   | Click Delete/Void action | Confirmation dialog          |           |
| 11   | Confirm deletion         | Payment deleted/voided       |           |
| 12   | Note current time        | Time: **\*\***\_\_\_**\*\*** |           |

#### Phase 3: Verify Audit Entries with Severity

| Step | Action                            | Expected Result        | Pass/Fail |
| ---- | --------------------------------- | ---------------------- | --------- |
| 13   | Navigate to `/admin/audit-logs`   | Audit logs page loads  |           |
| 14   | Filter by entity type: "Payments" | Filtered results shown |           |
| 15   | Find "payment.created" entry      | Entry exists           |           |
| 16   | Check severity level              | INFO (or similar)      |           |
| 17   | Find "payment.deleted" entry      | Entry exists           |           |
| 18   | Check severity level              | WARNING (or similar)   |           |

### Severity Level Matrix

| Action Type      | Expected Severity | Actual Severity | Match? |
| ---------------- | ----------------- | --------------- | ------ |
| payment.created  | INFO              |                 | [ ]    |
| payment.verified | INFO              |                 | [ ]    |
| payment.deleted  | WARNING           |                 | [ ]    |
| payment.refunded | WARNING           |                 | [ ]    |

### Verification Checklist

- [ ] Payment creation logged as INFO
- [ ] Payment deletion logged as WARNING (higher severity)
- [ ] All payment amounts accurately recorded
- [ ] User actions properly attributed
- [ ] Severity filtering works in audit log UI

---

## Audit Trail Coverage Matrix

| Entity Type | Create | Update | Delete | Covered? |
| ----------- | ------ | ------ | ------ | -------- |
| Bookings    | [ ]    | [ ]    | [ ]    |          |
| Payments    | [ ]    | [ ]    | [ ]    |          |
| Expenses    | [ ]    | [ ]    | [ ]    |          |
| Transfers   | [ ]    | [ ]    | [ ]    |          |
| Units       | [ ]    | [ ]    | [ ]    |          |
| Guests      | [ ]    | [ ]    | [ ]    |          |
| Accounts    | [ ]    | [ ]    | [ ]    |          |
| User Roles  | [ ]    | [ ]    | [ ]    |          |

## Common Audit Log Issues

1. **Missing Entries**: Some operations not logged
   - Check: Database triggers or application hooks
   - Verify: All CRUD operations covered

2. **Incomplete Data**: Missing before/after values
   - Check: Update operations capture both states
   - Verify: Changes field populated

3. **Incorrect Attribution**: Wrong user logged
   - Check: Session/auth token handling
   - Verify: User ID matches actor

4. **Timezone Issues**: Timestamps appear off
   - Check: UTC storage vs display timezone
   - Verify: Consistent timezone handling

## Test Data Cleanup

After completing audit trail tests:

- [ ] Note all test entries created
- [ ] Delete test bookings/payments/expenses
- [ ] Verify cleanup operations also logged

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Entities Created for Testing:
  Booking ID: _______________
  Payment ID: _______________
  Expense ID: _______________
  Transfer ID: _______________

Audit Entries Verified:
  booking.created: [ ] Yes [ ] No
  booking.updated: [ ] Yes [ ] No
  expense.created: [ ] Yes [ ] No
  transfer.created: [ ] Yes [ ] No
  payment.created: [ ] Yes [ ] No
  payment.deleted: [ ] Yes [ ] No

Total Test Duration: _______________

Missing Audit Entries:
_________________________________
_________________________________

Incorrect Data Issues:
_________________________________
_________________________________
```
