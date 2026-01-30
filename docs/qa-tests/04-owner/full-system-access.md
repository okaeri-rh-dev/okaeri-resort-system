# QA Test: Owner Full System Access

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-001    |
| **Priority**       | Critical   |
| **Role Required**  | Owner      |
| **Estimated Time** | 10 minutes |

## Objective

Verify that owners have unrestricted access to all system features and can perform all operations available to lower-privilege roles.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] System has existing data (bookings, payments, units)
- [ ] All features are accessible from the navigation

## Test Steps

### Step 1: Verify Navigation Access

| Action                 | Expected Result                               | Pass/Fail |
| ---------------------- | --------------------------------------------- | --------- |
| Navigate to Dashboard  | Dashboard loads with full metrics             |           |
| Navigate to Bookings   | Bookings page loads with all actions enabled  |           |
| Navigate to Payments   | Payments page loads with verification options |           |
| Navigate to Units      | Units page loads with management options      |           |
| Navigate to Guests     | Guests page loads with full management        |           |
| Navigate to Expenses   | Expenses page loads with all expense data     |           |
| Navigate to Audit Logs | Audit logs visible (owner-only feature)       |           |
| Navigate to Settings   | System settings accessible                    |           |

### Step 2: Verify All Admin Actions Available

| Action                            | Expected Result                 | Pass/Fail |
| --------------------------------- | ------------------------------- | --------- |
| Click "New Booking" button        | Booking form opens              |           |
| Attempt to edit existing booking  | Edit form opens                 |           |
| View payment verification options | Verify/Reject buttons visible   |           |
| Access unit pricing configuration | Pricing settings accessible     |           |
| View expense management           | Can create/edit/delete expenses |           |

### Step 3: Verify Owner-Exclusive Features

| Action                    | Expected Result                    | Pass/Fail |
| ------------------------- | ---------------------------------- | --------- |
| Access Financial Reports  | Revenue reports visible            |           |
| View System Settings      | Can modify system configuration    |           |
| Access User Management    | Can view/modify user roles         |           |
| View Complete Audit Trail | All audit logs visible, unfiltered |           |
| Access Export Functions   | Can export data to CSV/PDF         |           |

### Step 4: Verify Data Visibility

| Action                                 | Expected Result                  | Pass/Fail |
| -------------------------------------- | -------------------------------- | --------- |
| View all bookings regardless of status | Complete booking history visible |           |
| View all financial transactions        | Full payment history accessible  |           |
| View sensitive guest information       | Complete guest profiles visible  |           |
| Access deleted/archived records        | Can view soft-deleted data       |           |

## Expected Results

- Owner has access to ALL navigation items
- Owner can perform ALL CRUD operations
- Owner can access financial and audit data
- Owner can modify system settings
- No permission errors or restricted features

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________
Browser/Device: _______________

Additional observations:
_________________________________
_________________________________
```
