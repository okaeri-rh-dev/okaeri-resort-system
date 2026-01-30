# QA Test: Owner Data Export Functions

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-005    |
| **Priority**       | Medium     |
| **Role Required**  | Owner      |
| **Estimated Time** | 12 minutes |

## Objective

Verify that owners can export system data in various formats (CSV, PDF) for reporting, backup, and external analysis purposes.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] System has sufficient data (bookings, payments, expenses)
- [ ] Browser allows file downloads
- [ ] Spreadsheet application available to verify CSV files

## Test Steps

### Step 1: Booking Data Export

| Action                      | Expected Result                                | Pass/Fail |
| --------------------------- | ---------------------------------------------- | --------- |
| Navigate to Bookings        | Bookings list displayed                        |           |
| Click "Export" or menu icon | Export options appear                          |           |
| Select "Export to CSV"      | Download starts                                |           |
| Open downloaded CSV file    | File opens in spreadsheet app                  |           |
| Verify columns present      | Booking ID, Guest, Unit, Dates, Status, Amount |           |
| Verify data matches screen  | Records match displayed bookings               |           |
| Count rows                  | Row count matches booking count                |           |

### Step 2: Filtered Booking Export

| Action                                | Expected Result                 | Pass/Fail |
| ------------------------------------- | ------------------------------- | --------- |
| Filter bookings by status "Confirmed" | Filtered list shown             |           |
| Export filtered results               | CSV downloads                   |           |
| Open CSV file                         | Only confirmed bookings present |           |
| Filter by date range                  | Filtered list shown             |           |
| Export filtered results               | CSV downloads                   |           |
| Verify date range in export           | Only selected dates included    |           |

### Step 3: Payment Data Export

| Action                 | Expected Result                                   | Pass/Fail |
| ---------------------- | ------------------------------------------------- | --------- |
| Navigate to Payments   | Payments list displayed                           |           |
| Click "Export" option  | Export options appear                             |           |
| Select "Export to CSV" | Download starts                                   |           |
| Open downloaded CSV    | File opens correctly                              |           |
| Verify columns         | Payment ID, Booking, Amount, Method, Status, Date |           |
| Verify amounts         | Amounts match displayed values                    |           |

### Step 4: Expense Data Export

| Action                 | Expected Result                                 | Pass/Fail |
| ---------------------- | ----------------------------------------------- | --------- |
| Navigate to Expenses   | Expenses list displayed                         |           |
| Click "Export" option  | Export options appear                           |           |
| Select "Export to CSV" | Download starts                                 |           |
| Open downloaded CSV    | File opens correctly                            |           |
| Verify columns         | Expense ID, Description, Category, Amount, Date |           |
| Sum amount column      | Total matches on-screen total                   |           |

### Step 5: Guest Data Export

| Action                 | Expected Result                              | Pass/Fail |
| ---------------------- | -------------------------------------------- | --------- |
| Navigate to Guests     | Guest list displayed                         |           |
| Click "Export" option  | Export options appear                        |           |
| Select "Export to CSV" | Download starts                              |           |
| Open downloaded CSV    | File opens correctly                         |           |
| Verify columns         | Guest ID, Name, Email, Phone, Total Bookings |           |
| Verify PII handling    | Sensitive data appropriately included        |           |

### Step 6: Financial Report Export (PDF)

| Action                            | Expected Result                     | Pass/Fail |
| --------------------------------- | ----------------------------------- | --------- |
| Navigate to Dashboard/Reports     | Reports section visible             |           |
| Select "Financial Summary" report | Report options appear               |           |
| Select date range                 | Date picker works                   |           |
| Click "Generate PDF"              | PDF generation starts               |           |
| Open downloaded PDF               | PDF opens in viewer                 |           |
| Verify report contents            | Revenue, expenses, net profit shown |           |
| Verify formatting                 | Professional report layout          |           |

### Step 7: Unit Occupancy Report Export

| Action                       | Expected Result                | Pass/Fail |
| ---------------------------- | ------------------------------ | --------- |
| Navigate to Units or Reports | Reports available              |           |
| Select "Occupancy Report"    | Report options appear          |           |
| Select month/period          | Date picker works              |           |
| Export to CSV                | Download starts                |           |
| Verify occupancy data        | Occupancy rates per unit shown |           |

### Step 8: Audit Log Export

| Action                 | Expected Result                           | Pass/Fail |
| ---------------------- | ----------------------------------------- | --------- |
| Navigate to Audit Logs | Audit logs displayed                      |           |
| Filter by date range   | Filtered logs shown                       |           |
| Click "Export"         | Export options appear                     |           |
| Download CSV           | Audit log data exports                    |           |
| Verify log entries     | Action, User, Timestamp, Details included |           |

## CSV Format Validation

| Check           | Requirement                        | Pass/Fail |
| --------------- | ---------------------------------- | --------- |
| File encoding   | UTF-8 (handles special characters) |           |
| Delimiter       | Comma-separated values             |           |
| Header row      | First row contains column names    |           |
| Date format     | Consistent ISO or locale format    |           |
| Currency format | Numbers without currency symbols   |           |
| Text quoting    | Strings with commas are quoted     |           |

## Data Accuracy Verification

Pick 5 random records from each export and verify:

| Export Type | Records Verified                                  | All Accurate | Pass/Fail |
| ----------- | ------------------------------------------------- | ------------ | --------- |
| Bookings    | 1. **\_** 2. **\_** 3. **\_** 4. **\_** 5. **\_** |              |           |
| Payments    | 1. **\_** 2. **\_** 3. **\_** 4. **\_** 5. **\_** |              |           |
| Expenses    | 1. **\_** 2. **\_** 3. **\_** 4. **\_** 5. **\_** |              |           |
| Guests      | 1. **\_** 2. **\_** 3. **\_** 4. **\_** 5. **\_** |              |           |

## Expected Results

- All export functions produce valid files
- CSV files open correctly in spreadsheet applications
- PDF reports are properly formatted
- Filtered exports only include matching records
- Data in exports matches on-screen data exactly
- Large exports complete without timeout

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________
Browser: _______________

Files Downloaded:
- [ ] bookings.csv
- [ ] payments.csv
- [ ] expenses.csv
- [ ] guests.csv
- [ ] financial-report.pdf
- [ ] occupancy-report.csv
- [ ] audit-logs.csv

Issues Found:
_________________________________
_________________________________
```
