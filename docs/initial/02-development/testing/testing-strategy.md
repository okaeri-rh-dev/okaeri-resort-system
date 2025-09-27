# Phase 1 Testing Plan - Okaeri Resort System

## 🎯 Testing Overview

This document provides comprehensive test scenarios to verify all Phase 1 CRUD
operations are working correctly.

## 🔧 **Pre-Testing Setup**

### Environment Requirements

- [ ] Supabase project configured with actual credentials
- [ ] Database schema applied (`database/schema.sql`)
- [ ] Initial seed data loaded (3 sample units)
- [ ] Admin user created in Supabase Auth
- [ ] Application running locally (`npm run dev`)

### Test Data Preparation

```sql
-- Verify initial units exist
SELECT * FROM units;

-- Should return 3 units:
-- U1: Unit 1 - Ocean View (Studio, 2 guests, ₱2,500/₱3,000)
-- U2: Unit 2 - Garden View (One Bedroom, 4 guests, ₱3,500/₱4,000)
-- U3: Unit 3 - Poolside (Two Bedroom, 6 guests, ₱5,000/₱6,000)
```

## 🏠 **UNITS CRUD TESTING**

### Test 1: Create Unit (CREATE)

**Objective**: Verify new units can be created with proper validation

**Steps**:

1. Navigate to `/units`
2. Click "Add Unit" or equivalent button
3. Fill out form with test data:
   ```
   Unit Name: Unit 4 - Mountain View
   Unit Code: U4
   Unit Type: Villa
   Max Occupancy: 8
   Base Rate: 7500
   Weekend Rate: 9000
   Amenities: ["WiFi", "Kitchen", "Balcony", "Mountain View"]
   ```
4. Submit form

**Expected Results**:

- [ ] Form validates all required fields
- [ ] Unit created successfully with generated UUID
- [ ] Unit appears in units table
- [ ] Status defaults to "Available"
- [ ] Success notification displayed
- [ ] Form resets after submission

**Validation Tests**:

- [ ] Required fields show errors when empty
- [ ] Unit code must be unique
- [ ] Unit name must be unique
- [ ] Max occupancy must be positive number
- [ ] Rates must be non-negative numbers

### Test 2: Read Units (READ)

**Objective**: Verify units can be viewed and filtered

**Steps**:

1. Navigate to `/units`
2. Verify units table displays all units
3. Test sorting by different columns
4. Test filtering by unit status
5. Test filtering by unit type
6. Click on individual unit to view details

**Expected Results**:

- [ ] All units display with correct information
- [ ] Table sorting works for all columns
- [ ] Status filter works (Available, Occupied, Maintenance, Reserved)
- [ ] Type filter works (Studio, One Bedroom, Two Bedroom, Villa)
- [ ] Unit details show complete information
- [ ] Loading states display during data fetch

### Test 3: Update Unit (UPDATE)

**Objective**: Verify units can be modified

**Steps**:

1. Select a unit to edit
2. Modify the following fields:
   ```
   Unit Status: Maintenance
   Base Rate: 8000
   Weekend Rate: 10000
   Amenities: Add "Pool Access"
   ```
3. Save changes

**Expected Results**:

- [ ] Changes save successfully
- [ ] Updated data displays immediately (optimistic updates)
- [ ] Database reflects changes
- [ ] `updated_at` timestamp updates
- [ ] Status change reflects in units list

### Test 4: Delete Unit (DELETE)

**Objective**: Verify units can be deleted with proper constraints

**Steps**:

1. Create a new test unit (Unit 5)
2. Attempt to delete it
3. Confirm deletion

**Expected Results**:

- [ ] Deletion confirmation prompt appears
- [ ] Unit removed from database
- [ ] Unit no longer appears in list
- [ ] Cannot delete unit with existing bookings (constraint)

## 📅 **BOOKINGS CRUD TESTING**

### Test 5: Create Booking (CREATE)

**Objective**: Verify bookings can be created with guest auto-creation

**Steps**:

1. Navigate to `/bookings`
2. Click "New Booking"
3. Fill out booking form:
   ```
   Unit: Unit 1 - Ocean View
   Guest Name: Juan Dela Cruz
   Email: juan@example.com
   Contact Number: 09171234567
   Number of Guests: 2
   Check-in Date: Tomorrow
   Check-out Date: 3 days from tomorrow
   Special Requests: "Late check-in requested"
   ```
4. Submit form

**Expected Results**:

- [ ] Form validates all fields
- [ ] Unit availability checked before booking
- [ ] Guest auto-created if email doesn't exist
- [ ] Booking reference generated (BK-YYYYMMDD-XXXX format)
- [ ] Total amount calculated automatically
- [ ] Booking status defaults to "Pending"
- [ ] Payment status defaults to "Unpaid"
- [ ] Success notification shown

**Validation Tests**:

- [ ] Email format validation
- [ ] Phone number format validation (09XXXXXXXXX)
- [ ] Check-out date must be after check-in
- [ ] Number of guests within unit capacity
- [ ] Cannot double-book same unit for overlapping dates

### Test 6: Read Bookings (READ)

**Objective**: Verify bookings can be viewed and filtered

**Steps**:

1. Navigate to `/bookings`
2. Verify bookings table shows all bookings
3. Test filtering by:
   - Booking status
   - Payment status
   - Date ranges
   - Guest name search
4. Test sorting by different columns

**Expected Results**:

- [ ] All bookings display with complete information
- [ ] Unit name shows in booking (joined data)
- [ ] Guest information displays correctly
- [ ] Status filters work properly
- [ ] Date range filtering functions
- [ ] Search finds bookings by guest name, email, or reference
- [ ] Pagination works if many bookings

### Test 7: Update Booking Status (UPDATE)

**Objective**: Verify booking status workflow

**Steps**:

1. Select a "Pending" booking
2. Update status to "Confirmed"
3. Update same booking to "CheckedIn"
4. Try invalid status transitions

**Expected Results**:

- [ ] Valid transitions work: Pending → Confirmed → CheckedIn → CheckedOut
- [ ] Invalid transitions blocked (e.g., Pending → CheckedOut)
- [ ] Status updates immediately in UI
- [ ] Database reflects changes
- [ ] Cannot modify cancelled bookings

### Test 8: Payment Proof Upload

**Objective**: Verify file upload functionality

**Steps**:

1. Select a booking
2. Click "Upload Payment Proof"
3. Upload a test image file (PNG/JPG, < 5MB)
4. Verify upload success

**Expected Results**:

- [ ] File validation works (type, size)
- [ ] Upload progress indicator shown
- [ ] File uploaded to Supabase storage
- [ ] Payment status updates to "Paid"
- [ ] Payment proof URL stored in booking
- [ ] Can view uploaded file

**File Validation Tests**:

- [ ] Rejects files > 5MB
- [ ] Rejects unsupported file types
- [ ] Shows appropriate error messages

### Test 9: Cancel Booking

**Objective**: Verify booking cancellation

**Steps**:

1. Select a booking to cancel
2. Click "Cancel Booking"
3. Confirm cancellation

**Expected Results**:

- [ ] Confirmation dialog appears
- [ ] Booking status changes to "Cancelled"
- [ ] Unit becomes available for those dates
- [ ] Cannot un-cancel a booking

## 👥 **GUESTS CRUD TESTING**

### Test 10: Auto-Create Guest (CREATE)

**Objective**: Verify guests auto-created from bookings

**Steps**:

1. Create booking with new email address
2. Check guests table

**Expected Results**:

- [ ] New guest created automatically
- [ ] Guest information populated from booking
- [ ] Total bookings = 0 initially
- [ ] Total spent = 0 initially

### Test 11: Read Guests (READ)

**Objective**: Verify guest viewing and search

**Steps**:

1. Navigate to `/guests`
2. View all guests
3. Search by name, email, phone
4. Sort by different columns
5. View individual guest details

**Expected Results**:

- [ ] All guests display with correct information
- [ ] Search finds guests by any field
- [ ] Sorting works for all columns
- [ ] Guest details show booking history
- [ ] Total bookings and spent calculated correctly

### Test 12: Update Guest (UPDATE)

**Objective**: Verify guest information can be modified

**Steps**:

1. Select a guest to edit
2. Update contact information
3. Save changes

**Expected Results**:

- [ ] Changes save successfully
- [ ] Updated information displays
- [ ] Related bookings unaffected

### Test 13: Guest Statistics

**Objective**: Verify guest totals are calculated

**Steps**:

1. Complete a booking (mark as paid)
2. Check guest totals update

**Expected Results**:

- [ ] Total bookings increments
- [ ] Total spent updates with booking amount
- [ ] Statistics accurate across all guests

## 📊 **DASHBOARD TESTING**

### Test 14: Dashboard Metrics

**Objective**: Verify basic dashboard functionality

**Steps**:

1. Navigate to `/` (dashboard)
2. Verify all metric cards display
3. Test that numbers update when data changes

**Expected Results**:

- [ ] Available Units shows correct count
- [ ] Active Bookings shows checked-in count
- [ ] Total Bookings shows all-time count
- [ ] Total Guests shows registered count
- [ ] Metrics update when underlying data changes

## 🔒 **SECURITY & ERROR TESTING**

### Test 15: Error Boundaries

**Objective**: Verify error handling doesn't crash app

**Steps**:

1. Intentionally cause errors (invalid data, network issues)
2. Verify error boundaries catch errors
3. Test retry functionality

**Expected Results**:

- [ ] Component errors show localized error message
- [ ] Page errors show page-level fallback
- [ ] App errors show full-page fallback
- [ ] Retry buttons work properly
- [ ] No uncaught exceptions in console

### Test 16: Data Validation

**Objective**: Verify all forms validate properly

**Steps**:

1. Submit forms with invalid data
2. Test edge cases
3. Verify error messages

**Expected Results**:

- [ ] Required fields show validation errors
- [ ] Email format validated
- [ ] Phone number format validated
- [ ] Date logic validated
- [ ] Numeric fields validated
- [ ] File upload restrictions enforced

## ✅ **ACCEPTANCE CRITERIA**

Phase 1 testing is complete when:

- [ ] All CRUD operations work for Units, Bookings, and Guests
- [ ] Form validation prevents invalid data entry
- [ ] File upload works for payment proofs
- [ ] Dashboard shows accurate basic metrics
- [ ] Error boundaries prevent crashes
- [ ] Status workflows function correctly
- [ ] Search and filtering work properly
- [ ] Auto-calculations are accurate
- [ ] No console errors in normal operation
- [ ] Performance is acceptable (< 3 second page loads)

## 🐛 **Bug Reporting Template**

When issues are found, report using this format:

```
**Bug Title**: [Brief description]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**: [What should happen]

**Actual Result**: [What actually happened]

**Browser/Environment**: [Chrome/Firefox/Safari, OS]

**Console Errors**: [Any JavaScript errors]

**Database Errors**: [Any Supabase errors]

**Screenshots**: [If applicable]
```

## 🚀 **Ready for Production**

Once all tests pass, your Phase 1 implementation is ready for production
deployment!

---

_Testing Plan for Phase 1 Foundation - September 2025_
