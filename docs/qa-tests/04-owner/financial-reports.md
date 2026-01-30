# QA Test: Owner Financial Reports

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-002    |
| **Priority**       | Critical   |
| **Role Required**  | Owner      |
| **Estimated Time** | 15 minutes |

## Objective

Verify that owners can access comprehensive financial reports, including revenue analytics, expense summaries, and profit calculations.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] System has bookings with various payment statuses
- [ ] Expenses have been recorded in the system
- [ ] Multiple date ranges of data exist

## Test Steps

### Step 1: Access Dashboard Financial Overview

| Action                          | Expected Result                 | Pass/Fail |
| ------------------------------- | ------------------------------- | --------- |
| Navigate to Dashboard           | Financial summary cards visible |           |
| Verify "Total Revenue" card     | Shows accurate revenue figure   |           |
| Verify "Pending Payments" card  | Shows outstanding balance       |           |
| Verify "Total Expenses" card    | Shows expense totals            |           |
| Verify "Net Profit" calculation | Revenue - Expenses displayed    |           |

### Step 2: Revenue Analytics

| Action                           | Expected Result                   | Pass/Fail |
| -------------------------------- | --------------------------------- | --------- |
| Filter by "This Month"           | Shows current month revenue       |           |
| Filter by "Last 30 Days"         | Shows rolling 30-day revenue      |           |
| Filter by "This Year"            | Shows year-to-date revenue        |           |
| Filter by custom date range      | Shows revenue for selected period |           |
| Verify revenue breakdown by unit | Per-unit revenue visible          |           |

### Step 3: Payment Status Report

| Action                         | Expected Result                   | Pass/Fail |
| ------------------------------ | --------------------------------- | --------- |
| View "Verified Payments" total | Sum of all verified payments      |           |
| View "Pending Payments" total  | Sum of unverified payments        |           |
| View "Partial Payments"        | Bookings with remaining balance   |           |
| View "Overdue Payments"        | Past-due payment amounts          |           |
| Click on payment category      | Filters to show relevant bookings |           |

### Step 4: Expense Analysis

| Action                       | Expected Result               | Pass/Fail |
| ---------------------------- | ----------------------------- | --------- |
| Navigate to Expenses section | Expense list visible          |           |
| View expenses by category    | Categorized expense breakdown |           |
| View expenses by date range  | Filtered expense list         |           |
| View expense trends          | Month-over-month comparison   |           |
| Calculate total expenses     | Sum matches individual items  |           |

### Step 5: Profit Calculation

| Action                      | Expected Result                | Pass/Fail |
| --------------------------- | ------------------------------ | --------- |
| View Gross Revenue          | Total of all verified payments |           |
| View Total Expenses         | Sum of all expenses            |           |
| View Net Profit             | Gross Revenue - Total Expenses |           |
| Verify calculation accuracy | Manual calculation matches     |           |

### Step 6: Data Export

| Action                          | Expected Result               | Pass/Fail |
| ------------------------------- | ----------------------------- | --------- |
| Export revenue report to CSV    | CSV file downloads            |           |
| Export expense report to CSV    | CSV file downloads            |           |
| Export financial summary to PDF | PDF report generates          |           |
| Verify exported data accuracy   | Data matches on-screen values |           |

## Data Validation Checks

### Revenue Accuracy Check

```
Sample Verification:
- Pick 5 random bookings from the report
- Manually sum their payment amounts
- Compare to reported subtotal for those bookings
- Expected: Values should match exactly
```

### Expense Accuracy Check

```
Sample Verification:
- Pick 5 random expenses from the report
- Manually sum their amounts
- Compare to reported subtotal
- Expected: Values should match exactly
```

## Expected Results

- All financial metrics are calculated accurately
- Date range filters work correctly
- Export functions produce valid files
- Net profit = Verified Revenue - Total Expenses
- No discrepancies in financial calculations

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Revenue Test Period: _______________
Calculated Revenue: _______________
System Revenue: _______________
Match: [ ] Yes [ ] No

Net Profit Test:
Gross Revenue: _______________
Total Expenses: _______________
Expected Net: _______________
System Net: _______________
Match: [ ] Yes [ ] No

Additional observations:
_________________________________
_________________________________
```
