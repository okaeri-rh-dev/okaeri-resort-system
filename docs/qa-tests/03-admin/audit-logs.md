# Audit Logs Tests (Admin - Full Access)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] Some recent activity in the system (bookings, payments, etc.)
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-AUDIT-001: Access Audit Logs

**Goal**: Verify admin can access audit logs page

**Preconditions**:

- Logged in as Admin

**Steps**:

1. Look for "Audit Logs" in navigation
2. Click to navigate to audit logs
3. Or navigate directly to `/admin/audit-logs`
4. Verify the page loads without console errors
5. Check that audit log list is visible
6. Verify log entries are displayed with:
   - Timestamp
   - Event type/action
   - User who performed action
   - Affected entity
   - Description/details
7. Verify recent entries appear first (descending order)

**Expected Results**:

- [ ] Page loads without errors
- [ ] Audit log list visible
- [ ] All columns present
- [ ] Logs sorted by date (newest first)

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-002: View Booking-Related Logs

**Goal**: Verify booking actions are logged

**Preconditions**:

- Some booking operations have been performed

**Steps**:

1. Navigate to audit logs
2. Look for booking-related entries:
   - booking.created
   - booking.updated
   - booking.status_changed
   - booking.deleted
3. Click on a booking creation log
4. Verify details include:
   - Booking reference
   - Guest name
   - Unit assigned
   - Dates
   - Who created it
5. Find a status change log
6. Verify old and new status recorded
7. Find a deletion log (if any)
8. Verify deletion is fully logged

**Expected Results**:

- [ ] Booking creation logged
- [ ] Booking updates logged
- [ ] Status changes logged
- [ ] Deletions logged
- [ ] Details are comprehensive

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-003: View Payment-Related Logs

**Goal**: Verify payment actions are logged

**Preconditions**:

- Some payment operations have been performed

**Steps**:

1. Navigate to audit logs
2. Look for payment-related entries:
   - payment.created
   - payment.verified
   - payment.rejected
   - payment.deleted
3. Click on a payment verification log
4. Verify details include:
   - Payment ID
   - Booking reference
   - Amount
   - Verifier name
   - Verification timestamp
5. Find a rejection log (if any)
6. Verify rejection reason is recorded
7. Check that sensitive data is appropriately handled

**Expected Results**:

- [ ] Payment creation logged
- [ ] Verification logged
- [ ] Rejections logged with reason
- [ ] No sensitive financial data exposed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-004: View User/Role Logs

**Goal**: Verify user and role actions are logged

**Preconditions**:

- Some user management operations have been performed

**Steps**:

1. Navigate to audit logs
2. Look for user-related entries:
   - user.created
   - user.role_changed
   - user.deactivated
   - user.login
   - user.logout
3. Click on a role change log
4. Verify details include:
   - Affected user
   - Old role
   - New role
   - Admin who made change
5. Check for login logs
6. Verify IP address recorded (if implemented)
7. Check for failed login attempts (if logged)

**Expected Results**:

- [ ] User creation logged
- [ ] Role changes logged with old/new
- [ ] Login activity logged
- [ ] IP addresses captured (if applicable)

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-005: Filter Audit Logs

**Goal**: Verify admin can filter audit logs

**Preconditions**:

- Multiple types of audit logs exist

**Steps**:

1. Navigate to audit logs
2. Locate filter controls
3. Filter by event type:
   - Select "Booking" events only
   - Verify only booking logs shown
4. Filter by date range:
   - Select "Today"
   - Verify only today's logs
5. Filter by user:
   - Select specific admin user
   - Verify only their actions shown
6. Combine filters:
   - Event type + date range
   - Verify combined filter works
7. Clear all filters
8. Verify full list returns

**Expected Results**:

- [ ] Event type filter works
- [ ] Date filter works
- [ ] User filter works
- [ ] Combined filters work
- [ ] Filters can be cleared

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-006: Search Audit Logs

**Goal**: Verify admin can search audit logs

**Preconditions**:

- Various audit logs exist

**Steps**:

1. Navigate to audit logs
2. Locate search functionality
3. Search by booking reference
4. Verify matching logs appear
5. Search by user email
6. Verify user's actions appear
7. Search by action keyword (e.g., "created")
8. Verify matching logs
9. Search for non-existent term
10. Verify "No results" message
11. Clear search
12. Verify full list returns

**Expected Results**:

- [ ] Search by reference works
- [ ] Search by user works
- [ ] Search by keyword works
- [ ] No results handled gracefully
- [ ] Search can be cleared

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-007: Audit Log Pagination

**Goal**: Verify pagination for large audit logs

**Preconditions**:

- Many audit log entries exist (>50)

**Steps**:

1. Navigate to audit logs
2. Check if pagination is visible
3. Note entries per page
4. Click "Next" or page 2
5. Verify next set of logs loads
6. Verify no duplicate entries
7. Click "Previous"
8. Verify original entries return
9. Go to last page
10. Verify oldest entries shown
11. Test page jump (if available)
12. Verify total count is accurate

**Expected Results**:

- [ ] Pagination works
- [ ] No duplicates across pages
- [ ] Page navigation accurate
- [ ] Total count displayed

**Result**: [ ] Pass [ ] Fail

**Entries Per Page**: \_\_\_

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-008: Export Audit Logs

**Goal**: Verify admin can export audit logs

**Preconditions**:

- Audit logs exist

**Steps**:

1. Navigate to audit logs
2. Look for "Export" or "Download" button
3. If available:
   - Click Export
   - Select format (CSV, Excel, PDF)
   - Verify download starts
   - Open exported file
   - Verify data matches displayed logs
   - Test export with filters applied
   - Verify filtered data exported
4. If not available:
   - Document as N/A

**Expected Results**:

- [ ] Export option available (or N/A)
- [ ] Export downloads correctly
- [ ] Data matches displayed logs
- [ ] Filters affect export

**Result**: [ ] Pass [ ] Fail [ ] N/A (export not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-009: Audit Log Immutability

**Goal**: Verify audit logs cannot be modified or deleted

**Preconditions**:

- Audit logs exist

**Steps**:

1. Navigate to audit logs
2. View any log entry
3. Look for "Edit" or "Delete" options
4. Verify NO edit/delete options exist
5. Try API manipulation (if possible):
   - Open DevTools Console
   - Try to call delete endpoint
   - Verify 403 or endpoint doesn't exist
6. Verify timestamps cannot be altered
7. Document immutability guarantees

**Expected Results**:

- [ ] No edit controls visible
- [ ] No delete controls visible
- [ ] API prevents modification
- [ ] Logs are truly immutable

**Result**: [ ] Pass [ ] Fail

**Immutability Verified**: [ ] Yes [ ] No (security concern)

**Notes/Issues Found**:

---

---

### TC-ADMIN-AUDIT-010: Real-Time Audit Logging

**Goal**: Verify audit logs appear in real-time

**Preconditions**:

- Audit log page open in one tab

**Steps**:

1. Open audit logs in Tab 1
2. Note the most recent entry
3. Open a new tab (Tab 2)
4. Perform an action (create booking, verify payment)
5. Return to Tab 1 (audit logs)
6. Refresh the page
7. Verify new action appears
8. Check for auto-refresh (if implemented)
9. If auto-refresh exists:
   - Perform another action
   - Watch without refreshing
   - Verify log appears automatically
10. Note refresh requirement

**Expected Results**:

- [ ] New actions logged immediately
- [ ] Logs appear after refresh
- [ ] Auto-refresh works (if implemented)
- [ ] No significant delay

**Result**: [ ] Pass [ ] Fail

**Auto-Refresh**: [ ] Yes (interval: \_\_\_) [ ] No (manual refresh)

**Notes/Issues Found**:

---

---

## Summary

| Test Case          | Description               | Result |
| ------------------ | ------------------------- | ------ |
| TC-ADMIN-AUDIT-001 | Access Audit Logs         |        |
| TC-ADMIN-AUDIT-002 | View Booking-Related Logs |        |
| TC-ADMIN-AUDIT-003 | View Payment-Related Logs |        |
| TC-ADMIN-AUDIT-004 | View User/Role Logs       |        |
| TC-ADMIN-AUDIT-005 | Filter Audit Logs         |        |
| TC-ADMIN-AUDIT-006 | Search Audit Logs         |        |
| TC-ADMIN-AUDIT-007 | Audit Log Pagination      |        |
| TC-ADMIN-AUDIT-008 | Export Audit Logs         |        |
| TC-ADMIN-AUDIT-009 | Audit Log Immutability    |        |
| TC-ADMIN-AUDIT-010 | Real-Time Audit Logging   |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Security Assessment**:

---

**Overall Notes**:

---

---
