# QA Test: Owner Expense Management

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-003    |
| **Priority**       | High       |
| **Role Required**  | Owner      |
| **Estimated Time** | 12 minutes |

## Objective

Verify that owners can fully manage resort expenses including creation, editing, deletion, categorization, and receipt management.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] Expenses section is accessible
- [ ] Test receipt image ready for upload (JPG/PNG, < 5MB)

## Test Steps

### Step 1: Navigate to Expenses

| Action                              | Expected Result               | Pass/Fail |
| ----------------------------------- | ----------------------------- | --------- |
| Click "Expenses" in navigation      | Expenses page loads           |           |
| Verify expense table displays       | List of expenses visible      |           |
| Verify "Add Expense" button present | Button is enabled and visible |           |

### Step 2: Create New Expense

| Action                                              | Expected Result                    | Pass/Fail |
| --------------------------------------------------- | ---------------------------------- | --------- |
| Click "Add Expense" button                          | Expense form opens                 |           |
| Enter description: "Test Utilities - Electric Bill" | Field accepts input                |           |
| Select category: "Utilities"                        | Category dropdown works            |           |
| Enter amount: 5000.00                               | Amount field accepts decimal       |           |
| Select date: Today's date                           | Date picker works                  |           |
| Upload receipt image                                | File uploads successfully          |           |
| Click "Save"                                        | Expense saved, toast shows success |           |
| Verify expense appears in list                      | New expense visible in table       |           |

### Step 3: View Expense Details

| Action                      | Expected Result                        | Pass/Fail |
| --------------------------- | -------------------------------------- | --------- |
| Click on created expense    | Expense details open                   |           |
| Verify description displays | "Test Utilities - Electric Bill" shown |           |
| Verify amount displays      | ₱5,000.00 formatted correctly          |           |
| Verify category displays    | "Utilities" shown                      |           |
| Verify receipt preview      | Uploaded image visible                 |           |
| Click receipt to enlarge    | Full-size image opens                  |           |

### Step 4: Edit Expense

| Action                                             | Expected Result                     | Pass/Fail |
| -------------------------------------------------- | ----------------------------------- | --------- |
| Click "Edit" button                                | Edit form opens with current values |           |
| Change description: "Electric Bill - January 2025" | Field updates                       |           |
| Change amount: 5500.00                             | Amount updates                      |           |
| Click "Save Changes"                               | Updates saved, toast confirms       |           |
| Verify changes in list                             | Updated values shown                |           |

### Step 5: Filter and Search Expenses

| Action                            | Expected Result             | Pass/Fail |
| --------------------------------- | --------------------------- | --------- |
| Filter by category "Utilities"    | Only utility expenses shown |           |
| Clear filter                      | All expenses shown          |           |
| Filter by date range (this month) | Only this month's expenses  |           |
| Search for "Electric"             | Matching expenses displayed |           |
| Clear search                      | All expenses visible again  |           |

### Step 6: Expense Categories

Test each expense category:

| Category      | Test Action                       | Pass/Fail |
| ------------- | --------------------------------- | --------- |
| Utilities     | Create expense with this category |           |
| Maintenance   | Create expense with this category |           |
| Supplies      | Create expense with this category |           |
| Salaries      | Create expense with this category |           |
| Marketing     | Create expense with this category |           |
| Miscellaneous | Create expense with this category |           |

### Step 7: Delete Expense

| Action                           | Expected Result                 | Pass/Fail |
| -------------------------------- | ------------------------------- | --------- |
| Select test expense              | Expense highlighted             |           |
| Click "Delete" button            | Confirmation dialog appears     |           |
| Click "Cancel"                   | Dialog closes, expense remains  |           |
| Click "Delete" again             | Confirmation dialog appears     |           |
| Click "Confirm Delete"           | Expense deleted, toast confirms |           |
| Verify expense removed from list | Expense no longer visible       |           |

### Step 8: Bulk Operations (if available)

| Action                                | Expected Result              | Pass/Fail |
| ------------------------------------- | ---------------------------- | --------- |
| Select multiple expenses (checkboxes) | Checkboxes checked           |           |
| Click "Export Selected"               | Selected expenses exported   |           |
| Select multiple expenses              | Checkboxes checked           |           |
| Click "Delete Selected"               | Confirmation for bulk delete |           |

## Validation Rules

Test input validation:

| Input       | Test Value           | Expected Result                | Pass/Fail |
| ----------- | -------------------- | ------------------------------ | --------- |
| Amount      | -100                 | Error: Amount must be positive |           |
| Amount      | 0                    | Error: Amount required         |           |
| Amount      | abc                  | Error: Invalid number          |           |
| Amount      | 999999999            | Accepted or reasonable limit   |           |
| Description | Empty                | Error: Description required    |           |
| Description | 1000+ characters     | Accepted or truncated          |           |
| Date        | Future date          | Accepted or warning            |           |
| Date        | Very old date (2020) | Accepted or warning            |           |

## Expected Results

- Expense CRUD operations work correctly
- Receipt upload and preview function properly
- Category filtering is accurate
- Input validation prevents invalid data
- Deleted expenses are removed from all views
- Financial totals update after changes

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Expense Created:
- ID: _______________
- Amount: _______________
- Category: _______________

Issues Found:
_________________________________
_________________________________
```
