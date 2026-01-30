# View Bookings Tests (Staff - Read Only)

**Role**: Staff
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Staff user (`jasonacido+staff@gmail.com`)
- [ ] At least 3-5 existing bookings in the system
- [ ] Bookings in various states (Pending, Confirmed, Cancelled)
- [ ] Browser DevTools console open for error checking

---

### TC-STAFF-BK-001: Access Bookings List

**Goal**: Verify staff can access the bookings list page

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Navigate to `/admin/bookings`
2. Verify the page loads without console errors
3. Check that bookings table/list is visible
4. Verify column headers are present:
   - Booking Reference
   - Guest Name
   - Unit
   - Check-in Date
   - Check-out Date
   - Status
   - Total Amount
5. Verify data rows are populated
6. Check for pagination if many records exist
7. Note the total number of bookings displayed

**Expected Results**:

- [ ] Page loads without errors
- [ ] Bookings table is visible and populated
- [ ] All expected columns are present
- [ ] Data is properly formatted

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-002: View Booking Details

**Goal**: Verify staff can view detailed information for a booking

**Preconditions**:

- On the bookings list page
- At least one booking exists

**Steps**:

1. Locate a booking in the list
2. Click on the booking row or "View" button
3. Verify booking detail view/modal opens
4. Check that all details are displayed:
   - Booking reference
   - Guest information (name, email, phone)
   - Unit details
   - Check-in/check-out dates
   - Number of guests
   - Total amount
   - Payment status
   - Special requests/notes
   - Booking status
   - Created date
5. Verify no console errors
6. Close the detail view
7. Verify return to list view

**Expected Results**:

- [ ] Can view booking details
- [ ] All information is displayed correctly
- [ ] Can close and return to list
- [ ] No errors during viewing

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-003: Search and Filter Bookings

**Goal**: Verify staff can search and filter the bookings list

**Preconditions**:

- On the bookings list page
- Multiple bookings with different statuses exist

**Steps**:

1. Locate the search/filter controls
2. Enter a known booking reference in search
3. Verify matching booking appears
4. Clear search and verify full list returns
5. Search by guest name
6. Verify matching bookings appear
7. Use status filter - select "Pending"
8. Verify only pending bookings shown
9. Change filter to "Confirmed"
10. Verify only confirmed bookings shown
11. Use date range filter (if available)
12. Verify filtered results match criteria
13. Clear all filters
14. Verify full list returns

**Expected Results**:

- [ ] Search by reference works
- [ ] Search by guest name works
- [ ] Status filter works correctly
- [ ] Date filters work (if available)
- [ ] Filters can be cleared

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-004: Bookings Table Sorting

**Goal**: Verify staff can sort the bookings table

**Preconditions**:

- On the bookings list page
- Multiple bookings exist

**Steps**:

1. Locate sortable column headers
2. Click on "Check-in Date" header
3. Verify bookings sort by check-in date (ascending)
4. Click again
5. Verify sort reverses (descending)
6. Click on "Booking Reference" header
7. Verify sort by reference
8. Click on "Status" header
9. Verify sort by status
10. Click on "Total Amount" header (if sortable)
11. Verify numeric sort works correctly
12. Note which columns are sortable

**Expected Results**:

- [ ] Clicking headers toggles sort
- [ ] Ascending/descending sort works
- [ ] Numeric sorting is correct
- [ ] Sort indicator visible on active column

**Result**: [ ] Pass [ ] Fail

**Sortable Columns**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-005: Pagination

**Goal**: Verify pagination works correctly for large booking lists

**Preconditions**:

- More than one page of bookings exists (usually >10-25 records)

**Steps**:

1. Navigate to `/admin/bookings`
2. Check if pagination controls are visible
3. Note the number of items per page
4. Click "Next" or page 2
5. Verify next set of bookings loads
6. Note the booking references on page 2
7. Click "Previous" or page 1
8. Verify original bookings return
9. If page numbers are shown, click a middle page
10. Verify correct page loads
11. Check total count display (if shown)
12. Test last page navigation

**Expected Results**:

- [ ] Pagination controls work
- [ ] Page navigation is accurate
- [ ] Total count is accurate
- [ ] No duplicate records across pages

**Result**: [ ] Pass [ ] Fail

**Items Per Page**: \_\_\_

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-006: Verify Edit Controls Are Disabled/Hidden

**Goal**: Verify staff cannot edit bookings (read-only access)

**Preconditions**:

- Logged in as Staff
- On the bookings list page

**Steps**:

1. Look for "Create Booking" or "Add" button
2. Verify it is either hidden or disabled for staff
3. Click on a booking to view details
4. Look for "Edit" button
5. Verify Edit is hidden or disabled
6. Look for "Delete" or "Cancel" button
7. Verify Delete/Cancel is hidden or disabled
8. Look for "Change Status" controls
9. Verify status change is not allowed
10. Try to modify any field
11. Verify modifications are not possible
12. Check browser console for permission errors

**Expected Results**:

- [ ] No "Create Booking" available
- [ ] No "Edit" option available
- [ ] No "Delete" option available
- [ ] Status cannot be changed
- [ ] Staff has read-only access

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-007: Direct URL Edit Attempt

**Goal**: Verify staff cannot access edit routes directly via URL

**Preconditions**:

- Logged in as Staff
- Know a booking ID

**Steps**:

1. Note a booking ID from the list
2. Try navigating to `/admin/bookings/{id}/edit`
3. Verify access is denied or redirect occurs
4. Try navigating to `/admin/bookings/new`
5. Verify access is denied or redirect occurs
6. Check the error/redirect behavior
7. Verify staff is not able to reach edit forms
8. Check network tab for 403 Forbidden responses

**Expected Results**:

- [ ] Edit route redirects or shows access denied
- [ ] New booking route redirects or shows access denied
- [ ] API returns proper 403 status
- [ ] Clear feedback about permission denial

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-008: Booking Status Display

**Goal**: Verify all booking statuses display correctly

**Preconditions**:

- Bookings exist in various statuses

**Steps**:

1. Navigate to `/admin/bookings`
2. Find a booking with "Pending" status
3. Verify status shows with appropriate styling (e.g., yellow badge)
4. Find a booking with "Confirmed" status
5. Verify status shows with appropriate styling (e.g., green badge)
6. Find a booking with "Cancelled" status (if exists)
7. Verify status shows with appropriate styling (e.g., red badge)
8. Find a booking with "Completed" status (if exists)
9. Verify status shows with appropriate styling
10. Check that status badges are consistent

**Expected Results**:

- [ ] Pending status displays correctly
- [ ] Confirmed status displays correctly
- [ ] Cancelled status displays correctly
- [ ] Status colors/badges are consistent
- [ ] Status is easily scannable

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-009: Payment Status Integration

**Goal**: Verify booking list shows payment status correctly

**Preconditions**:

- Bookings exist with different payment statuses

**Steps**:

1. Navigate to `/admin/bookings`
2. Check if payment status column/indicator exists
3. Find a booking with "Unpaid" status
4. Verify unpaid indicator is clear
5. Find a booking with "Partial Payment"
6. Verify partial payment shows correctly
7. Find a booking with "Fully Paid" status
8. Verify fully paid indicator is positive
9. View booking details
10. Verify payment breakdown is visible in details
11. Check for links to payment records

**Expected Results**:

- [ ] Payment status is visible in list
- [ ] Different payment states are distinguishable
- [ ] Payment details accessible in booking view
- [ ] Integration with payments is consistent

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-BK-010: Export/Print Functionality

**Goal**: Verify staff can export or print booking information

**Preconditions**:

- On the bookings list or detail view

**Steps**:

1. Navigate to `/admin/bookings`
2. Look for "Export" or "Download" button
3. If available:
   - Click Export
   - Select format (CSV, PDF, etc.)
   - Verify file downloads
   - Open and verify data accuracy
4. Look for "Print" functionality
5. If available:
   - Click Print
   - Verify print preview shows properly
   - Verify no console errors
6. If export/print not available:
   - Document as feature gap or intentional omission
7. Check if individual booking can be printed

**Expected Results**:

- [ ] Export/Print is available (or documented as not implemented)
- [ ] Exported data is accurate
- [ ] Print layout is readable
- [ ] Staff has access to these features (if implemented)

**Result**: [ ] Pass [ ] Fail [ ] N/A (feature not implemented)

**Notes/Issues Found**:

---

---

## Summary

| Test Case       | Description                   | Result |
| --------------- | ----------------------------- | ------ |
| TC-STAFF-BK-001 | Access Bookings List          |        |
| TC-STAFF-BK-002 | View Booking Details          |        |
| TC-STAFF-BK-003 | Search and Filter Bookings    |        |
| TC-STAFF-BK-004 | Bookings Table Sorting        |        |
| TC-STAFF-BK-005 | Pagination                    |        |
| TC-STAFF-BK-006 | Verify Edit Controls Disabled |        |
| TC-STAFF-BK-007 | Direct URL Edit Attempt       |        |
| TC-STAFF-BK-008 | Booking Status Display        |        |
| TC-STAFF-BK-009 | Payment Status Integration    |        |
| TC-STAFF-BK-010 | Export/Print Functionality    |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
