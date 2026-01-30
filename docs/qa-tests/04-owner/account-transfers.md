# QA Test: Account Transfers

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-007    |
| **Priority**       | High       |
| **Role Required**  | Owner      |
| **Estimated Time** | 12 minutes |

## Objective

Verify that owners can create, view, and manage transfers between financial accounts. Transfers move money between accounts and should correctly update running balances.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] At least 2 active accounts exist with positive balances
- [ ] Transfers section accessible via `/admin/transfers`
- [ ] Accounts section accessible via `/admin/accounts`

## Test Steps

### Step 1: Navigate to Transfers

| Action                               | Expected Result                    | Pass/Fail |
| ------------------------------------ | ---------------------------------- | --------- |
| Click "Transfers" in Finance section | Transfers page loads               |           |
| Verify transfers table displays      | List of transfers (or empty table) |           |
| Verify "New Transfer" button present | Button is enabled and visible      |           |
| Note initial account balances        | Record source/destination balances |           |

### Step 2: Create Transfer (Bank to E-Wallet)

| Action                                         | Expected Result                       | Pass/Fail |
| ---------------------------------------------- | ------------------------------------- | --------- |
| Click "New Transfer" button                    | Transfer form opens                   |           |
| Verify "From Account" dropdown                 | Shows all active accounts             |           |
| Select "From Account": BDO Savings             | Account selected                      |           |
| Verify "To Account" dropdown                   | Shows all accounts except selected    |           |
| Select "To Account": GCash Business            | Account selected                      |           |
| Enter amount: 1000.00                          | Amount field accepts decimal          |           |
| Enter notes: "Test transfer - Bank to Ewallet" | Notes field accepts input             |           |
| Click "Create Transfer"                        | Transfer created, toast shows success |           |
| Verify transfer reference generated            | Reference like "TRF-XXXXXX" shown     |           |

### Step 3: Verify Balance Updates

| Action                         | Expected Result                       | Pass/Fail |
| ------------------------------ | ------------------------------------- | --------- |
| Navigate to Accounts page      | Accounts list loads                   |           |
| Check "BDO Savings" balance    | Reduced by 1000.00                    |           |
| Check "GCash Business" balance | Increased by 1000.00                  |           |
| Verify total balance unchanged | Sum of all accounts same as before    |           |
| Return to Transfers page       | Transfers list loads                  |           |
| Verify new transfer in list    | Transfer visible with correct details |           |

### Step 4: Create Transfer (E-Wallet to Cash)

| Action                                      | Expected Result                       | Pass/Fail |
| ------------------------------------------- | ------------------------------------- | --------- |
| Click "New Transfer" button                 | Transfer form opens                   |           |
| Select "From Account": GCash Business       | Account selected                      |           |
| Select "To Account": Petty Cash             | Account selected                      |           |
| Enter amount: 500.00                        | Amount field accepts decimal          |           |
| Enter notes: "Cash withdrawal from ewallet" | Notes field accepts input             |           |
| Click "Create Transfer"                     | Transfer created, toast shows success |           |

### Step 5: Verify Second Transfer Balances

| Action                            | Expected Result                  | Pass/Fail |
| --------------------------------- | -------------------------------- | --------- |
| Navigate to Accounts page         | Accounts list loads              |           |
| Check "GCash Business" balance    | Reduced by 500.00 from previous  |           |
| Check "Petty Cash" balance        | Increased by 500.00              |           |
| Verify type summary cards updated | E-Wallet and Cash totals correct |           |

### Step 6: Prevent Same Account Transfer

| Action                             | Expected Result              | Pass/Fail |
| ---------------------------------- | ---------------------------- | --------- |
| Click "New Transfer" button        | Transfer form opens          |           |
| Select "From Account": BDO Savings | Account selected             |           |
| Check "To Account" dropdown        | BDO Savings NOT in options   |           |
| OR if same account selectable      | Form shows error when saving |           |

### Step 7: Validate Transfer Amount

| Action                            | Expected Result                      | Pass/Fail |
| --------------------------------- | ------------------------------------ | --------- |
| Click "New Transfer" button       | Transfer form opens                  |           |
| Select valid From and To accounts | Accounts selected                    |           |
| Enter amount: 0                   | Error: Amount must be greater than 0 |           |
| Enter amount: -100                | Error: Amount must be positive       |           |
| Enter amount: "abc"               | Error: Invalid number                |           |
| Leave amount empty                | Error: Amount required               |           |
| Enter valid amount: 100           | Field accepts input                  |           |

### Step 8: View Transfer Details

| Action                              | Expected Result            | Pass/Fail |
| ----------------------------------- | -------------------------- | --------- |
| Click on first transfer in list     | Transfer details shown     |           |
| Verify transfer reference displayed | Reference visible          |           |
| Verify from account name displayed  | Source account shown       |           |
| Verify to account name displayed    | Destination account shown  |           |
| Verify amount displayed             | Amount correctly formatted |           |
| Verify transfer date displayed      | Date/time shown            |           |
| Verify notes displayed              | Notes text visible         |           |

### Step 9: Filter Transfers by Account

| Action                                | Expected Result                    | Pass/Fail |
| ------------------------------------- | ---------------------------------- | --------- |
| Filter by "From Account": BDO Savings | Only outgoing BDO transfers shown  |           |
| Clear filter                          | All transfers shown                |           |
| Filter by "To Account": Petty Cash    | Only incoming Petty Cash transfers |           |
| Clear filter                          | All transfers shown                |           |

### Step 10: Filter Transfers by Date Range

| Action                     | Expected Result              | Pass/Fail |
| -------------------------- | ---------------------------- | --------- |
| Set date range: Today only | Only today's transfers shown |           |
| Set date range: This week  | This week's transfers shown  |           |
| Set date range: This month | This month's transfers shown |           |
| Clear date filter          | All transfers shown          |           |

### Step 11: Sort Transfers

| Action                           | Expected Result           | Pass/Fail |
| -------------------------------- | ------------------------- | --------- |
| Click "Date" column header       | Sorted by date ascending  |           |
| Click "Date" column header again | Sorted by date descending |           |
| Click "Amount" column header     | Sorted by amount          |           |
| Click "Reference" column header  | Sorted alphabetically     |           |

### Step 12: Delete Transfer (Correction)

| Action                                | Expected Result                        | Pass/Fail |
| ------------------------------------- | -------------------------------------- | --------- |
| Note current balances before deletion | Record both account balances           |           |
| Select a test transfer                | Transfer row highlighted               |           |
| Click "Delete" button                 | Confirmation dialog appears            |           |
| Verify warning about balance reversal | Warning explains balance impact        |           |
| Click "Cancel"                        | Dialog closes, transfer remains        |           |
| Click "Delete" again                  | Confirmation dialog appears            |           |
| Click "Confirm Delete"                | Transfer deleted, toast confirms       |           |
| Navigate to Accounts page             | Accounts list loads                    |           |
| Verify balances reversed              | Amounts restored to pre-transfer state |           |

## Validation Rules

Test input validation:

| Input        | Test Value         | Expected Result                   | Pass/Fail |
| ------------ | ------------------ | --------------------------------- | --------- |
| From Account | Not selected       | Error: From account required      |           |
| To Account   | Not selected       | Error: To account required        |           |
| To Account   | Same as From       | Error: Cannot transfer to same    |           |
| Amount       | Empty              | Error: Amount required            |           |
| Amount       | 0                  | Error: Amount must be positive    |           |
| Amount       | -50                | Error: Amount must be positive    |           |
| Amount       | "abc"              | Error: Invalid number             |           |
| Amount       | 0.001 (3 decimals) | Rounded to 2 decimals or rejected |           |
| Notes        | Empty              | Accepted (notes optional)         |           |
| Notes        | 500+ characters    | Accepted or truncated             |           |

## Expected Results

- Transfer creation works correctly
- Balances update in real-time after transfer
- Total balance across all accounts unchanged
- Transfer references are unique and auto-generated
- Cannot transfer to same account
- Transfer deletion reverses balance changes
- Filtering and sorting work correctly

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Initial Account Balances:
- Bank (BDO): _______________
- E-Wallet (GCash): _______________
- Cash (Petty): _______________

Transfers Created:
1. Reference: _______________ Amount: _______________
2. Reference: _______________ Amount: _______________

Final Account Balances:
- Bank (BDO): _______________
- E-Wallet (GCash): _______________
- Cash (Petty): _______________

Balance Check: [ ] All accounts sum to same total

Issues Found:
_________________________________
_________________________________
```
