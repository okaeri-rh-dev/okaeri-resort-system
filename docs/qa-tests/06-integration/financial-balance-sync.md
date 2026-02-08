# QA Test: Financial Transactions → Account Balance Synchronization

| Field              | Value                                 |
| ------------------ | ------------------------------------- |
| **Test Category**  | Complex Integration                   |
| **Test IDs**       | INT-FIN-001, INT-FIN-002, INT-FIN-003 |
| **Priority**       | Critical                              |
| **Roles Required** | Admin + Owner                         |
| **Estimated Time** | 25 minutes                            |

## Overview

These tests verify that financial operations (payments, expenses, transfers) correctly update account balances. The account balance is calculated as:

```
Balance = Received (payments) - Spent (expenses) + Transfers In - Transfers Out
```

## Test Environment

- **URL**: https://okaeri-resort.pages.dev
- **Test Accounts** (password: `12345678`):
  - Admin: `jasonacido+admin@gmail.com`
  - Owner: `jasonacido+owner@gmail.com`

## Prerequisites

- [ ] At least 3 financial accounts exist (e.g., Cash, Bank, GCash)
- [ ] Owner account access for expense and transfer management
- [ ] Admin account access for payment recording
- [ ] Calculator for balance verification
- [ ] Two browser tabs ready (Admin + Owner)

---

## INT-FIN-001: Payment Received Updates Account Balance

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

When a payment is recorded to a specific account, that account's balance should increase by the payment amount.

### Test Configuration

```
Test Account: Cash
Initial Balance: ₱_______________
Payment Amount: ₱5,000
Expected Final Balance: ₱_______________ (Initial + 5,000)
```

### Test Steps

#### Phase 1: Record Initial Balance (Owner)

| Step | Action                             | Expected Result                       | Pass/Fail |
| ---- | ---------------------------------- | ------------------------------------- | --------- |
| 1    | Login as Owner                     | Dashboard loads                       |           |
| 2    | Navigate to `/admin/accounts`      | Accounts page loads                   |           |
| 3    | Find "Cash" account (or test acct) | Account visible in table              |           |
| 4    | Note current balance               | Balance recorded: ₱******\_\_\_****** |           |
| 5    | Note "Received" column value       | Received: ₱******\_\_\_******         |           |

#### Phase 2: Admin Records Payment

| Step | Action                        | Expected Result               | Pass/Fail |
| ---- | ----------------------------- | ----------------------------- | --------- |
| 6    | Open new tab, login as Admin  | Admin logged in               |           |
| 7    | Navigate to `/admin/payments` | Payments page loads           |           |
| 8    | Click "Record Payment"        | Payment form opens            |           |
| 9    | Select a booking              | Booking selected              |           |
| 10   | Enter amount: ₱5,000          | Amount entered                |           |
| 11   | Select account: Cash          | Cash account selected         |           |
| 12   | Enter reference number        | Reference entered             |           |
| 13   | Submit payment                | Payment recorded successfully |           |

#### Phase 3: Verify Balance Updated (Owner)

| Step | Action                         | Expected Result                   | Pass/Fail |
| ---- | ------------------------------ | --------------------------------- | --------- |
| 14   | Switch to Owner tab            | Owner tab active                  |           |
| 15   | Refresh `/admin/accounts` page | Page reloads                      |           |
| 16   | Check "Cash" account balance   | Balance increased by ₱5,000       |           |
| 17   | Check "Received" column        | Received increased by ₱5,000      |           |
| 18   | Verify calculation             | New Balance = Old Balance + 5,000 |           |

### Balance Verification

```
Before Payment:
  Cash Balance: ₱_______________
  Cash Received: ₱_______________

After Payment:
  Cash Balance: ₱_______________
  Cash Received: ₱_______________

Expected Increase: ₱5,000
Actual Increase: ₱_______________
Match: [ ] Yes [ ] No
```

### Verification Checklist

- [ ] Account balance increases by exact payment amount
- [ ] "Received" column shows +₱5,000
- [ ] Total balance across accounts updates
- [ ] Dashboard revenue metrics update (if displayed)

---

## INT-FIN-002: Expense Deducts from Account Balance

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

When an expense is recorded from an account, that account's balance should decrease by the expense amount.

### Preconditions

- [ ] INT-FIN-001 completed (Cash account has ₱5,000 or more)
- [ ] Owner account access

### Test Configuration

```
Test Account: Cash
Initial Balance: ₱_______________ (from INT-FIN-001)
Expense Amount: ₱1,500
Expected Final Balance: ₱_______________ (Initial - 1,500)
```

### Test Steps

#### Phase 1: Record Initial Balance

| Step | Action                        | Expected Result                       | Pass/Fail |
| ---- | ----------------------------- | ------------------------------------- | --------- |
| 1    | Login as Owner                | Dashboard loads                       |           |
| 2    | Navigate to `/admin/accounts` | Accounts page loads                   |           |
| 3    | Note Cash account balance     | Balance recorded: ₱******\_\_\_****** |           |
| 4    | Note "Spent" column value     | Spent: ₱******\_\_\_******            |           |

#### Phase 2: Create Expense

| Step | Action                              | Expected Result              | Pass/Fail |
| ---- | ----------------------------------- | ---------------------------- | --------- |
| 5    | Navigate to `/admin/expenses`       | Expenses page loads          |           |
| 6    | Click "Add Expense"                 | Expense form opens           |           |
| 7    | Enter description: "Test Utilities" | Description entered          |           |
| 8    | Enter amount: ₱1,500                | Amount entered               |           |
| 9    | Select category: Utilities          | Category selected            |           |
| 10   | Select account: Cash                | Cash account selected        |           |
| 11   | Select date: Today                  | Date selected                |           |
| 12   | Submit expense                      | Expense created successfully |           |

#### Phase 3: Verify Balance Decreased

| Step | Action                        | Expected Result                   | Pass/Fail |
| ---- | ----------------------------- | --------------------------------- | --------- |
| 13   | Navigate to `/admin/accounts` | Accounts page loads               |           |
| 14   | Find Cash account             | Account located                   |           |
| 15   | Check account balance         | Balance decreased by ₱1,500       |           |
| 16   | Check "Spent" column          | Spent increased by ₱1,500         |           |
| 17   | Verify calculation            | New Balance = Old Balance - 1,500 |           |

### Balance Verification

```
Before Expense:
  Cash Balance: ₱_______________
  Cash Spent: ₱_______________

After Expense:
  Cash Balance: ₱_______________
  Cash Spent: ₱_______________

Expected Decrease: ₱1,500
Actual Decrease: ₱_______________
Match: [ ] Yes [ ] No
```

### Verification Checklist

- [ ] Account balance decreases by exact expense amount
- [ ] "Spent" column shows increase
- [ ] Balance calculation: Received - Spent = Balance
- [ ] Expense appears in expenses list

---

## INT-FIN-003: Transfer Updates Both Account Balances

| Field          | Value    |
| -------------- | -------- |
| **Complexity** | High     |
| **Priority**   | Critical |

### Scenario

An account transfer should decrease source account balance and increase destination account balance by the same amount.

### Preconditions

- [ ] INT-FIN-002 completed
- [ ] Cash account has positive balance
- [ ] GCash (or another) account exists

### Test Configuration

```
Source Account: Cash
  Initial Balance: ₱_______________

Destination Account: GCash
  Initial Balance: ₱_______________

Transfer Amount: ₱1,000
```

### Test Steps

#### Phase 1: Record Initial Balances

| Step | Action                          | Expected Result            | Pass/Fail |
| ---- | ------------------------------- | -------------------------- | --------- |
| 1    | Login as Owner                  | Dashboard loads            |           |
| 2    | Navigate to `/admin/accounts`   | Accounts page loads        |           |
| 3    | Note Cash balance               | Cash: ₱******\_\_\_******  |           |
| 4    | Note GCash balance              | GCash: ₱******\_\_\_****** |           |
| 5    | Calculate total across accounts | Total: ₱******\_\_\_****** |           |

#### Phase 2: Create Transfer

| Step | Action                             | Expected Result               | Pass/Fail |
| ---- | ---------------------------------- | ----------------------------- | --------- |
| 6    | Navigate to `/admin/transfers`     | Transfers page loads          |           |
| 7    | Click "New Transfer"               | Transfer form opens           |           |
| 8    | Select From: Cash                  | Source account selected       |           |
| 9    | Select To: GCash                   | Destination account selected  |           |
| 10   | Enter amount: ₱1,000               | Amount entered                |           |
| 11   | Enter description: "Test transfer" | Description entered           |           |
| 12   | Submit transfer                    | Transfer created successfully |           |

#### Phase 3: Verify Both Balances Updated

| Step | Action                          | Expected Result       | Pass/Fail |
| ---- | ------------------------------- | --------------------- | --------- |
| 13   | Navigate to `/admin/accounts`   | Accounts page loads   |           |
| 14   | Check Cash balance              | Decreased by ₱1,000   |           |
| 15   | Check GCash balance             | Increased by ₱1,000   |           |
| 16   | Check "Transfers Out" for Cash  | Shows +₱1,000 out     |           |
| 17   | Check "Transfers In" for GCash  | Shows +₱1,000 in      |           |
| 18   | Calculate total across accounts | Same as initial total |           |

### Balance Verification

```
Before Transfer:
  Cash Balance: ₱_______________
  GCash Balance: ₱_______________
  Total: ₱_______________

After Transfer:
  Cash Balance: ₱_______________
  GCash Balance: ₱_______________
  Total: ₱_______________

Expected:
  Cash decreased by: ₱1,000
  GCash increased by: ₱1,000
  Total unchanged: [ ] Yes [ ] No

Actual:
  Cash change: ₱_______________
  GCash change: ₱_______________
Match: [ ] Yes [ ] No
```

### Verification Checklist

- [ ] Source account (Cash) decreased by ₱1,000
- [ ] Destination account (GCash) increased by ₱1,000
- [ ] Total balance across all accounts remains unchanged
- [ ] Transfer appears in transfers list
- [ ] Transfer shows correct from/to accounts

---

## Summary Test Matrix

| Test ID     | Operation        | Source Impact | Destination Impact |
| ----------- | ---------------- | ------------- | ------------------ |
| INT-FIN-001 | Payment Received | N/A           | +Amount            |
| INT-FIN-002 | Expense Created  | -Amount       | N/A                |
| INT-FIN-003 | Account Transfer | -Amount       | +Amount            |

## Account Balance Formula

```
Account Balance =
    SUM(payments_received)
  - SUM(expenses)
  + SUM(transfers_in)
  - SUM(transfers_out)
```

## Cross-Account Integrity Checks

| Check                                   | Expected            | Actual          | Pass/Fail |
| --------------------------------------- | ------------------- | --------------- | --------- |
| Total of all account balances           | ₱******\_\_\_****** | ₱******\_****** |           |
| Sum of received = Sum of all payments   | ₱******\_\_\_****** | ₱******\_****** |           |
| Sum of spent = Sum of all expenses      | ₱******\_\_\_****** | ₱******\_****** |           |
| Transfers out = Transfers in (zero-sum) | ₱******\_\_\_****** | ₱******\_****** |           |

## Edge Cases to Consider

### Insufficient Balance

| Test | Action                           | Expected Behavior         |
| ---- | -------------------------------- | ------------------------- |
| E1   | Transfer more than available     | Error: Insufficient funds |
| E2   | Create expense more than balance | Warning or prevention     |

### Negative Balance

| Test | Action                      | Expected Behavior        |
| ---- | --------------------------- | ------------------------ |
| E3   | Allow negative balance?     | System policy check      |
| E4   | Display of negative amounts | Shows with negative sign |

## Common Failure Patterns

1. **Balance Drift**: Balances slowly become inaccurate over time
   - Check: Recalculate from all transactions
   - Verify: No missing transactions

2. **Transfer Not Zero-Sum**: Total balance changes after transfer
   - Check: Both accounts updated atomically
   - Verify: No partial transfer state

3. **Delayed Updates**: Balance updates after refresh only
   - Check: Real-time sync or cache invalidation
   - Note: Document actual delay

## Test Data Cleanup

After completing financial sync tests:

- [ ] Delete test expenses created
- [ ] Reverse test transfers if possible
- [ ] Verify account balances return to expected state

## Notes

```
Test Date: _______________
Tester: _______________
Environment: https://okaeri-resort.pages.dev

Accounts Tested:
  Account A: _______________ (Type: _______________)
  Account B: _______________ (Type: _______________)
  Account C: _______________ (Type: _______________)

Transactions Created:
  Payment: ₱_______________
  Expense: ₱_______________
  Transfer: ₱_______________

Total Test Duration: _______________

Balance Calculation Issues:
_________________________________
_________________________________

Transfer Integrity Issues:
_________________________________
_________________________________
```
