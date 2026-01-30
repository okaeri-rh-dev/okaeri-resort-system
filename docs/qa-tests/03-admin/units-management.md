# Units Management Tests (Admin - Full Access)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] At least 2 existing units in the system
- [ ] Sample unit images for upload testing
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-UNIT-001: Access Units Management

**Goal**: Verify admin can access units management page

**Preconditions**:

- Logged in as Admin

**Steps**:

1. Navigate to `/admin/units`
2. Verify the page loads without console errors
3. Check that units list/table is visible
4. Verify column headers present:
   - Unit name
   - Type/Category
   - Capacity
   - Base price
   - Status (Active/Inactive)
5. Verify existing units are displayed
6. Check for "Add Unit" button
7. Verify admin has full access

**Expected Results**:

- [ ] Page loads without errors
- [ ] Units list is visible
- [ ] All columns present
- [ ] Add Unit button visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-002: Create New Unit

**Goal**: Verify admin can create a new unit/cabin

**Preconditions**:

- On the units management page

**Steps**:

1. Click "Add Unit" or "New Unit" button
2. Verify unit creation form opens
3. Fill in unit details:
   - Name: "QA Test Cabin"
   - Description: "Created by QA admin testing"
   - Type: select appropriate option
   - Max capacity: 4
   - Base price per night: 3500
4. Upload unit images (if available)
5. Set amenities (if available)
6. Set status to "Active"
7. Click "Save" or "Create"
8. Verify success message
9. Verify unit appears in list
10. View unit details to confirm data

**Expected Results**:

- [ ] Unit form accessible
- [ ] All fields editable
- [ ] Unit created successfully
- [ ] Unit visible in list
- [ ] All data saved correctly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-003: Unit Creation Validation

**Goal**: Verify unit creation form validation

**Preconditions**:

- On the create unit form

**Steps**:

1. Try to save without filling any fields
2. Verify required field validation errors
3. Enter only unit name
4. Verify remaining field validations
5. Enter negative base price
6. Verify price validation
7. Enter 0 for capacity
8. Verify capacity validation
9. Enter very long description
10. Verify character limit (if any)
11. Try duplicate unit name
12. Verify uniqueness validation (if implemented)

**Expected Results**:

- [ ] Required field validation works
- [ ] Price validation works
- [ ] Capacity validation works
- [ ] Character limits enforced
- [ ] Duplicate names handled

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-004: Edit Unit Details

**Goal**: Verify admin can edit unit information

**Preconditions**:

- A unit exists (e.g., QA Test Cabin)

**Steps**:

1. Navigate to `/admin/units`
2. Find the unit to edit
3. Click "Edit" button
4. Verify edit form loads with existing data
5. Modify unit details:
   - Change name: append " - EDITED"
   - Update description
   - Change base price
   - Update capacity
6. Save changes
7. Verify success message
8. View unit details
9. Verify all changes persisted
10. Check that unchanged fields remain correct

**Expected Results**:

- [ ] Edit form loads with correct data
- [ ] Can modify all fields
- [ ] Changes are saved
- [ ] Data persists after save

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-005: Activate/Deactivate Unit

**Goal**: Verify admin can change unit availability status

**Preconditions**:

- An active unit exists

**Steps**:

1. Navigate to `/admin/units`
2. Find an active unit
3. Click "Edit" or find status toggle
4. Change status to "Inactive"
5. Save changes
6. Verify success message
7. Verify unit shows as inactive in list
8. Try to create booking for inactive unit
9. Verify inactive unit is not available
10. Reactivate the unit
11. Verify unit becomes bookable again
12. Check public calendar reflects changes

**Expected Results**:

- [ ] Can deactivate units
- [ ] Inactive units not bookable
- [ ] Can reactivate units
- [ ] Status changes reflect immediately

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-006: Delete Unit

**Goal**: Verify admin can delete a unit

**Preconditions**:

- A test unit exists with no bookings

**Steps**:

1. Navigate to `/admin/units`
2. Find a unit with no existing bookings
3. Click "Delete" button
4. Verify confirmation dialog appears
5. Verify warning about permanent deletion
6. Click "Cancel" first
7. Verify dialog closes, unit remains
8. Click "Delete" again and confirm
9. Verify success message
10. Verify unit removed from list
11. Try to delete unit WITH existing bookings
12. Verify deletion is blocked or warned

**Expected Results**:

- [ ] Delete requires confirmation
- [ ] Unit without bookings can be deleted
- [ ] Unit with bookings protected
- [ ] Clear warning messages

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-007: Unit Image Management

**Goal**: Verify admin can manage unit images

**Preconditions**:

- A unit exists

**Steps**:

1. Navigate to unit edit page
2. Locate image upload section
3. Upload a primary image:
   - Select valid image file (JPG, PNG)
   - Verify upload progress
   - Verify image preview appears
4. Upload additional images (if supported)
5. Try uploading invalid file type
6. Verify validation error
7. Try uploading oversized image
8. Verify size limit validation
9. Delete an uploaded image
10. Verify image is removed
11. Save unit and verify images persist

**Expected Results**:

- [ ] Can upload images
- [ ] Upload progress shown
- [ ] Invalid files rejected
- [ ] Size limits enforced
- [ ] Can delete images
- [ ] Images persist after save

**Result**: [ ] Pass [ ] Fail

**Image Requirements**: Max size: **_, Formats: _**

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-008: Unit Amenities Configuration

**Goal**: Verify admin can configure unit amenities

**Preconditions**:

- A unit exists

**Steps**:

1. Navigate to unit edit page
2. Locate amenities section
3. Check/select available amenities:
   - WiFi
   - Air conditioning
   - Hot water
   - Kitchen
   - Parking
   - etc.
4. Add custom amenity (if supported)
5. Save the unit
6. Verify amenities saved
7. View unit on public booking page
8. Verify amenities displayed to guests
9. Remove an amenity
10. Verify removal persists

**Expected Results**:

- [ ] Can select amenities
- [ ] Custom amenities supported (if implemented)
- [ ] Amenities saved correctly
- [ ] Amenities visible to guests

**Result**: [ ] Pass [ ] Fail [ ] N/A (amenities not implemented)

**Available Amenities**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-009: Unit Availability Calendar

**Goal**: Verify admin can view/manage unit availability

**Preconditions**:

- A unit with some bookings exists

**Steps**:

1. Navigate to `/admin/units`
2. Find a unit with existing bookings
3. Look for "View Availability" or calendar link
4. Click to view unit's availability calendar
5. Verify booked dates are marked
6. Verify available dates are clear
7. Check for manual blocking feature
8. If blocking available:
   - Block a date range
   - Verify blocked dates show differently
   - Try to book blocked dates
   - Verify booking is prevented
9. Unblock dates
10. Verify dates become available

**Expected Results**:

- [ ] Can view unit's availability
- [ ] Booked dates clearly marked
- [ ] Manual blocking works (if implemented)
- [ ] Blocked dates prevent booking

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-UNIT-010: Unit Sorting and Search

**Goal**: Verify admin can search and sort units list

**Preconditions**:

- Multiple units exist

**Steps**:

1. Navigate to `/admin/units`
2. Locate search/filter controls
3. Search by unit name
4. Verify matching units shown
5. Clear search
6. Filter by unit type (if available)
7. Verify filtered results
8. Click column header to sort by name
9. Verify sorting works
10. Sort by price
11. Verify numeric sort correct
12. Sort by status
13. Verify status sort works

**Expected Results**:

- [ ] Search by name works
- [ ] Type filter works (if available)
- [ ] Column sorting works
- [ ] Multiple sort options available

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

## Summary

| Test Case         | Description                  | Result |
| ----------------- | ---------------------------- | ------ |
| TC-ADMIN-UNIT-001 | Access Units Management      |        |
| TC-ADMIN-UNIT-002 | Create New Unit              |        |
| TC-ADMIN-UNIT-003 | Unit Creation Validation     |        |
| TC-ADMIN-UNIT-004 | Edit Unit Details            |        |
| TC-ADMIN-UNIT-005 | Activate/Deactivate Unit     |        |
| TC-ADMIN-UNIT-006 | Delete Unit                  |        |
| TC-ADMIN-UNIT-007 | Unit Image Management        |        |
| TC-ADMIN-UNIT-008 | Unit Amenities Configuration |        |
| TC-ADMIN-UNIT-009 | Unit Availability Calendar   |        |
| TC-ADMIN-UNIT-010 | Unit Sorting and Search      |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
