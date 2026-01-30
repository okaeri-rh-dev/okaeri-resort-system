# QA Test: Financial Accounts Management

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-006    |
| **Priority**       | Critical   |
| **Role Required**  | Owner      |
| **Estimated Time** | 15 minutes |

## Objective

Verify that owners can fully manage financial accounts including creation, editing, deactivation, and viewing running balances. This tests the core financial tracking infrastructure.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] Accounts section is accessible via `/admin/accounts`
- [ ] At least one existing account exists (or none for clean slate test)

## Test Steps

### Step 1: Navigate to Accounts

| Action                               | Expected Result                      | Pass/Fail |
| ------------------------------------ | ------------------------------------ | --------- |
| Click "Accounts" in Finance section  | Accounts page loads                  |           |
| Verify accounts table displays       | List of accounts visible (or empty)  |           |
| Verify "Add Account" button present  | Button is enabled and visible        |           |
| Verify balance summary cards visible | Summary shows totals by account type |           |

### Step 2: Create Bank Account

| Action                                 | Expected Result                    | Pass/Fail |
| -------------------------------------- | ---------------------------------- | --------- |
| Click "Add Account" button             | Account form opens                 |           |
| Enter name: "Test BDO Savings"         | Field accepts input                |           |
| Enter code: "TEST-BDO"                 | Field accepts alphanumeric + dash  |           |
| Select type: "Bank"                    | Type dropdown works                |           |
| Enter description: "Test bank account" | Optional field accepts input       |           |
| Enter initial balance: 50000.00        | Amount field accepts decimal       |           |
| Verify display order defaults to 0     | Number field shows 0               |           |
| Click "Save"                           | Account saved, toast shows success |           |
| Verify account appears in list         | New account visible in table       |           |

### Step 3: Create E-Wallet Account

| Action                           | Expected Result                    | Pass/Fail |
| -------------------------------- | ---------------------------------- | --------- |
| Click "Add Account" button       | Account form opens                 |           |
| Enter name: "Test GCash"         | Field accepts input                |           |
| Enter code: "TEST-GCASH"         | Field accepts input                |           |
| Select type: "E-Wallet"          | Type dropdown shows E-Wallet       |           |
| Enter initial balance: 5000.00   | Amount field accepts decimal       |           |
| Click "Save"                     | Account saved, toast shows success |           |
| Verify account in E-Wallet group | Account grouped correctly          |           |

### Step 4: Create Cash Account

| Action                         | Expected Result                    | Pass/Fail |
| ------------------------------ | ---------------------------------- | --------- |
| Click "Add Account" button     | Account form opens                 |           |
| Enter name: "Test Petty Cash"  | Field accepts input                |           |
| Enter code: "TEST-PETTY"       | Field accepts input                |           |
| Select type: "Cash"            | Type dropdown shows Cash           |           |
| Enter initial balance: 2000.00 | Amount field accepts decimal       |           |
| Click "Save"                   | Account saved, toast shows success |           |
| Verify account in Cash group   | Account grouped correctly          |           |

### Step 5: Verify Account Balances Display

| Action                                  | Expected Result                         | Pass/Fail |
| --------------------------------------- | --------------------------------------- | --------- |
| View accounts table                     | Running balances column visible         |           |
| Verify "Test BDO Savings" balance       | Shows initial balance (no transactions) |           |
| Verify summary card for "Bank" type     | Total equals sum of bank accounts       |           |
| Verify summary card for "E-Wallet" type | Total equals sum of e-wallet accounts   |           |
| Verify summary card for "Cash" type     | Total equals sum of cash accounts       |           |
| Verify "Total Balance" card             | Total equals sum of all accounts        |           |

### Step 6: Edit Account

| Action                                         | Expected Result                     | Pass/Fail |
| ---------------------------------------------- | ----------------------------------- | --------- |
| Click edit button on "Test BDO Savings"        | Edit form opens with current values |           |
| Change name: "Test BDO Savings Updated"        | Name field updates                  |           |
| Change description: "Updated test description" | Description updates                 |           |
| Change initial balance: 55000.00               | Balance updates                     |           |
| Click "Save Changes"                           | Updates saved, toast confirms       |           |
| Verify changes in table                        | Updated values shown                |           |
| Verify running balance recalculated            | Balance reflects new initial amount |           |

### Step 7: Account Code Uniqueness

| Action                             | Expected Result                      | Pass/Fail |
| ---------------------------------- | ------------------------------------ | --------- |
| Click "Add Account" button         | Account form opens                   |           |
| Enter name: "Duplicate Code Test"  | Field accepts input                  |           |
| Enter code: "TEST-BDO" (duplicate) | Field accepts input                  |           |
| Click "Save"                       | Error: "Account code already exists" |           |
| Change code to: "TEST-DUP"         | Field updates                        |           |
| Click "Save"                       | Account saved successfully           |           |

### Step 8: Account Name Uniqueness

| Action                                       | Expected Result                      | Pass/Fail |
| -------------------------------------------- | ------------------------------------ | --------- |
| Click "Add Account" button                   | Account form opens                   |           |
| Enter name: "Test BDO Savings Updated" (dup) | Field accepts input                  |           |
| Enter code: "TEST-UNIQUE"                    | Field accepts input                  |           |
| Click "Save"                                 | Error: "Account name already exists" |           |
| Change name to: "Unique Account Name"        | Field updates                        |           |
| Click "Save"                                 | Account saved successfully           |           |

### Step 9: Deactivate Account

| Action                                      | Expected Result                     | Pass/Fail |
| ------------------------------------------- | ----------------------------------- | --------- |
| Click edit on "Duplicate Code Test" account | Edit form opens                     |           |
| Toggle "Active" switch to off               | Switch changes to inactive state    |           |
| Click "Save Changes"                        | Account deactivated, toast confirms |           |
| Verify account shows "(Inactive)" badge     | Visual indicator shown              |           |
| Navigate to Payments > Add Payment          | Payment form opens                  |           |
| Check account dropdown                      | Deactivated account NOT in dropdown |           |
| Navigate to Expenses > Add Expense          | Expense form opens                  |           |
| Check account dropdown                      | Deactivated account NOT in dropdown |           |

### Step 10: Reactivate Account

| Action                                     | Expected Result                     | Pass/Fail |
| ------------------------------------------ | ----------------------------------- | --------- |
| Return to Accounts page                    | Accounts list loads                 |           |
| Filter to show inactive (if filter exists) | Inactive accounts visible           |           |
| Click edit on deactivated account          | Edit form opens                     |           |
| Toggle "Active" switch to on               | Switch changes to active state      |           |
| Click "Save Changes"                       | Account reactivated, toast confirms |           |
| Verify "(Inactive)" badge removed          | Account shows as active             |           |

### Step 11: Filter and Sort Accounts

| Action                        | Expected Result              | Pass/Fail |
| ----------------------------- | ---------------------------- | --------- |
| Click "Type" column header    | Accounts sorted by type      |           |
| Click "Balance" column header | Accounts sorted by balance   |           |
| Filter by type "Bank"         | Only bank accounts shown     |           |
| Clear filter                  | All accounts shown           |           |
| Search for "Test"             | Only test accounts displayed |           |
| Clear search                  | All accounts visible again   |           |

### Step 12: Delete Test Accounts (Cleanup)

| Action                                | Expected Result                 | Pass/Fail |
| ------------------------------------- | ------------------------------- | --------- |
| Select "Unique Account Name" account  | Account row highlighted         |           |
| Click "Delete" button                 | Confirmation dialog appears     |           |
| Verify warning about deleting account | Warning text visible            |           |
| Click "Cancel"                        | Dialog closes, account remains  |           |
| Click "Delete" again                  | Confirmation dialog appears     |           |
| Click "Confirm Delete"                | Account deleted, toast confirms |           |
| Repeat for other test accounts        | All test accounts removed       |           |

## Validation Rules

Test input validation:

| Input           | Test Value         | Expected Result              | Pass/Fail |
| --------------- | ------------------ | ---------------------------- | --------- |
| Account Name    | Empty              | Error: Name required         |           |
| Account Name    | 1 character        | Error: Name too short        |           |
| Account Name    | 100+ characters    | Accepted or reasonable limit |           |
| Account Code    | Empty              | Error: Code required         |           |
| Account Code    | With spaces        | Error: Invalid characters    |           |
| Account Code    | Special chars (!@) | Error: Invalid characters    |           |
| Initial Balance | -100               | Error: Cannot be negative    |           |
| Initial Balance | 0                  | Accepted (zero balance OK)   |           |
| Initial Balance | abc                | Error: Invalid number        |           |
| Initial Balance | 999999999999       | Accepted or reasonable limit |           |

## Expected Results

- Account CRUD operations work correctly
- Running balances are calculated and displayed
- Account type grouping works properly
- Summary cards show accurate totals
- Deactivated accounts hidden from transaction dropdowns
- Input validation prevents invalid data
- Account code and name uniqueness enforced

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Accounts Created:
- Bank: _______________
- E-Wallet: _______________
- Cash: _______________

Balance Calculation Verified:
- Initial Balance Correct: [ ] Yes [ ] No
- Summary Totals Match: [ ] Yes [ ] No

Issues Found:
_________________________________
_________________________________
```
