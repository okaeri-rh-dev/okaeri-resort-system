# Edit Operations Denied Tests (Staff)

**Role**: Staff
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Staff user (`jasonacido+staff@gmail.com`)
- [ ] At least one booking, payment, and unit exists
- [ ] Browser DevTools console and Network tabs open

---

### TC-STAFF-DENY-001: Cannot Create New Booking

**Goal**: Verify staff cannot create new bookings via UI

**Preconditions**:

- Logged in as Staff
- On the bookings page

**Steps**:

1. Navigate to `/admin/bookings`
2. Look for "New Booking" or "Add Booking" button
3. Verify button is either:
   - Not visible at all
   - Visible but disabled
4. If button appears clickable, click it
5. Verify either:
   - Nothing happens
   - Access denied message
   - Redirect occurs
6. Check console for any errors
7. Document the behavior observed

**Expected Results**:

- [ ] No working "Create" button for staff
- [ ] Cannot access booking creation
- [ ] No console errors related to permissions

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-002: Cannot Edit Existing Booking

**Goal**: Verify staff cannot edit bookings via UI

**Preconditions**:

- Logged in as Staff
- A booking exists

**Steps**:

1. Navigate to `/admin/bookings`
2. Click on a booking to view details
3. Look for "Edit" button or edit icons
4. Verify edit controls are either:
   - Not visible
   - Visible but disabled
5. If edit appears available, attempt to click
6. Verify access is denied
7. Try double-clicking on editable fields
8. Verify inline editing is not possible
9. Check network tab for any unauthorized requests

**Expected Results**:

- [ ] No working "Edit" controls for staff
- [ ] Cannot modify booking data
- [ ] No unauthorized API calls

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-003: Cannot Delete Booking

**Goal**: Verify staff cannot delete bookings

**Preconditions**:

- Logged in as Staff
- A booking exists

**Steps**:

1. Navigate to `/admin/bookings`
2. View a booking's details
3. Look for "Delete" or "Remove" button
4. Verify delete is either:
   - Not visible
   - Visible but disabled
5. If delete appears available, attempt to click
6. Verify action is blocked
7. Check for confirmation dialogs that shouldn't appear
8. Verify no deletion occurs

**Expected Results**:

- [ ] No working "Delete" option for staff
- [ ] Cannot delete any bookings
- [ ] Data remains intact

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-004: Cannot Change Booking Status

**Goal**: Verify staff cannot change booking status

**Preconditions**:

- Logged in as Staff
- A pending booking exists

**Steps**:

1. Navigate to `/admin/bookings`
2. Find a booking with "Pending" status
3. View booking details
4. Look for status change controls:
   - Status dropdown
   - "Confirm" button
   - "Cancel" button
5. Verify status controls are either:
   - Not visible
   - Visible but disabled
6. If controls appear available, attempt to change
7. Verify change is blocked
8. Check that booking status remains unchanged

**Expected Results**:

- [ ] Cannot access status change controls
- [ ] Cannot confirm bookings
- [ ] Cannot cancel bookings
- [ ] Status remains unchanged

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-005: Cannot Verify Payments

**Goal**: Verify staff cannot verify payment records

**Preconditions**:

- Logged in as Staff
- A pending payment exists

**Steps**:

1. Navigate to `/admin/payments`
2. Find a payment with "Pending" verification status
3. View payment details
4. Look for "Verify" or "Approve" button
5. Verify the button is either:
   - Not visible
   - Visible but disabled
6. If verify appears available, attempt to click
7. Verify action is blocked
8. Look for "Reject" button
9. Verify reject is also blocked
10. Confirm payment status remains unchanged

**Expected Results**:

- [ ] Cannot verify payments
- [ ] Cannot reject payments
- [ ] Payment status unchanged
- [ ] Proper access denial

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-006: Cannot Access Unit Management

**Goal**: Verify staff cannot access unit management

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Look for "Units" in the navigation menu
2. If visible, click on it
3. Try navigating directly to `/admin/units`
4. Verify either:
   - Page shows access denied
   - Redirects to allowed page
   - 404 or restricted message
5. Try `/admin/units/pricing`
6. Verify pricing page is also restricted
7. Check network responses for 403 status
8. Document the restriction behavior

**Expected Results**:

- [ ] Units management not accessible
- [ ] Pricing configuration not accessible
- [ ] Clear access denial or redirect
- [ ] API returns 403 for restricted endpoints

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-007: Cannot Access Role Management

**Goal**: Verify staff cannot access role/user management

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Look for "Roles" or "Users" in navigation
2. Verify it is not visible for staff
3. Try navigating directly to `/admin/roles`
4. Verify access is denied
5. Try `/admin/users` (if exists)
6. Verify access is denied
7. Check for any user management options
8. Verify staff cannot modify any user roles
9. Check network tab for 403 responses

**Expected Results**:

- [ ] Role management not in navigation
- [ ] Cannot access role management
- [ ] Cannot access user management
- [ ] Proper 403 responses

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-008: Cannot Access Audit Logs

**Goal**: Verify staff cannot access audit logs

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Look for "Audit Logs" in navigation
2. Verify it is not visible for staff
3. Try navigating directly to `/admin/audit-logs`
4. Verify access is denied
5. Check if audit information appears elsewhere
6. Verify staff cannot see security-sensitive logs
7. Document the restriction behavior

**Expected Results**:

- [ ] Audit logs not in navigation
- [ ] Cannot access audit log page
- [ ] No sensitive audit data visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-009: API Endpoint Protection

**Goal**: Verify staff cannot bypass UI restrictions via direct API calls

**Preconditions**:

- Logged in as Staff
- DevTools Network tab open
- Know how to use browser console for fetch requests

**Steps**:

1. Open DevTools Console
2. Try to call booking update API directly:
   ```javascript
   fetch("/api/bookings/[id]", {
     method: "PUT",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ status: "confirmed" }),
   })
     .then((r) => r.json())
     .then(console.log);
   ```
3. Verify API returns 403 Forbidden
4. Try to call payment verify API:
   ```javascript
   fetch("/api/payments/[id]/verify", {
     method: "POST",
   })
     .then((r) => r.json())
     .then(console.log);
   ```
5. Verify API returns 403 Forbidden
6. Try to call unit create/update API
7. Verify API returns 403 Forbidden
8. Document all API responses

**Expected Results**:

- [ ] Booking update API returns 403
- [ ] Payment verify API returns 403
- [ ] Unit management API returns 403
- [ ] All restricted APIs properly protected

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DENY-010: Cannot Access Expense Management

**Goal**: Verify staff cannot access or modify expenses

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Look for "Expenses" in navigation
2. Try navigating directly to `/admin/expenses`
3. If page loads:
   - Verify it's read-only (view list only)
   - Verify "Add Expense" is hidden/disabled
   - Verify "Edit" is hidden/disabled
   - Verify "Delete" is hidden/disabled
4. If page blocked:
   - Verify access denied message
   - Or redirect to allowed page
5. Check if staff should have any expense access
6. Document the actual behavior

**Expected Results**:

- [ ] Expenses either fully restricted or read-only
- [ ] Cannot create expenses
- [ ] Cannot edit expenses
- [ ] Cannot delete expenses

**Result**: [ ] Pass [ ] Fail

**Staff Expense Access Level**: [ ] None [ ] Read-Only [ ] Full (unexpected)

**Notes/Issues Found**:

---

---

## Permission Matrix Verification

Verify each action against expected staff permissions:

| Action          | Expected  | Actual | Pass/Fail |
| --------------- | --------- | ------ | --------- |
| View bookings   | ✓ Allowed |        |           |
| Create booking  | ✗ Denied  |        |           |
| Edit booking    | ✗ Denied  |        |           |
| Delete booking  | ✗ Denied  |        |           |
| View payments   | ✓ Allowed |        |           |
| Verify payment  | ✗ Denied  |        |           |
| Create payment  | ✗ Denied  |        |           |
| View dashboard  | ✓ Allowed |        |           |
| View units      | ✗ Denied  |        |           |
| Edit units      | ✗ Denied  |        |           |
| Manage pricing  | ✗ Denied  |        |           |
| Manage roles    | ✗ Denied  |        |           |
| View audit logs | ✗ Denied  |        |           |
| View expenses   | ✗/?       |        |           |
| Create expenses | ✗ Denied  |        |           |

---

## Summary

| Test Case         | Description                      | Result |
| ----------------- | -------------------------------- | ------ |
| TC-STAFF-DENY-001 | Cannot Create New Booking        |        |
| TC-STAFF-DENY-002 | Cannot Edit Existing Booking     |        |
| TC-STAFF-DENY-003 | Cannot Delete Booking            |        |
| TC-STAFF-DENY-004 | Cannot Change Booking Status     |        |
| TC-STAFF-DENY-005 | Cannot Verify Payments           |        |
| TC-STAFF-DENY-006 | Cannot Access Unit Management    |        |
| TC-STAFF-DENY-007 | Cannot Access Role Management    |        |
| TC-STAFF-DENY-008 | Cannot Access Audit Logs         |        |
| TC-STAFF-DENY-009 | API Endpoint Protection          |        |
| TC-STAFF-DENY-010 | Cannot Access Expense Management |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Security Concerns Found**:

---

---

**Overall Notes**:

---

---
