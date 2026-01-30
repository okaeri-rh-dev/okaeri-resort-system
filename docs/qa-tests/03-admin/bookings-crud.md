# Bookings CRUD Tests (Admin - Full Access)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] At least one unit available for bookings
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-BK-001: Create New Booking

**Goal**: Verify admin can create a new booking

**Preconditions**:

- Logged in as Admin
- At least one unit available

**Steps**:

1. Navigate to `/admin/bookings`
2. Click "New Booking" or "Add Booking" button
3. Verify booking form opens
4. Fill in guest information:
   - Guest name: "QA Test Admin Guest"
   - Email: "qaadmin@example.com"
   - Phone: "09181234567"
5. Select check-in date (2 days from today)
6. Select check-out date (4 days from today)
7. Select an available unit
8. Set guest count: 3
9. Add special requests: "Admin created booking - QA test"
10. Click "Create Booking" or "Save"
11. Verify loading state appears
12. Verify success message/toast
13. Verify booking appears in the list
14. Note the booking reference

**Expected Results**:

- [ ] Booking form accessible
- [ ] All fields editable
- [ ] Booking created successfully
- [ ] Reference number generated
- [ ] Booking visible in list

**Result**: [ ] Pass [ ] Fail

**Booking Reference Created**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-002: Create Booking Validation

**Goal**: Verify booking creation form validation

**Preconditions**:

- On the create booking form

**Steps**:

1. Click "Create Booking" without filling any fields
2. Verify validation errors for required fields
3. Fill guest name only
4. Verify remaining field errors
5. Enter invalid email format
6. Verify email validation
7. Select check-out date before check-in
8. Verify date validation error
9. Select a date range for a booked unit
10. Verify availability validation
11. Enter guest count exceeding unit capacity
12. Verify capacity validation
13. Fix all errors and submit successfully

**Expected Results**:

- [ ] Required field validation works
- [ ] Email format validation works
- [ ] Date logic validation works
- [ ] Availability validation works
- [ ] Capacity validation works

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-003: Edit Existing Booking

**Goal**: Verify admin can edit booking details

**Preconditions**:

- A booking exists (create one if needed)

**Steps**:

1. Navigate to `/admin/bookings`
2. Find the booking created in TC-ADMIN-BK-001
3. Click "Edit" button or icon
4. Verify edit form loads with existing data
5. Modify guest name: append " - EDITED"
6. Change check-out date (extend by 1 day)
7. Modify special requests
8. Click "Save Changes"
9. Verify loading state
10. Verify success message
11. View booking details
12. Verify all changes were saved
13. Check that unchanged fields remain correct

**Expected Results**:

- [ ] Edit form loads with correct data
- [ ] Can modify all editable fields
- [ ] Changes are saved successfully
- [ ] Data persists after save

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-004: Change Booking Status

**Goal**: Verify admin can change booking status

**Preconditions**:

- A pending booking exists

**Steps**:

1. Navigate to `/admin/bookings`
2. Find a booking with "Pending" status
3. Click on booking or Edit
4. Locate status change controls
5. Change status to "Confirmed"
6. Verify confirmation dialog (if present)
7. Confirm the status change
8. Verify success message
9. Verify status shows as "Confirmed"
10. Try changing to "Cancelled"
11. Verify cancellation works
12. Check for cancellation reason field (if required)

**Expected Results**:

- [ ] Can change from Pending to Confirmed
- [ ] Can change to Cancelled
- [ ] Status changes persist
- [ ] Appropriate confirmations shown

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-005: Delete Booking

**Goal**: Verify admin can delete a booking

**Preconditions**:

- A test booking exists (preferably one created for testing)

**Steps**:

1. Navigate to `/admin/bookings`
2. Find a test booking to delete
3. Click "Delete" button or icon
4. Verify confirmation dialog appears
5. Verify dialog warns about data loss
6. Click "Cancel" - verify dialog closes
7. Click "Delete" again
8. Confirm deletion
9. Verify success message
10. Verify booking no longer in list
11. Try to access deleted booking URL directly
12. Verify appropriate 404 or "not found" handling

**Expected Results**:

- [ ] Delete confirmation is required
- [ ] Can cancel deletion
- [ ] Booking is permanently removed
- [ ] Cannot access deleted booking

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-006: Assign Payment to Booking

**Goal**: Verify admin can record payments against a booking

**Preconditions**:

- An unpaid or partially paid booking exists

**Steps**:

1. Navigate to `/admin/bookings`
2. Find a booking with pending payment
3. View booking details
4. Look for "Add Payment" or payment section
5. Click to add a new payment
6. Fill payment details:
   - Amount: 1000
   - Payment method: GCash
   - Reference/Transaction ID: "QA-PAY-001"
7. Upload a receipt image (if applicable)
8. Save the payment
9. Verify payment appears in booking
10. Verify payment total updates
11. Add another partial payment
12. Verify cumulative total is correct

**Expected Results**:

- [ ] Can add payment to booking
- [ ] Payment details saved correctly
- [ ] Receipt upload works (if implemented)
- [ ] Payment totals calculated correctly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-007: Multi-Unit Booking

**Goal**: Verify admin can create bookings with multiple units

**Preconditions**:

- Multiple units available for the same date range

**Steps**:

1. Navigate to create new booking
2. Fill guest information
3. Select date range
4. Look for multi-unit selection option
5. If supported:
   - Select first unit
   - Add second unit
   - Verify both appear
   - Check combined pricing
6. If not supported:
   - Document as single-unit only
7. Complete the booking
8. Verify all units are assigned
9. View booking details
10. Verify all units listed

**Expected Results**:

- [ ] Multi-unit selection works (if implemented)
- [ ] OR documented as single-unit only
- [ ] Pricing reflects all units
- [ ] Booking shows all assigned units

**Result**: [ ] Pass [ ] Fail [ ] N/A (multi-unit not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-008: Booking Notes and History

**Goal**: Verify admin can add notes and view booking history

**Preconditions**:

- An existing booking

**Steps**:

1. Navigate to a booking's details
2. Look for notes/comments section
3. Add a note: "QA Admin test note - " + timestamp
4. Save the note
5. Verify note appears with timestamp
6. Look for booking history/audit section
7. Verify history shows:
   - Creation date/time
   - Status changes
   - Modifications
   - Who made changes
8. Make an edit to the booking
9. Refresh and check history updated

**Expected Results**:

- [ ] Can add notes to bookings
- [ ] Notes saved with timestamps
- [ ] History shows booking changes
- [ ] History includes actor information

**Result**: [ ] Pass [ ] Fail [ ] N/A (feature not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-009: Search and Bulk Operations

**Goal**: Verify admin can search and perform bulk operations

**Preconditions**:

- Multiple bookings exist

**Steps**:

1. Navigate to `/admin/bookings`
2. Search for bookings by guest name
3. Verify filtered results
4. Look for bulk selection (checkboxes)
5. If bulk selection exists:
   - Select multiple bookings
   - Look for bulk actions (export, status change, etc.)
   - Test bulk export if available
   - Test bulk status change if available
6. If no bulk selection:
   - Document as not implemented
7. Test advanced filters (date range, status, unit)
8. Verify filter combinations work

**Expected Results**:

- [ ] Search works correctly
- [ ] Bulk selection available (or documented as N/A)
- [ ] Bulk actions work (or documented as N/A)
- [ ] Advanced filters work

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-BK-010: Booking Calendar Integration

**Goal**: Verify booking calendar shows all admin-created bookings

**Preconditions**:

- Bookings exist for various dates

**Steps**:

1. Navigate to `/admin/availability` or calendar view
2. Verify admin-created bookings appear
3. Find a booking on the calendar
4. Click on the booking
5. Verify details pop-up or navigation
6. Verify booking status is reflected
7. Check that cancelled bookings show differently
8. Navigate to different months
9. Verify data loads correctly
10. Create a new booking for today
11. Refresh calendar and verify it appears

**Expected Results**:

- [ ] All bookings visible on calendar
- [ ] Click navigates to booking
- [ ] Status reflected visually
- [ ] Calendar updates with new bookings

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

## Summary

| Test Case       | Description                  | Result |
| --------------- | ---------------------------- | ------ |
| TC-ADMIN-BK-001 | Create New Booking           |        |
| TC-ADMIN-BK-002 | Create Booking Validation    |        |
| TC-ADMIN-BK-003 | Edit Existing Booking        |        |
| TC-ADMIN-BK-004 | Change Booking Status        |        |
| TC-ADMIN-BK-005 | Delete Booking               |        |
| TC-ADMIN-BK-006 | Assign Payment to Booking    |        |
| TC-ADMIN-BK-007 | Multi-Unit Booking           |        |
| TC-ADMIN-BK-008 | Booking Notes and History    |        |
| TC-ADMIN-BK-009 | Search and Bulk Operations   |        |
| TC-ADMIN-BK-010 | Booking Calendar Integration |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
