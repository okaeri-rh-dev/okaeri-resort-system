# QA Test: Role Permission Boundaries

| Field              | Value               |
| ------------------ | ------------------- |
| **Test ID**        | INT-002             |
| **Priority**       | Critical            |
| **Roles Required** | Staff, Admin, Owner |
| **Estimated Time** | 20 minutes          |

## Objective

Verify that role-based access control is properly enforced across all system features, ensuring each role can only access their permitted functionality.

## Prerequisites

- [ ] Test accounts for Staff, Admin, and Owner roles
- [ ] System has existing data to test against
- [ ] Multiple browser sessions or incognito windows

## Permission Matrix Reference

| Feature         | Staff       | Admin       | Owner    |
| --------------- | ----------- | ----------- | -------- |
| View Dashboard  | ✓ (limited) | ✓           | ✓ (full) |
| View Bookings   | ✓           | ✓           | ✓        |
| Create Booking  | ✗           | ✓           | ✓        |
| Edit Booking    | ✗           | ✓           | ✓        |
| Delete Booking  | ✗           | ✗           | ✓        |
| View Payments   | ✓           | ✓           | ✓        |
| Verify Payment  | ✗           | ✓           | ✓        |
| View Units      | ✓           | ✓           | ✓        |
| Manage Units    | ✗           | ✓           | ✓        |
| View Expenses   | ✗           | ✓           | ✓        |
| Manage Expenses | ✗           | ✗           | ✓        |
| View Audit Logs | ✗           | ✓ (limited) | ✓ (full) |
| System Settings | ✗           | ✗           | ✓        |
| User Management | ✗           | ✗           | ✓        |

---

## Test 1: Staff Permission Boundaries

**Login as: staff@okaeri.ph**

### Navigation Access

| Navigation Item | Expected               | Actual | Pass/Fail |
| --------------- | ---------------------- | ------ | --------- |
| Dashboard       | Visible (limited view) |        |           |
| Bookings        | Visible                |        |           |
| Payments        | Visible                |        |           |
| Units           | Visible                |        |           |
| Guests          | Visible                |        |           |
| Expenses        | Hidden or Read-only    |        |           |
| Audit Logs      | Hidden                 |        |           |
| Settings        | Hidden                 |        |           |

### Action Restrictions

| Action                              | Expected Behavior      | Actual | Pass/Fail |
| ----------------------------------- | ---------------------- | ------ | --------- |
| Click "New Booking"                 | Button hidden/disabled |        |           |
| Click "Edit" on booking             | Button hidden/disabled |        |           |
| Click "Delete" on booking           | Button hidden/disabled |        |           |
| Click "Verify" on payment           | Button hidden/disabled |        |           |
| Click "Add Unit"                    | Button hidden/disabled |        |           |
| Access /admin/settings URL directly | Redirect or 403 error  |        |           |

### Direct URL Access Attempts

| URL                 | Expected Response            | Actual | Pass/Fail |
| ------------------- | ---------------------------- | ------ | --------- |
| /admin/settings     | Redirect to dashboard or 403 |        |           |
| /admin/audit        | Redirect to dashboard or 403 |        |           |
| /admin/users        | Redirect to dashboard or 403 |        |           |
| /admin/bookings/new | Redirect to dashboard or 403 |        |           |

---

## Test 2: Admin Permission Boundaries

**Login as: admin@okaeri.ph**

### Navigation Access

| Navigation Item | Expected                      | Actual | Pass/Fail |
| --------------- | ----------------------------- | ------ | --------- |
| Dashboard       | Visible (more metrics)        |        |           |
| Bookings        | Visible with edit options     |        |           |
| Payments        | Visible with verify option    |        |           |
| Units           | Visible with manage options   |        |           |
| Guests          | Visible with edit options     |        |           |
| Expenses        | Visible (read + limited edit) |        |           |
| Audit Logs      | Visible (limited scope)       |        |           |
| Settings        | Hidden                        |        |           |
| User Management | Hidden                        |        |           |

### Action Capabilities

| Action                | Expected Behavior           | Actual | Pass/Fail |
| --------------------- | --------------------------- | ------ | --------- |
| Create new booking    | Allowed                     |        |           |
| Edit existing booking | Allowed                     |        |           |
| Delete booking        | Not allowed                 |        |           |
| Verify payment        | Allowed                     |        |           |
| Reject payment        | Allowed                     |        |           |
| Add new unit          | Allowed                     |        |           |
| Edit unit pricing     | Allowed                     |        |           |
| Delete unit           | Not allowed or confirmation |        |           |
| Create expense        | Allowed                     |        |           |
| Delete expense        | Not allowed                 |        |           |

### Owner-Only Features

| Feature                  | Expected for Admin | Actual | Pass/Fail |
| ------------------------ | ------------------ | ------ | --------- |
| Financial Reports (full) | Limited access     |        |           |
| System Settings          | No access          |        |           |
| User Role Management     | No access          |        |           |
| Export all data          | Limited export     |        |           |
| Delete anything          | Restricted         |        |           |

### Direct URL Access Attempts

| URL             | Expected Response | Actual | Pass/Fail |
| --------------- | ----------------- | ------ | --------- |
| /admin/settings | Redirect or 403   |        |           |
| /admin/users    | Redirect or 403   |        |           |
| /owner/reports  | Redirect or 403   |        |           |

---

## Test 3: Owner Full Access Verification

**Login as: owner@okaeri.ph**

### Navigation Access

| Navigation Item   | Expected             | Actual | Pass/Fail |
| ----------------- | -------------------- | ------ | --------- |
| Dashboard         | Full metrics visible |        |           |
| Bookings          | Full CRUD access     |        |           |
| Payments          | Full management      |        |           |
| Units             | Full management      |        |           |
| Guests            | Full management      |        |           |
| Expenses          | Full CRUD access     |        |           |
| Audit Logs        | Complete access      |        |           |
| Settings          | Full access          |        |           |
| User Management   | Full access          |        |           |
| Financial Reports | Complete reports     |        |           |

### Exclusive Owner Actions

| Action                    | Expected Behavior           | Actual | Pass/Fail |
| ------------------------- | --------------------------- | ------ | --------- |
| Delete any booking        | Allowed (with confirmation) |        |           |
| Delete any expense        | Allowed                     |        |           |
| Modify system settings    | Allowed                     |        |           |
| Manage user roles         | Allowed                     |        |           |
| Export all data types     | Allowed                     |        |           |
| View complete audit trail | All entries visible         |        |           |
| Access financial reports  | Full reports available      |        |           |

---

## Test 4: Cross-Role Data Visibility

### Booking Visibility

| Role  | Can See All Bookings | Can See Booking Details | Pass/Fail |
| ----- | -------------------- | ----------------------- | --------- |
| Staff | ✓ (read-only)        | ✓ (limited details)     |           |
| Admin | ✓ (editable)         | ✓ (full details)        |           |
| Owner | ✓ (full control)     | ✓ (all details)         |           |

### Payment Visibility

| Role  | Can See All Payments | Can See Amount | Can See Method | Pass/Fail |
| ----- | -------------------- | -------------- | -------------- | --------- |
| Staff | ✓                    | ✓              | ✓              |           |
| Admin | ✓                    | ✓              | ✓              |           |
| Owner | ✓                    | ✓              | ✓              |           |

### Sensitive Data

| Data Type           | Staff Access | Admin Access | Owner Access | Pass/Fail |
| ------------------- | ------------ | ------------ | ------------ | --------- |
| Guest phone numbers | View only    | View + Edit  | Full         |           |
| Guest email         | View only    | View + Edit  | Full         |           |
| Payment references  | View         | View + Edit  | Full         |           |
| Financial totals    | Limited      | Partial      | Full         |           |

---

## Test 5: API Permission Enforcement

Test direct API calls to verify backend enforcement:

### Staff Role API Calls

| Endpoint                  | Method | Expected Response | Actual | Pass/Fail |
| ------------------------- | ------ | ----------------- | ------ | --------- |
| POST /api/bookings        | POST   | 403 Forbidden     |        |           |
| PUT /api/bookings/:id     | PUT    | 403 Forbidden     |        |           |
| DELETE /api/bookings/:id  | DELETE | 403 Forbidden     |        |           |
| POST /api/payments/verify | POST   | 403 Forbidden     |        |           |

### Admin Role API Calls

| Endpoint                 | Method | Expected Response | Actual | Pass/Fail |
| ------------------------ | ------ | ----------------- | ------ | --------- |
| POST /api/bookings       | POST   | 201 Created       |        |           |
| PUT /api/bookings/:id    | PUT    | 200 OK            |        |           |
| DELETE /api/bookings/:id | DELETE | 403 Forbidden     |        |           |
| GET /api/settings        | GET    | 403 Forbidden     |        |           |
| PUT /api/settings        | PUT    | 403 Forbidden     |        |           |

---

## Security Boundary Violations to Check

| Violation Attempt                        | Method      | Expected Block  | Pass/Fail |
| ---------------------------------------- | ----------- | --------------- | --------- |
| Staff edits booking via URL manipulation | Direct URL  | Blocked         |           |
| Admin accesses settings via bookmark     | Direct URL  | Blocked         |           |
| Modify role in local storage             | Client-side | Server rejects  |           |
| Expired session attempts action          | Stale token | Session invalid |           |

## Expected Results

- Each role has exactly the permissions defined in the matrix
- No permission escalation is possible
- Direct URL access respects role boundaries
- API calls enforce permissions server-side
- UI correctly hides/disables unavailable actions
- Sensitive data visibility matches role level

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Staff Account: _______________
Admin Account: _______________
Owner Account: _______________

Permission Violations Found:
_________________________________
_________________________________

UI/API Mismatches:
_________________________________
_________________________________
```
