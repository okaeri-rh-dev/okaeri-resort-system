# Check Booking Status Tests

**Role**: Anonymous (Not Logged In)
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Browser in incognito/private mode
- [ ] At least one booking exists with a known reference number
- [ ] Browser DevTools console open for error checking

---

### TC-STATUS-001: Access Status Check Page

**Goal**: Verify anonymous users can access the booking status check page

**Preconditions**:

- Not logged in

**Steps**:

1. Navigate to `/booking/check-status`
2. Verify the page loads without console errors
3. Check that the status lookup form is visible
4. Verify the form has the following fields:
   - Booking reference input
   - Email address input (for verification)
5. Verify "Check Status" or similar button is visible
6. Check that the form is clearly labeled for guests
7. Verify no admin navigation is visible

**Expected Results**:

- [ ] Page loads without console errors
- [ ] Status lookup form is visible and accessible
- [ ] Required fields are clearly marked
- [ ] No admin elements visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-002: Lookup Valid Booking

**Goal**: Verify guests can look up their booking with valid reference

**Preconditions**:

- Have a valid booking reference from a previous booking
- Know the email used for that booking

**Steps**:

1. Navigate to `/booking/check-status`
2. Enter a valid booking reference (e.g., OKA-XXXXXX)
3. Enter the matching email address
4. Click "Check Status" button
5. Verify loading indicator appears
6. Wait for results to load
7. Verify booking details are displayed:
   - Booking reference
   - Guest name
   - Check-in/check-out dates
   - Unit name
   - Booking status (Pending/Confirmed/etc.)
   - Total amount
   - Payment status
8. Check console for any errors

**Expected Results**:

- [ ] Booking is found successfully
- [ ] All relevant details are displayed
- [ ] Status is accurately reflected
- [ ] No console errors

**Result**: [ ] Pass [ ] Fail

**Booking Reference Used**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-STATUS-003: Invalid Booking Reference

**Goal**: Verify appropriate error for non-existent booking reference

**Preconditions**:

- On the `/booking/check-status` page

**Steps**:

1. Navigate to `/booking/check-status`
2. Enter an invalid reference: "INVALID-123"
3. Enter any email: "test@example.com"
4. Click "Check Status"
5. Verify error message appears
6. Check that error is user-friendly (not technical)
7. Try another invalid format: "12345"
8. Verify appropriate error
9. Try empty reference
10. Verify validation prevents submission
11. Confirm no sensitive information is leaked in error messages

**Expected Results**:

- [ ] Invalid reference shows clear error message
- [ ] Error message is user-friendly
- [ ] No technical details or stack traces exposed
- [ ] Form validation prevents empty submission

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-004: Email Verification Mismatch

**Goal**: Verify status lookup requires correct email for security

**Preconditions**:

- Have a valid booking reference
- Know the correct email for that booking

**Steps**:

1. Navigate to `/booking/check-status`
2. Enter a valid booking reference
3. Enter a DIFFERENT email than the one used for booking
4. Click "Check Status"
5. Verify the system does not reveal the booking
6. Check error message does not confirm booking exists
7. Verify message is generic: "Booking not found" or similar
8. Try with correct email to confirm booking exists
9. Verify booking is found with correct email

**Expected Results**:

- [ ] Mismatched email prevents booking lookup
- [ ] Error message does not leak booking existence
- [ ] Security is maintained without revealing details
- [ ] Correct email successfully retrieves booking

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-005: Case Insensitivity

**Goal**: Verify reference and email lookups are case-insensitive

**Preconditions**:

- Have a valid booking reference and email

**Steps**:

1. Navigate to `/booking/check-status`
2. Enter booking reference in lowercase (e.g., "oka-abc123")
3. Enter email in uppercase (e.g., "TEST@EXAMPLE.COM")
4. Click "Check Status"
5. Verify booking is found
6. Try with mixed case reference and email
7. Verify booking is still found
8. Document if case sensitivity is enforced

**Expected Results**:

- [ ] Reference lookup is case-insensitive
- [ ] Email lookup is case-insensitive
- [ ] User experience is not hindered by case

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-006: Status Display for Different Booking States

**Goal**: Verify status page correctly displays different booking states

**Preconditions**:

- Have access to bookings in different states (or can create them via admin)

**Steps**:

1. Look up a booking with status: **Pending**
2. Verify "Pending" status is clearly displayed
3. Verify appropriate messaging (e.g., "Awaiting confirmation")
4. Look up a booking with status: **Confirmed**
5. Verify "Confirmed" status with positive indicator
6. Look up a booking with status: **Cancelled** (if available)
7. Verify "Cancelled" status is clearly shown
8. Check if completed/checked-out bookings can be looked up
9. Verify payment status is shown appropriately
10. Check for visual indicators (colors, icons) for different states

**Expected Results**:

- [ ] Pending status displayed correctly
- [ ] Confirmed status displayed correctly
- [ ] Cancelled status displayed correctly (if applicable)
- [ ] Visual indicators help distinguish states
- [ ] Payment status accurately reflected

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-007: Status Page Mobile Responsiveness

**Goal**: Verify status check works on mobile devices

**Preconditions**:

- Have a valid booking reference

**Steps**:

1. Navigate to `/booking/check-status`
2. Open DevTools and set viewport to 375x667 (mobile)
3. Verify form layout is mobile-friendly
4. Enter booking reference using mobile keyboard
5. Enter email
6. Submit the form
7. Verify results display correctly on mobile
8. Check all text is readable without horizontal scrolling
9. Test at 768x1024 (tablet) viewport
10. Verify touch interactions work correctly

**Expected Results**:

- [ ] Form usable on mobile viewport
- [ ] Results display correctly on small screens
- [ ] No horizontal scrolling required
- [ ] Touch interactions work properly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-008: Rate Limiting Check

**Goal**: Verify status lookups have rate limiting to prevent abuse

**Preconditions**:

- On the `/booking/check-status` page

**Steps**:

1. Navigate to `/booking/check-status`
2. Rapidly submit 10 invalid lookup attempts
3. Check if rate limiting kicks in
4. Look for rate limit error message
5. Wait the required time (if rate limited)
6. Verify normal operation resumes after wait
7. Document the rate limit threshold and cooldown period

**Expected Results**:

- [ ] Rate limiting exists to prevent abuse
- [ ] Clear message when rate limited
- [ ] Normal operation resumes after cooldown
- [ ] Legitimate users unlikely to hit the limit

**Result**: [ ] Pass [ ] Fail

**Rate Limit Details**: **_ attempts before limit, _** seconds cooldown

**Notes/Issues Found**:

---

---

### TC-STATUS-009: Status Lookup Security

**Goal**: Verify no sensitive data leakage in status lookup

**Preconditions**:

- Have a valid booking reference
- DevTools Network tab open

**Steps**:

1. Navigate to `/booking/check-status`
2. Open DevTools Network tab
3. Enter valid booking reference and email
4. Click "Check Status"
5. Inspect the API response in Network tab
6. Verify response only contains necessary booking info:
   - Reference number
   - Dates
   - Status
   - Unit name
   - Payment status
7. Verify NO sensitive data in response:
   - No other guest information
   - No internal IDs that could be exploited
   - No admin notes
   - No financial details beyond total
8. Try to manipulate the request (e.g., add extra parameters)
9. Verify server ignores unauthorized parameters

**Expected Results**:

- [ ] API response contains only necessary data
- [ ] No sensitive information exposed
- [ ] Request manipulation is ignored
- [ ] Response is properly scoped

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STATUS-010: Direct URL Access to Confirmation Page

**Goal**: Verify confirmation pages are properly secured

**Preconditions**:

- Know a valid booking reference

**Steps**:

1. Try navigating directly to `/booking/confirmation/OKA-XXXXXX`
2. Check if booking details are shown without email verification
3. If details shown, document the security concern
4. Try navigating to a non-existent reference
5. Verify appropriate 404 or "not found" handling
6. Check for any information leakage in URL handling
7. Verify no breadcrumb trails or back-navigation exploits

**Expected Results**:

- [ ] Confirmation page requires some form of verification
- [ ] OR confirmation only shows limited/safe information
- [ ] Non-existent references handled gracefully
- [ ] No information leakage through URL manipulation

**Result**: [ ] Pass [ ] Fail

**Security Assessment**: ******\_\_\_******

**Notes/Issues Found**:

---

---

## Summary

| Test Case     | Description                         | Result |
| ------------- | ----------------------------------- | ------ |
| TC-STATUS-001 | Access Status Check Page            |        |
| TC-STATUS-002 | Lookup Valid Booking                |        |
| TC-STATUS-003 | Invalid Booking Reference           |        |
| TC-STATUS-004 | Email Verification Mismatch         |        |
| TC-STATUS-005 | Case Insensitivity                  |        |
| TC-STATUS-006 | Status Display for Different States |        |
| TC-STATUS-007 | Status Page Mobile Responsiveness   |        |
| TC-STATUS-008 | Rate Limiting Check                 |        |
| TC-STATUS-009 | Status Lookup Security              |        |
| TC-STATUS-010 | Direct URL Access to Confirmation   |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
