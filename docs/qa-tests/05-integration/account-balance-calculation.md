# QA Test: Account Balance Calculation

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | INT-006    |
| **Priority**       | Critical   |
| **Role Required**  | Owner      |
| **Estimated Time** | 20 minutes |

## Objective

Verify that account running balances are accurately calculated based on initial balance, incoming payments, outgoing expenses, and inter-account transfers. This is a critical integration test that verifies the financial tracking system's mathematical accuracy.

## Balance Formula

```
Current Balance = Initial Balance
                + Total Payments (incoming)
                - Total Expenses (outgoing)
                + Transfers In (from other accounts)
                - Transfers Out (to other accounts)
```

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] Clean test account created (or note existing balances)
- [ ] Access to Accounts, Payments, Expenses, and Transfers pages
- [ ] Calculator ready to verify calculations
- [ ] At least one booking exists for payment testing

## Test Steps

### Step 1: Create Clean Test Account

| Action                                   | Expected Result         | Pass/Fail |
| ---------------------------------------- | ----------------------- | --------- |
| Navigate to Accounts (`/admin/accounts`) | Accounts page loads     |           |
| Click "Add Account"                      | Account form opens      |           |
| Enter name: "Balance Test Account"       | Field accepts input     |           |
| Enter code: "BAL-TEST"                   | Field accepts input     |           |
| Select type: "Bank"                      | Type selected           |           |
| Enter initial balance: 10000.00          | Amount entered          |           |
| Click "Save"                             | Account created         |           |
| Verify balance shows: 10000.00           | Initial balance correct |           |

**Checkpoint 1**: Balance = 10,000.00 (Initial only)

### Step 2: Record Payment to Test Account

| Action                                   | Expected Result                     | Pass/Fail |
| ---------------------------------------- | ----------------------------------- | --------- |
| Navigate to Payments (`/admin/payments`) | Payments page loads                 |           |
| Click "Add Payment"                      | Payment form opens                  |           |
| Select booking from dropdown             | Booking selected                    |           |
| Enter amount: 2500.00                    | Amount entered                      |           |
| Select account: "Balance Test Account"   | Account dropdown shows test account |           |
| Select payment method: GCash             | Method selected                     |           |
| Enter reference: "TEST-PAY-001"          | Reference entered                   |           |
| Click "Save"                             | Payment created                     |           |
| Navigate back to Accounts page           | Accounts page loads                 |           |
| Check "Balance Test Account" balance     | Balance now: 12,500.00              |           |

**Checkpoint 2**: Balance = 10,000 + 2,500 = 12,500.00

### Step 3: Record Another Payment

| Action                                 | Expected Result        | Pass/Fail |
| -------------------------------------- | ---------------------- | --------- |
| Navigate to Payments                   | Payments page loads    |           |
| Click "Add Payment"                    | Payment form opens     |           |
| Select same or different booking       | Booking selected       |           |
| Enter amount: 1500.00                  | Amount entered         |           |
| Select account: "Balance Test Account" | Account selected       |           |
| Select payment method: Cash            | Method selected        |           |
| Enter reference: "TEST-PAY-002"        | Reference entered      |           |
| Click "Save"                           | Payment created        |           |
| Navigate back to Accounts page         | Accounts page loads    |           |
| Check "Balance Test Account" balance   | Balance now: 14,000.00 |           |

**Checkpoint 3**: Balance = 12,500 + 1,500 = 14,000.00

### Step 4: Record Expense from Test Account

| Action                                       | Expected Result        | Pass/Fail |
| -------------------------------------------- | ---------------------- | --------- |
| Navigate to Expenses (`/admin/expenses`)     | Expenses page loads    |           |
| Click "Add Expense"                          | Expense form opens     |           |
| Enter description: "Test Expense - Supplies" | Description entered    |           |
| Select category: "Supplies"                  | Category selected      |           |
| Enter amount: 3000.00                        | Amount entered         |           |
| Select date: Today                           | Date selected          |           |
| Select account: "Balance Test Account"       | Account selected       |           |
| Click "Save"                                 | Expense created        |           |
| Navigate back to Accounts page               | Accounts page loads    |           |
| Check "Balance Test Account" balance         | Balance now: 11,000.00 |           |

**Checkpoint 4**: Balance = 14,000 - 3,000 = 11,000.00

### Step 5: Record Another Expense

| Action                                        | Expected Result       | Pass/Fail |
| --------------------------------------------- | --------------------- | --------- |
| Navigate to Expenses                          | Expenses page loads   |           |
| Click "Add Expense"                           | Expense form opens    |           |
| Enter description: "Test Expense - Utilities" | Description entered   |           |
| Select category: "Utilities"                  | Category selected     |           |
| Enter amount: 1500.00                         | Amount entered        |           |
| Select account: "Balance Test Account"        | Account selected      |           |
| Click "Save"                                  | Expense created       |           |
| Navigate back to Accounts page                | Accounts page loads   |           |
| Check "Balance Test Account" balance          | Balance now: 9,500.00 |           |

**Checkpoint 5**: Balance = 11,000 - 1,500 = 9,500.00

### Step 6: Create Incoming Transfer

| Action                                     | Expected Result                | Pass/Fail |
| ------------------------------------------ | ------------------------------ | --------- |
| Ensure another account exists (source)     | BDO or other account available |           |
| Note source account balance before         | Record starting balance        |           |
| Navigate to Transfers (`/admin/transfers`) | Transfers page loads           |           |
| Click "New Transfer"                       | Transfer form opens            |           |
| Select from: BDO Savings (or other)        | Source account selected        |           |
| Select to: "Balance Test Account"          | Destination selected           |           |
| Enter amount: 2000.00                      | Amount entered                 |           |
| Enter notes: "Transfer in test"            | Notes entered                  |           |
| Click "Create Transfer"                    | Transfer created               |           |
| Navigate to Accounts page                  | Accounts page loads            |           |
| Check "Balance Test Account" balance       | Balance now: 11,500.00         |           |
| Check source account balance               | Reduced by 2,000.00            |           |

**Checkpoint 6**: Balance = 9,500 + 2,000 = 11,500.00

### Step 7: Create Outgoing Transfer

| Action                                  | Expected Result         | Pass/Fail |
| --------------------------------------- | ----------------------- | --------- |
| Note destination account balance before | Record starting balance |           |
| Navigate to Transfers                   | Transfers page loads    |           |
| Click "New Transfer"                    | Transfer form opens     |           |
| Select from: "Balance Test Account"     | Source account selected |           |
| Select to: Petty Cash (or other)        | Destination selected    |           |
| Enter amount: 500.00                    | Amount entered          |           |
| Enter notes: "Transfer out test"        | Notes entered           |           |
| Click "Create Transfer"                 | Transfer created        |           |
| Navigate to Accounts page               | Accounts page loads     |           |
| Check "Balance Test Account" balance    | Balance now: 11,000.00  |           |
| Check destination account balance       | Increased by 500.00     |           |

**Checkpoint 7**: Balance = 11,500 - 500 = 11,000.00

### Step 8: Verify Detailed Balance Breakdown

| Action                                  | Expected Result            | Pass/Fail |
| --------------------------------------- | -------------------------- | --------- |
| View "Balance Test Account" details     | Account details page opens |           |
| Verify initial balance shown: 10,000.00 | Initial balance correct    |           |
| Verify total payments shown: 4,000.00   | Sum of 2,500 + 1,500       |           |
| Verify total expenses shown: 4,500.00   | Sum of 3,000 + 1,500       |           |
| Verify transfers in shown: 2,000.00     | Single incoming transfer   |           |
| Verify transfers out shown: 500.00      | Single outgoing transfer   |           |
| Verify current balance: 11,000.00       | Calculated correctly       |           |

**Manual Verification**:

- Initial: 10,000
- \+ Payments: 4,000
- \- Expenses: 4,500
- \+ Transfers In: 2,000
- \- Transfers Out: 500
- **= Current: 11,000**

### Step 9: Edit Transaction and Verify Recalculation

| Action                               | Expected Result        | Pass/Fail |
| ------------------------------------ | ---------------------- | --------- |
| Navigate to Payments                 | Payments page loads    |           |
| Edit "TEST-PAY-001" payment          | Edit form opens        |           |
| Change amount from 2500 to 3000      | Amount updated         |           |
| Click "Save"                         | Payment updated        |           |
| Navigate to Accounts page            | Accounts page loads    |           |
| Check "Balance Test Account" balance | Balance now: 11,500.00 |           |

**Checkpoint 8**: Balance increased by 500 due to payment edit

### Step 10: Delete Transaction and Verify Recalculation

| Action                                  | Expected Result        | Pass/Fail |
| --------------------------------------- | ---------------------- | --------- |
| Navigate to Expenses                    | Expenses page loads    |           |
| Delete "Test Expense - Supplies" (3000) | Expense deleted        |           |
| Navigate to Accounts page               | Accounts page loads    |           |
| Check "Balance Test Account" balance    | Balance now: 14,500.00 |           |

**Checkpoint 9**: Balance increased by 3,000 (expense removed)

### Step 11: Verify Total Balance Across All Accounts

| Action                                  | Expected Result                       | Pass/Fail |
| --------------------------------------- | ------------------------------------- | --------- |
| Calculate total of all account balances | Sum calculated                        |           |
| Compare with summary card total         | Totals match exactly                  |           |
| Create new transfer between accounts    | Transfer created                      |           |
| Verify total unchanged                  | Total same (money moved, not created) |           |

### Step 12: Cleanup - Delete Test Account

| Action                                | Expected Result              | Pass/Fail |
| ------------------------------------- | ---------------------------- | --------- |
| First delete test payments            | Payments removed             |           |
| Delete test expenses                  | Expenses removed             |           |
| Delete test transfers                 | Transfers removed            |           |
| Navigate to Accounts                  | Accounts page loads          |           |
| Delete "Balance Test Account"         | Account deleted (if allowed) |           |
| Or deactivate if deletion not allowed | Account deactivated          |           |

## Balance Verification Table

Use this table to track your balance calculations:

| Step | Transaction Type | Amount | Running Balance | Actual Balance | Match? |
| ---- | ---------------- | ------ | --------------- | -------------- | ------ |
| 1    | Initial          | 10,000 | 10,000          |                |        |
| 2    | Payment (+)      | 2,500  | 12,500          |                |        |
| 3    | Payment (+)      | 1,500  | 14,000          |                |        |
| 4    | Expense (-)      | 3,000  | 11,000          |                |        |
| 5    | Expense (-)      | 1,500  | 9,500           |                |        |
| 6    | Transfer In (+)  | 2,000  | 11,500          |                |        |
| 7    | Transfer Out (-) | 500    | 11,000          |                |        |
| 8    | Edit Payment     | +500   | 11,500          |                |        |
| 9    | Delete Expense   | +3,000 | 14,500          |                |        |

## Expected Results

- Initial balance correctly sets starting point
- Payments increase account balance
- Expenses decrease account balance
- Incoming transfers increase balance
- Outgoing transfers decrease balance
- Total balance across accounts unchanged by transfers
- Editing transactions recalculates balance
- Deleting transactions reverses balance impact
- Summary cards match calculated totals

## Critical Failure Conditions

The test FAILS if any of these occur:

- [ ] Balance doesn't update after transaction
- [ ] Balance calculation is mathematically wrong
- [ ] Transfer changes total balance (should be zero-sum)
- [ ] Deleted transaction doesn't reverse balance
- [ ] Summary totals don't match individual accounts

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Initial Balances (All Accounts):
Account 1: _______________ Balance: _______________
Account 2: _______________ Balance: _______________
Account 3: _______________ Balance: _______________
Total: _______________

Final Balances (All Accounts):
Account 1: _______________ Balance: _______________
Account 2: _______________ Balance: _______________
Account 3: _______________ Balance: _______________
Total: _______________

Balance Verification: [ ] All checkpoints passed

Issues Found:
_________________________________
_________________________________
```
