# Role Management Tests (Admin Only)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] Test user accounts available for role changes
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-ROLE-001: Access Role Management

**Goal**: Verify admin can access role management page

**Preconditions**:

- Logged in as Admin

**Steps**:

1. Look for "Roles" or "Users" in navigation
2. Click to navigate to role management
3. Or navigate directly to `/admin/roles`
4. Verify the page loads without console errors
5. Check that user list is visible
6. Verify user information displayed:
   - Email
   - Name
   - Current role
   - Status (active/inactive)
7. Verify admin has access to all controls

**Expected Results**:

- [ ] Page loads without errors
- [ ] User list visible
- [ ] Role information displayed
- [ ] Admin controls available

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-002: View All Users

**Goal**: Verify admin can see all users in the system

**Preconditions**:

- On the role management page

**Steps**:

1. View the users list
2. Verify the following test accounts appear:
   - Owner: `jasonacido+owner@gmail.com`
   - Admin: `jasonacido+admin@gmail.com`
   - Staff: `jasonacido+staff@gmail.com`
3. Verify each user shows their role
4. Check for pagination if many users
5. Look for search/filter functionality
6. Verify no sensitive data exposed (passwords)
7. Check that user creation date visible (if implemented)

**Expected Results**:

- [ ] All users visible
- [ ] Roles displayed correctly
- [ ] Search/filter works (if available)
- [ ] No sensitive data exposed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-003: Change User Role

**Goal**: Verify admin can change user roles

**Preconditions**:

- A staff user exists for testing

**Steps**:

1. Find the staff test user in the list
2. Click "Edit" or role dropdown
3. View available role options:
   - Staff
   - Admin
   - Owner (may be restricted)
4. Change role from Staff to Admin
5. Verify confirmation dialog
6. Confirm the change
7. Verify success message
8. Verify role updated in list
9. Have the user log in and verify new permissions
10. **IMPORTANT**: Restore original role after test

**Expected Results**:

- [ ] Can access role change
- [ ] Role options displayed
- [ ] Confirmation required
- [ ] Role change persists
- [ ] User has new permissions

**Result**: [ ] Pass [ ] Fail

**Restore Completed**: [ ] Yes [ ] No

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-004: Create New User

**Goal**: Verify admin can create new users

**Preconditions**:

- On the role management page

**Steps**:

1. Click "Add User" or "Invite User"
2. Verify user creation form appears
3. Fill in details:
   - Email: `qatest+newuser@example.com`
   - Name: "QA Test New User"
   - Role: Staff
4. If password creation available:
   - Set temporary password
   - Or verify invitation email is sent
5. Save/Create the user
6. Verify success message
7. Verify new user appears in list
8. If invitation sent, verify email received
9. **Cleanup**: Delete test user after testing

**Expected Results**:

- [ ] Can create new users
- [ ] Role assignable at creation
- [ ] User appears in list
- [ ] Invitation/password method works

**Result**: [ ] Pass [ ] Fail

**User Creation Method**: [ ] Direct password [ ] Email invitation

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-005: Deactivate User Account

**Goal**: Verify admin can deactivate user accounts

**Preconditions**:

- A test user exists (or create one)

**Steps**:

1. Find a test user in the list
2. Look for "Deactivate" or status toggle
3. Click to deactivate the user
4. Verify confirmation dialog
5. Confirm deactivation
6. Verify status changes to "Inactive"
7. Attempt to log in as deactivated user
8. Verify login is rejected
9. Verify appropriate error message
10. Reactivate the user
11. Verify login works again

**Expected Results**:

- [ ] Can deactivate users
- [ ] Deactivated users cannot log in
- [ ] Clear error on login attempt
- [ ] Can reactivate users

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-006: Delete User Account

**Goal**: Verify admin can delete user accounts (if implemented)

**Preconditions**:

- A test user exists for deletion

**Steps**:

1. Find a test user to delete
2. Look for "Delete" button/option
3. If available:
   - Click Delete
   - Verify warning about permanent deletion
   - Verify mention of associated data
   - Click Cancel first
   - Verify user still exists
   - Click Delete and confirm
   - Verify user removed from list
   - Verify user cannot log in
4. If delete not available:
   - Verify only deactivation is possible
   - Document as soft-delete only

**Expected Results**:

- [ ] Delete available (or documented as not implemented)
- [ ] Confirmation required
- [ ] User is removed
- [ ] Associated data handled appropriately

**Result**: [ ] Pass [ ] Fail [ ] N/A (delete not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-007: Role Permission Verification

**Goal**: Verify role permissions are correctly enforced

**Preconditions**:

- Users with different roles exist

**Steps**:

1. Document current role permissions:

   | Permission      | Staff | Admin | Owner |
   | --------------- | ----- | ----- | ----- |
   | View bookings   |       |       |       |
   | Create bookings |       |       |       |
   | Edit bookings   |       |       |       |
   | Verify payments |       |       |       |
   | Manage units    |       |       |       |
   | Manage pricing  |       |       |       |
   | View audit logs |       |       |       |
   | Manage roles    |       |       |       |

2. Verify Staff permissions match expected
3. Verify Admin permissions match expected
4. Verify Owner permissions match expected
5. Test boundary between roles
6. Document any discrepancies

**Expected Results**:

- [ ] Staff permissions correct
- [ ] Admin permissions correct
- [ ] Owner permissions correct
- [ ] Permission boundaries enforced

**Result**: [ ] Pass [ ] Fail

**Permission Matrix Above**: Fill in with ✓ or ✗

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-008: Cannot Modify Own Role

**Goal**: Verify admin cannot modify their own role

**Preconditions**:

- Logged in as Admin

**Steps**:

1. Navigate to role management
2. Find own user account in the list
3. Try to change own role
4. Verify:
   - Option is disabled, OR
   - Warning is shown, OR
   - Change is prevented
5. Verify cannot demote self to Staff
6. Verify cannot escalate to Owner (if applicable)
7. Document self-modification restrictions

**Expected Results**:

- [ ] Cannot modify own role
- [ ] Clear feedback about restriction
- [ ] Cannot accidentally lose access

**Result**: [ ] Pass [ ] Fail

**Self-Modification Behavior**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-009: Role Activity Logging

**Goal**: Verify role changes are logged for audit

**Preconditions**:

- Have made role changes during testing

**Steps**:

1. Navigate to audit logs (`/admin/audit-logs`)
2. Search/filter for role-related events
3. Verify the following are logged:
   - Role changes
   - User creation
   - User deactivation
   - User deletion (if applicable)
4. Check log entries include:
   - Timestamp
   - Admin who made change
   - User affected
   - Old and new values
5. Verify logs cannot be modified

**Expected Results**:

- [ ] Role changes logged
- [ ] User changes logged
- [ ] Complete audit trail
- [ ] Logs are immutable

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-ROLE-010: Owner Role Restrictions

**Goal**: Verify Owner role cannot be assigned by Admin

**Preconditions**:

- Logged in as Admin (not Owner)

**Steps**:

1. Navigate to role management
2. Try to assign Owner role to any user
3. Verify either:
   - Owner option is not available
   - Owner selection is blocked with error
   - Confirmation requires Owner authentication
4. Verify Admin cannot create new Owner users
5. Verify Admin cannot escalate self to Owner
6. Document Owner role restrictions
7. Test that only existing Owner can assign Owner (if possible)

**Expected Results**:

- [ ] Admin cannot assign Owner role
- [ ] Owner creation restricted
- [ ] Clear messaging about restriction
- [ ] Owner role protected

**Result**: [ ] Pass [ ] Fail

**Owner Assignment Rules**: ******\_\_\_******

**Notes/Issues Found**:

---

---

## Summary

| Test Case         | Description                  | Result |
| ----------------- | ---------------------------- | ------ |
| TC-ADMIN-ROLE-001 | Access Role Management       |        |
| TC-ADMIN-ROLE-002 | View All Users               |        |
| TC-ADMIN-ROLE-003 | Change User Role             |        |
| TC-ADMIN-ROLE-004 | Create New User              |        |
| TC-ADMIN-ROLE-005 | Deactivate User Account      |        |
| TC-ADMIN-ROLE-006 | Delete User Account          |        |
| TC-ADMIN-ROLE-007 | Role Permission Verification |        |
| TC-ADMIN-ROLE-008 | Cannot Modify Own Role       |        |
| TC-ADMIN-ROLE-009 | Role Activity Logging        |        |
| TC-ADMIN-ROLE-010 | Owner Role Restrictions      |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Security Observations**:

---

**Overall Notes**:

---

---
