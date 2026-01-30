# View Payments Tests (Staff - Read Only)

**Role**: Staff
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Staff user (`jasonacido+staff@gmail.com`)
- [ ] At least 3-5 existing payment records in the system
- [ ] Payments in various statuses (Pending, Verified, Rejected)
- [ ] Browser DevTools console open for error checking

---

### TC-STAFF-PAY-001: Access Payments List

**Goal**: Verify staff can access the payments list page

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Navigate to `/admin/payments`
2. Verify the page loads without console errors
3. Check that payments table/list is visible
4. Verify column headers are present:
   - Payment ID/Reference
   - Booking Reference
   - Guest Name
   - Amount
   - Payment Method
   - Date
   - Status
5. Verify data rows are populated
6. Check for pagination if many records exist
7. Note the total number of payments displayed

**Expected Results**:

- [ ] Page loads without errors
- [ ] Payments table is visible and populated
- [ ] All expected columns are present
- [ ] Data is properly formatted

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-002: View Payment Details

**Goal**: Verify staff can view detailed information for a payment

**Preconditions**:

- On the payments list page
- At least one payment exists

**Steps**:

1. Locate a payment in the list
2. Click on the payment row or "View" button
3. Verify payment detail view/modal opens
4. Check that all details are displayed:
   - Payment ID/reference
   - Associated booking reference
   - Guest name
   - Amount paid
   - Payment method (Cash, GCash, Bank Transfer, etc.)
   - Payment date
   - Status (Pending/Verified/Rejected)
   - Receipt image (if uploaded)
   - Notes
   - Verified by (if verified)
   - Verification date
5. Verify no console errors
6. Close the detail view
7. Verify return to list view

**Expected Results**:

- [ ] Can view payment details
- [ ] All information is displayed correctly
- [ ] Receipt image displays (if present)
- [ ] No errors during viewing

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-003: Search and Filter Payments

**Goal**: Verify staff can search and filter the payments list

**Preconditions**:

- On the payments list page
- Multiple payments exist

**Steps**:

1. Locate the search/filter controls
2. Enter a known booking reference in search
3. Verify matching payment(s) appear
4. Clear search and verify full list returns
5. Search by guest name
6. Verify matching payments appear
7. Use status filter - select "Pending"
8. Verify only pending payments shown
9. Change filter to "Verified"
10. Verify only verified payments shown
11. Filter by payment method (if available)
12. Use date range filter (if available)
13. Clear all filters
14. Verify full list returns

**Expected Results**:

- [ ] Search by booking reference works
- [ ] Search by guest name works
- [ ] Status filter works correctly
- [ ] Method filter works (if available)
- [ ] Filters can be cleared

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-004: Payment Method Display

**Goal**: Verify different payment methods are displayed correctly

**Preconditions**:

- Payments exist with different payment methods

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with "Cash" method
3. Verify Cash displays with appropriate icon/label
4. Find a payment with "GCash" method
5. Verify GCash displays correctly
6. Find a payment with "Bank Transfer" method
7. Verify Bank Transfer displays correctly
8. Find a payment with "Credit Card" method (if exists)
9. Verify Credit Card displays correctly
10. Check that method icons/badges are consistent
11. Verify method is visible in both list and detail views

**Expected Results**:

- [ ] Cash payments display correctly
- [ ] GCash payments display correctly
- [ ] Bank Transfer displays correctly
- [ ] All methods are easily distinguishable
- [ ] Consistent display across views

**Result**: [ ] Pass [ ] Fail

**Payment Methods Found**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-005: Receipt Image Viewing

**Goal**: Verify staff can view uploaded receipt images

**Preconditions**:

- At least one payment has a receipt image uploaded

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment that has a receipt attached
3. Click to view payment details
4. Locate the receipt image/thumbnail
5. Click on the receipt image
6. Verify image opens in larger view/modal
7. Check image is clear and readable
8. Verify zoom functionality (if available)
9. Close the image viewer
10. Verify return to payment details
11. Check for proper loading states for images

**Expected Results**:

- [ ] Receipt images are visible
- [ ] Can view full-size image
- [ ] Image quality is preserved
- [ ] Loading states work correctly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-006: Verify Edit/Verify Controls Are Disabled

**Goal**: Verify staff cannot verify or edit payments (read-only access)

**Preconditions**:

- Logged in as Staff
- On the payments list page

**Steps**:

1. Look for "Add Payment" or "Record Payment" button
2. Verify it is either hidden or disabled for staff
3. Click on a payment to view details
4. Look for "Verify" button
5. Verify the Verify button is hidden or disabled
6. Look for "Edit" button
7. Verify Edit is hidden or disabled
8. Look for "Delete" or "Reject" button
9. Verify Delete/Reject is hidden or disabled
10. Try to interact with status controls
11. Verify status cannot be changed
12. Check browser console for permission errors

**Expected Results**:

- [ ] No "Add Payment" available
- [ ] No "Verify" option available
- [ ] No "Edit" option available
- [ ] No "Delete/Reject" available
- [ ] Staff has read-only access

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-007: Direct URL Verify Attempt

**Goal**: Verify staff cannot access verify/edit routes directly

**Preconditions**:

- Logged in as Staff
- Know a payment ID

**Steps**:

1. Note a payment ID from the list
2. Try navigating to `/admin/payments/{id}/verify`
3. Verify access is denied or redirect occurs
4. Try navigating to `/admin/payments/{id}/edit`
5. Verify access is denied or redirect occurs
6. Try navigating to `/admin/payments/new`
7. Verify access is denied or redirect occurs
8. Check network tab for 403 Forbidden responses
9. Verify staff cannot access restricted endpoints

**Expected Results**:

- [ ] Verify route denies access
- [ ] Edit route denies access
- [ ] New payment route denies access
- [ ] API returns proper 403 status

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-008: Payment Status Indicators

**Goal**: Verify payment statuses display with appropriate visual indicators

**Preconditions**:

- Payments exist in various statuses

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with "Pending Verification" status
3. Verify status shows with appropriate styling (e.g., yellow/orange)
4. Find a payment with "Verified" status
5. Verify status shows with appropriate styling (e.g., green)
6. Find a payment with "Rejected" status (if exists)
7. Verify status shows with appropriate styling (e.g., red)
8. Check that status badges are consistent with booking list
9. Verify status meaning is clear to users
10. Check for status descriptions on hover (if implemented)

**Expected Results**:

- [ ] Pending status displays correctly
- [ ] Verified status displays correctly
- [ ] Rejected status displays correctly
- [ ] Status colors are intuitive
- [ ] Consistent styling throughout

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-009: Booking Link Navigation

**Goal**: Verify staff can navigate from payment to associated booking

**Preconditions**:

- On the payments list or detail view

**Steps**:

1. Navigate to `/admin/payments`
2. Locate a payment with a booking reference
3. Click on the booking reference link
4. Verify navigation to the booking detail/list
5. Verify the correct booking is shown
6. Navigate back to payments
7. Repeat for a different payment
8. Verify links are consistently available
9. Check that orphan payments (no booking) handle gracefully

**Expected Results**:

- [ ] Booking links are clickable
- [ ] Links navigate to correct booking
- [ ] Can navigate back to payments
- [ ] Non-linked payments handle gracefully

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-PAY-010: Payment Summary/Totals

**Goal**: Verify payment summary or totals are displayed correctly

**Preconditions**:

- Multiple payments exist

**Steps**:

1. Navigate to `/admin/payments`
2. Look for payment summary section:
   - Total payments today
   - Total amount collected
   - Pending verification count
3. If no summary visible, document as feature gap
4. Check if filtered view updates totals
5. Apply a date filter
6. Verify summary reflects filtered data
7. Check summary for a specific booking
8. Verify payment breakdown is accurate
9. Compare displayed totals with manual calculation

**Expected Results**:

- [ ] Summary/totals are visible (if implemented)
- [ ] Totals are mathematically accurate
- [ ] Totals update with filters
- [ ] Per-booking payment totals are correct

**Result**: [ ] Pass [ ] Fail [ ] N/A (feature not implemented)

**Notes/Issues Found**:

---

---

## Summary

| Test Case        | Description                          | Result |
| ---------------- | ------------------------------------ | ------ |
| TC-STAFF-PAY-001 | Access Payments List                 |        |
| TC-STAFF-PAY-002 | View Payment Details                 |        |
| TC-STAFF-PAY-003 | Search and Filter Payments           |        |
| TC-STAFF-PAY-004 | Payment Method Display               |        |
| TC-STAFF-PAY-005 | Receipt Image Viewing                |        |
| TC-STAFF-PAY-006 | Verify Edit/Verify Controls Disabled |        |
| TC-STAFF-PAY-007 | Direct URL Verify Attempt            |        |
| TC-STAFF-PAY-008 | Payment Status Indicators            |        |
| TC-STAFF-PAY-009 | Booking Link Navigation              |        |
| TC-STAFF-PAY-010 | Payment Summary/Totals               |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
