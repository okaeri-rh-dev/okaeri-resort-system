# Public Booking Tests

**Role**: Anonymous (Not Logged In)
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Browser in incognito/private mode (no cached sessions)
- [ ] At least one unit available for booking in the system
- [ ] Browser DevTools console open for error checking

---

### TC-ANON-001: View Public Booking Page

**Goal**: Verify anonymous users can access the public booking form

**Preconditions**:

- Not logged in (use incognito browser)

**Steps**:

1. Navigate to `/booking`
2. Verify the page loads without console errors
3. Check that the booking form is visible
4. Verify the following form fields are present:
   - Guest name input
   - Email input
   - Phone input
   - Check-in date picker
   - Check-out date picker
   - Unit/cabin selector
   - Guest count selector
   - Special requests textarea
5. Verify "Submit Booking" button is visible
6. Check that no admin navigation is visible
7. Verify Turnstile captcha widget appears (if enabled)

**Expected Results**:

- [ ] Page loads without console errors
- [ ] All booking form fields are visible and accessible
- [ ] Form is in empty/default state
- [ ] No admin-only elements visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-002: Submit Valid Booking Request

**Goal**: Verify anonymous users can successfully submit a booking request

**Preconditions**:

- At least one unit available for the selected dates
- On the `/booking` page

**Steps**:

1. Navigate to `/booking`
2. Fill in guest name: "Test Guest QA"
3. Fill in email: "testguest@example.com"
4. Fill in phone: "09171234567"
5. Select check-in date (tomorrow or later available date)
6. Select check-out date (at least 1 day after check-in)
7. Select an available unit from the dropdown
8. Select guest count: 2
9. Enter special request: "QA test booking - please ignore"
10. Complete Turnstile verification (if present)
11. Click "Submit Booking" button
12. Verify loading state appears on button
13. Wait for submission to complete
14. Verify redirect to confirmation page (`/booking/confirmation/{ref}`)
15. Note the booking reference number displayed
16. Check console for any errors

**Expected Results**:

- [ ] Form accepts all valid inputs
- [ ] Loading state shows during submission
- [ ] Redirects to confirmation page on success
- [ ] Booking reference is displayed (format: OKA-XXXXXX)
- [ ] Confirmation shows booking details correctly
- [ ] No console errors

**Result**: [ ] Pass [ ] Fail

**Booking Reference**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ANON-003: Form Validation - Required Fields

**Goal**: Verify form validation prevents submission of incomplete bookings

**Preconditions**:

- On the `/booking` page

**Steps**:

1. Navigate to `/booking`
2. Click "Submit Booking" without filling any fields
3. Verify validation errors appear for all required fields
4. Check that errors are displayed near the relevant fields
5. Fill in only the guest name
6. Click "Submit Booking"
7. Verify remaining required field errors still show
8. Fill in all fields except email
9. Click "Submit Booking"
10. Verify email validation error appears
11. Enter invalid email format: "notanemail"
12. Click "Submit Booking"
13. Verify email format validation error

**Expected Results**:

- [ ] Required field validation prevents empty submission
- [ ] Each required field shows appropriate error message
- [ ] Email format validation works correctly
- [ ] Form does not submit with validation errors
- [ ] Error messages are clear and helpful

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-004: Form Validation - Date Logic

**Goal**: Verify date validation prevents invalid date selections

**Preconditions**:

- On the `/booking` page

**Steps**:

1. Navigate to `/booking`
2. Try to select a check-in date in the past
3. Verify past dates are disabled or show error
4. Select today as check-in date
5. Try to select check-out date before check-in
6. Verify check-out must be after check-in
7. Select check-in date far in the future (e.g., 2 years)
8. Verify if there's a maximum advance booking limit
9. Select a valid date range
10. Verify the number of nights is calculated/displayed
11. Check that pricing updates based on date selection (if shown)

**Expected Results**:

- [ ] Past dates cannot be selected for check-in
- [ ] Check-out must be after check-in date
- [ ] Date range validation works correctly
- [ ] Night count calculation is accurate
- [ ] Clear feedback on invalid date selections

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-005: Unit Availability Check

**Goal**: Verify unit availability is correctly shown during booking

**Preconditions**:

- At least one unit exists in the system
- Some units may have existing bookings

**Steps**:

1. Navigate to `/booking`
2. Select a date range with no existing bookings
3. Verify all units show as available
4. Note which units are available
5. Open a new incognito window
6. Navigate to `/admin` and log in as staff
7. Check if any bookings exist for the date range
8. Return to the public booking form
9. Select a date range that has existing bookings (if any)
10. Verify booked units do not appear or show as unavailable
11. Try to select an unavailable unit
12. Verify appropriate messaging about unavailability

**Expected Results**:

- [ ] Available units are correctly shown
- [ ] Unavailable/booked units are excluded or marked
- [ ] Availability updates based on selected dates
- [ ] Clear indication of why units might be unavailable

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-006: Mobile Responsive Booking Form

**Goal**: Verify booking form works correctly on mobile viewport

**Preconditions**:

- On the `/booking` page
- DevTools open for viewport control

**Steps**:

1. Navigate to `/booking`
2. Open DevTools and set viewport to 375x667 (iPhone SE)
3. Verify form layout adapts to mobile
4. Check all form fields are accessible (no horizontal scroll needed)
5. Tap on date picker - verify it's usable on mobile
6. Tap on unit dropdown - verify options are visible
7. Fill in all required fields
8. Verify keyboard doesn't obscure submit button
9. Submit the form
10. Verify confirmation page displays correctly on mobile
11. Test at 768x1024 (tablet) viewport as well

**Expected Results**:

- [ ] Form is fully usable on mobile viewport
- [ ] No horizontal scrolling required
- [ ] Date pickers are mobile-friendly
- [ ] Dropdowns work correctly on touch
- [ ] Confirmation page is mobile-responsive

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-007: Booking Form Error Handling

**Goal**: Verify proper error handling for network/server errors

**Preconditions**:

- On the `/booking` page
- DevTools Network tab open

**Steps**:

1. Navigate to `/booking`
2. Fill in all required fields with valid data
3. Open DevTools Network tab
4. Enable "Offline" mode in Network conditions
5. Click "Submit Booking"
6. Verify appropriate network error message appears
7. Disable offline mode
8. Verify form can be resubmitted
9. (If possible) Test with intentionally slow network (3G throttling)
10. Verify loading states handle slow responses
11. Test form recovery after timeout

**Expected Results**:

- [ ] Network errors show user-friendly message
- [ ] Form remains submittable after error recovery
- [ ] Loading states work correctly under slow network
- [ ] User is not left in a broken state after errors

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-008: XSS Prevention in Form Inputs

**Goal**: Verify form inputs are protected against XSS attacks

**Preconditions**:

- On the `/booking` page

**Steps**:

1. Navigate to `/booking`
2. In the guest name field, enter: `<script>alert('XSS')</script>`
3. In the email field, enter: `test@example.com`
4. In the special requests, enter: `<img src=x onerror=alert('XSS')>`
5. Fill remaining required fields normally
6. Submit the booking
7. Navigate to the confirmation page
8. Verify no script execution occurs
9. Verify the input is either sanitized or escaped in display
10. If booking was created, check admin view for stored XSS
11. Verify no console errors related to script injection

**Expected Results**:

- [ ] Script tags do not execute
- [ ] Input is properly sanitized or escaped
- [ ] No XSS vulnerabilities in form or confirmation
- [ ] Data is safely stored and displayed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-009: Duplicate Booking Prevention

**Goal**: Verify system prevents double-booking the same unit

**Preconditions**:

- Successfully created a booking in TC-ANON-002

**Steps**:

1. Navigate to `/booking`
2. Use the same dates as the booking created in TC-ANON-002
3. Try to select the same unit
4. Verify the unit shows as unavailable or booking fails with clear message
5. If unit appears available, complete the form and submit
6. Verify system rejects the duplicate booking
7. Check error message clearly explains the conflict
8. Verify user can select different dates or unit

**Expected Results**:

- [ ] Double-booking is prevented
- [ ] Clear error message explains the conflict
- [ ] User can recover and book alternative dates/units
- [ ] No orphaned or duplicate records created

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ANON-010: Anonymous Cannot Access Admin Routes

**Goal**: Verify anonymous users cannot access protected admin routes

**Preconditions**:

- Not logged in (incognito browser)

**Steps**:

1. Try to navigate directly to `/admin`
2. Verify redirect to login page or access denied
3. Try to navigate to `/admin/bookings`
4. Verify redirect to login page
5. Try to navigate to `/admin/payments`
6. Verify redirect to login page
7. Try to navigate to `/admin/units`
8. Verify redirect to login page
9. Try to navigate to `/admin/audit-logs`
10. Verify redirect to login page
11. Try to navigate to `/admin/roles`
12. Verify redirect to login page
13. Check that no admin data is leaked in network responses

**Expected Results**:

- [ ] All admin routes redirect to login
- [ ] No admin UI is accessible
- [ ] No sensitive data exposed in redirects
- [ ] Login page clearly indicates authentication required

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

## Summary

| Test Case   | Description                          | Result |
| ----------- | ------------------------------------ | ------ |
| TC-ANON-001 | View Public Booking Page             |        |
| TC-ANON-002 | Submit Valid Booking Request         |        |
| TC-ANON-003 | Form Validation - Required Fields    |        |
| TC-ANON-004 | Form Validation - Date Logic         |        |
| TC-ANON-005 | Unit Availability Check              |        |
| TC-ANON-006 | Mobile Responsive Booking Form       |        |
| TC-ANON-007 | Booking Form Error Handling          |        |
| TC-ANON-008 | XSS Prevention in Form Inputs        |        |
| TC-ANON-009 | Duplicate Booking Prevention         |        |
| TC-ANON-010 | Anonymous Cannot Access Admin Routes |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
