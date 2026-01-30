# Payment Verification Tests (Admin - Full Access)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] At least 3 payment records (some pending verification)
- [ ] Sample receipt images for upload testing
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-PAY-001: Create New Payment Record

**Goal**: Verify admin can create a new payment record

**Preconditions**:

- A booking exists with outstanding balance

**Steps**:

1. Navigate to `/admin/payments`
2. Click "Add Payment" or "Record Payment"
3. Verify payment form opens
4. Select/link to an existing booking
5. Fill payment details:
   - Amount: 2500
   - Payment method: GCash
   - Transaction reference: "GCASH-QA-001"
   - Payment date: today
6. Upload a receipt image
7. Add notes: "QA Admin payment test"
8. Click "Save" or "Record Payment"
9. Verify success message
10. Verify payment appears in list
11. Check booking balance updated

**Expected Results**:

- [ ] Payment form accessible
- [ ] Can link to booking
- [ ] Receipt upload works
- [ ] Payment saved successfully
- [ ] Booking balance updated

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-002: Verify Pending Payment

**Goal**: Verify admin can verify a pending payment

**Preconditions**:

- A payment exists with "Pending" verification status

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with "Pending" status
3. Click to view payment details
4. Review payment information:
   - Amount
   - Method
   - Transaction reference
   - Receipt image
5. Click "Verify" button
6. Add verification notes (if available)
7. Confirm verification
8. Verify success message
9. Verify status changes to "Verified"
10. Check that verifier name/date recorded
11. Verify booking status updates (if fully paid)

**Expected Results**:

- [ ] Can access verify function
- [ ] Can review payment details
- [ ] Verification succeeds
- [ ] Status updates correctly
- [ ] Verifier recorded

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-003: Reject Invalid Payment

**Goal**: Verify admin can reject an invalid payment

**Preconditions**:

- A payment exists with "Pending" status

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with "Pending" status
3. Click to view payment details
4. Click "Reject" button
5. Verify rejection reason is required
6. Enter reason: "QA test rejection - receipt unclear"
7. Confirm rejection
8. Verify success message
9. Verify status changes to "Rejected"
10. Verify rejection reason is recorded
11. Check that booking balance is NOT affected
12. Verify guest can be notified (if notification exists)

**Expected Results**:

- [ ] Can access reject function
- [ ] Reason is required
- [ ] Rejection succeeds
- [ ] Reason is recorded
- [ ] Booking balance unchanged

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-004: Edit Payment Details

**Goal**: Verify admin can edit payment information

**Preconditions**:

- A payment record exists

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment to edit
3. Click "Edit" button
4. Modify payment details:
   - Change amount (if allowed)
   - Update transaction reference
   - Change notes
5. Upload new receipt image
6. Save changes
7. Verify success message
8. View payment details
9. Verify all changes saved
10. Check if edit is restricted for verified payments
11. Document which fields are editable

**Expected Results**:

- [ ] Can edit payment details
- [ ] Changes are saved
- [ ] Receipt can be updated
- [ ] Verified payments have edit restrictions (appropriate)

**Result**: [ ] Pass [ ] Fail

**Editable Fields**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-005: Delete Payment Record

**Goal**: Verify admin can delete a payment record

**Preconditions**:

- A test payment exists (preferably unverified)

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment to delete
3. Click "Delete" button
4. Verify confirmation dialog appears
5. Verify warning about data loss
6. Click "Cancel" first
7. Verify dialog closes, payment remains
8. Click "Delete" again and confirm
9. Verify success message
10. Verify payment removed from list
11. Check that booking balance is adjusted
12. Check if verified payments can be deleted

**Expected Results**:

- [ ] Delete requires confirmation
- [ ] Payment is removed
- [ ] Booking balance adjusted
- [ ] Verified payment deletion handled appropriately

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-006: Payment Method Filtering

**Goal**: Verify admin can filter payments by method

**Preconditions**:

- Payments exist with different methods

**Steps**:

1. Navigate to `/admin/payments`
2. Locate payment method filter
3. Filter by "Cash"
4. Verify only cash payments shown
5. Filter by "GCash"
6. Verify only GCash payments shown
7. Filter by "Bank Transfer"
8. Verify only bank transfers shown
9. Clear filter
10. Verify all payments shown
11. Combine with status filter
12. Verify combined filters work

**Expected Results**:

- [ ] Method filter works
- [ ] Each method filtered correctly
- [ ] Filters can be combined
- [ ] Filters can be cleared

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-007: Receipt Image Management

**Goal**: Verify admin can manage receipt images

**Preconditions**:

- A payment with receipt image exists

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with receipt image
3. View payment details
4. Click on receipt thumbnail
5. Verify full-size image opens
6. Test zoom functionality (if available)
7. Test download receipt (if available)
8. Edit the payment
9. Upload a new receipt image
10. Verify old image is replaced
11. Try uploading invalid file type
12. Verify validation error

**Expected Results**:

- [ ] Can view full-size receipts
- [ ] Can download receipts (if implemented)
- [ ] Can replace receipt image
- [ ] Invalid file types rejected

**Result**: [ ] Pass [ ] Fail

**Allowed File Types**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-008: Payment Summary and Reports

**Goal**: Verify admin can view payment summaries

**Preconditions**:

- Multiple payments exist

**Steps**:

1. Navigate to `/admin/payments`
2. Look for summary/totals section
3. Verify totals displayed:
   - Total payments today
   - Total pending verification
   - Total verified
   - Total amount collected
4. Apply date filter (this week)
5. Verify summary updates
6. Apply method filter
7. Verify summary reflects filtered data
8. Look for export to CSV/Excel
9. Export if available and verify data
10. Check for payment reports section

**Expected Results**:

- [ ] Payment summaries visible
- [ ] Summaries are accurate
- [ ] Summaries update with filters
- [ ] Export works (if implemented)

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-009: Duplicate Payment Detection

**Goal**: Verify system prevents duplicate payment entries

**Preconditions**:

- A verified payment exists

**Steps**:

1. Note details of an existing payment
2. Try to create a new payment with:
   - Same booking
   - Same amount
   - Same transaction reference
3. Verify system warns or prevents duplicate
4. Check for duplicate detection message
5. If allowed, verify it's flagged for review
6. Try creating payment with different reference
7. Verify this is allowed
8. Document duplicate prevention behavior

**Expected Results**:

- [ ] Duplicate detection exists
- [ ] Warning or prevention for duplicates
- [ ] Clear messaging about duplicates
- [ ] Different references allowed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PAY-010: Refund Processing

**Goal**: Verify admin can process refunds (if implemented)

**Preconditions**:

- A verified payment exists on a booking

**Steps**:

1. Navigate to `/admin/payments`
2. Find a verified payment
3. Look for "Refund" option
4. If refund exists:
   - Click "Refund"
   - Enter refund amount (partial or full)
   - Enter refund reason
   - Select refund method
   - Confirm refund
   - Verify refund recorded
   - Check booking balance adjusted
5. If refund not implemented:
   - Document as N/A
6. Verify refund appears in payment history
7. Check for refund reporting

**Expected Results**:

- [ ] Refund option available (or documented N/A)
- [ ] Can process partial/full refunds
- [ ] Refund recorded properly
- [ ] Booking balance adjusted

**Result**: [ ] Pass [ ] Fail [ ] N/A (refund not implemented)

**Notes/Issues Found**:

---

---

## Summary

| Test Case        | Description                 | Result |
| ---------------- | --------------------------- | ------ |
| TC-ADMIN-PAY-001 | Create New Payment Record   |        |
| TC-ADMIN-PAY-002 | Verify Pending Payment      |        |
| TC-ADMIN-PAY-003 | Reject Invalid Payment      |        |
| TC-ADMIN-PAY-004 | Edit Payment Details        |        |
| TC-ADMIN-PAY-005 | Delete Payment Record       |        |
| TC-ADMIN-PAY-006 | Payment Method Filtering    |        |
| TC-ADMIN-PAY-007 | Receipt Image Management    |        |
| TC-ADMIN-PAY-008 | Payment Summary and Reports |        |
| TC-ADMIN-PAY-009 | Duplicate Payment Detection |        |
| TC-ADMIN-PAY-010 | Refund Processing           |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
