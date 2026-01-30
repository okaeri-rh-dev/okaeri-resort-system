# QA Test: Audit Trail Completeness

| Field              | Value        |
| ------------------ | ------------ |
| **Test ID**        | INT-005      |
| **Priority**       | High         |
| **Roles Required** | Admin, Owner |
| **Estimated Time** | 20 minutes   |

## Objective

Verify that all significant system actions are properly logged in the audit trail with accurate details, timestamps, and user attribution.

## Prerequisites

- [ ] Admin and Owner accounts available
- [ ] Audit log viewer accessible (Owner role)
- [ ] Clean test data or identifiable test records
- [ ] Note start time of testing for filtering

## Test Start Time: ******\_\_\_******

---

## Test 1: Booking Actions Audit

**Role: Admin**

### Create Booking

| Step | Action                                    | Audit Expected            | Pass/Fail |
| ---- | ----------------------------------------- | ------------------------- | --------- |
| 1    | Create new booking for "Audit Test Guest" |                           |           |
| 2    | Note booking reference                    | Reference: ******\_****** |           |

**Expected Audit Entry:**

- Action: `booking.created`
- Entity: Booking ID
- User: Admin
- Changes: Full booking details

### Edit Booking

| Step | Action                          | Audit Expected | Pass/Fail |
| ---- | ------------------------------- | -------------- | --------- |
| 1    | Edit the booking (change dates) |                |           |
| 2    | Save changes                    |                |           |

**Expected Audit Entry:**

- Action: `booking.updated`
- Entity: Same Booking ID
- User: Admin
- Changes: Before/after dates

### Change Booking Status

| Step | Action              | Audit Expected | Pass/Fail |
| ---- | ------------------- | -------------- | --------- |
| 1    | Confirm the booking |                |           |

**Expected Audit Entry:**

- Action: `booking.status_changed`
- Entity: Same Booking ID
- User: Admin
- Changes: Status: Pending → Confirmed

---

## Test 2: Payment Actions Audit

**Role: Admin**

### Record Payment

| Step | Action                          | Audit Expected             | Pass/Fail |
| ---- | ------------------------------- | -------------------------- | --------- |
| 1    | Record payment for test booking |                            |           |
| 2    | Note payment ID                 | Payment ID: ******\_****** |           |

**Expected Audit Entry:**

- Action: `payment.created`
- Entity: Payment ID
- User: Admin
- Details: Amount, method, booking reference

### Verify Payment

| Step | Action             | Audit Expected | Pass/Fail |
| ---- | ------------------ | -------------- | --------- |
| 1    | Verify the payment |                |           |

**Expected Audit Entry:**

- Action: `payment.verified`
- Entity: Payment ID
- User: Admin
- Changes: Status: Pending → Verified

### Reject Payment (Create Another First)

| Step | Action                 | Audit Expected | Pass/Fail |
| ---- | ---------------------- | -------------- | --------- |
| 1    | Record another payment |                |           |
| 2    | Reject this payment    |                |           |

**Expected Audit Entry:**

- Action: `payment.rejected`
- Entity: Payment ID
- User: Admin
- Details: Rejection reason (if provided)

---

## Test 3: Unit Actions Audit

**Role: Admin**

### Create Unit

| Step | Action                            | Audit Expected          | Pass/Fail |
| ---- | --------------------------------- | ----------------------- | --------- |
| 1    | Create new unit "Audit Test Unit" |                         |           |
| 2    | Note unit ID                      | Unit ID: ******\_****** |           |

**Expected Audit Entry:**

- Action: `unit.created`
- Entity: Unit ID
- User: Admin
- Details: Unit name, capacity, base price

### Update Unit Pricing

| Step | Action                 | Audit Expected | Pass/Fail |
| ---- | ---------------------- | -------------- | --------- |
| 1    | Modify unit base price |                |           |

**Expected Audit Entry:**

- Action: `unit.pricing_updated`
- Entity: Unit ID
- User: Admin
- Changes: Before/after price

---

## Test 4: User/Auth Actions Audit

**Role: Admin/Owner**

### Login Event

| Step | Action      | Audit Expected | Pass/Fail |
| ---- | ----------- | -------------- | --------- |
| 1    | Logout      |                |           |
| 2    | Login again |                |           |

**Expected Audit Entry:**

- Action: `auth.login`
- User: Logged in user
- Details: IP address, user agent (if captured)

### Failed Login (if testable)

| Step | Action                            | Audit Expected | Pass/Fail |
| ---- | --------------------------------- | -------------- | --------- |
| 1    | Attempt login with wrong password |                |           |

**Expected Audit Entry:**

- Action: `auth.login_failed`
- Details: Attempted username, IP address

---

## Test 5: Expense Actions Audit

**Role: Owner**

### Create Expense

| Step | Action                              | Audit Expected             | Pass/Fail |
| ---- | ----------------------------------- | -------------------------- | --------- |
| 1    | Create expense "Audit Test Expense" |                            |           |
| 2    | Note expense ID                     | Expense ID: ******\_****** |           |

**Expected Audit Entry:**

- Action: `expense.created`
- Entity: Expense ID
- User: Owner
- Details: Amount, category, description

### Delete Expense

| Step | Action                  | Audit Expected | Pass/Fail |
| ---- | ----------------------- | -------------- | --------- |
| 1    | Delete the test expense |                |           |

**Expected Audit Entry:**

- Action: `expense.deleted`
- Entity: Expense ID
- User: Owner
- Details: Full expense record (for recovery)

---

## Test 6: Audit Log Viewer Verification

**Role: Owner**

### View Audit Logs

| Step | Action                            | Expected               | Pass/Fail |
| ---- | --------------------------------- | ---------------------- | --------- |
| 1    | Navigate to Audit Logs            | Audit viewer loads     |           |
| 2    | Filter by date (today)            | Today's entries shown  |           |
| 3    | Filter by action type "booking"   | Only booking actions   |           |
| 4    | Filter by user "Admin"            | Only admin's actions   |           |
| 5    | Search for test booking reference | Matching entries found |           |

### Verify All Test Actions Logged

Check that each action from tests 1-5 appears:

| Action                 | Found in Audit | Timestamp Accurate | User Correct | Pass/Fail |
| ---------------------- | -------------- | ------------------ | ------------ | --------- |
| booking.created        |                |                    |              |           |
| booking.updated        |                |                    |              |           |
| booking.status_changed |                |                    |              |           |
| payment.created        |                |                    |              |           |
| payment.verified       |                |                    |              |           |
| payment.rejected       |                |                    |              |           |
| unit.created           |                |                    |              |           |
| unit.pricing_updated   |                |                    |              |           |
| expense.created        |                |                    |              |           |
| expense.deleted        |                |                    |              |           |
| auth.login             |                |                    |              |           |

---

## Test 7: Audit Entry Detail Verification

**Role: Owner**

### Examine Specific Entry

| Field            | Expected Content             | Actual | Pass/Fail |
| ---------------- | ---------------------------- | ------ | --------- |
| Timestamp        | Accurate to minute           |        |           |
| Action           | Correct action type          |        |           |
| Entity Type      | booking/payment/unit/expense |        |           |
| Entity ID        | Correct ID                   |        |           |
| User             | Correct user email           |        |           |
| User Role        | Correct role                 |        |           |
| IP Address       | Present (if captured)        |        |           |
| Changes (before) | Previous values              |        |           |
| Changes (after)  | New values                   |        |           |

---

## Test 8: Audit Trail Immutability

**Role: Owner**

| Check                                       | Method                           | Result | Pass/Fail |
| ------------------------------------------- | -------------------------------- | ------ | --------- |
| No edit option on audit entries             | UI inspection                    |        |           |
| No delete option on audit entries           | UI inspection                    |        |           |
| Audit entries persist after source deletion | Delete test booking, check audit |        |           |

---

## Completeness Checklist

| Category            | Actions That Should Be Logged          | All Logged? |
| ------------------- | -------------------------------------- | ----------- |
| **Bookings**        | Create, Update, Delete, Status Change  | [ ]         |
| **Payments**        | Create, Verify, Reject, Refund         | [ ]         |
| **Units**           | Create, Update, Delete, Pricing Change | [ ]         |
| **Guests**          | Create, Update, Delete                 | [ ]         |
| **Expenses**        | Create, Update, Delete                 | [ ]         |
| **Authentication**  | Login, Logout, Failed Login            | [ ]         |
| **Settings**        | Any settings changes                   | [ ]         |
| **User Management** | Role changes, User creation            | [ ]         |

---

## Data Quality Checks

| Quality Aspect            | Requirement                | Verified | Pass/Fail |
| ------------------------- | -------------------------- | -------- | --------- |
| Timestamps                | UTC or consistent timezone |          |           |
| User attribution          | Never "unknown" or blank   |          |           |
| Entity references         | Valid IDs that resolve     |          |           |
| Change details            | Sufficient for rollback    |          |           |
| No sensitive data exposed | Passwords not logged       |          |           |

## Expected Results

- All significant actions create audit entries
- Entries contain accurate timestamps
- User attribution is always present and correct
- Before/after values are captured for updates
- Audit logs cannot be modified or deleted
- Filtering and search work correctly
- Entries persist even when source data is deleted

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Start Time: _______________
Test End Time: _______________

Missing Audit Entries:
_________________________________
_________________________________

Incorrect/Incomplete Entries:
_________________________________
_________________________________

Audit Viewer Issues:
_________________________________
_________________________________
```
