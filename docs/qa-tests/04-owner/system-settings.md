# QA Test: Owner System Settings

| Field              | Value      |
| ------------------ | ---------- |
| **Test ID**        | OWN-004    |
| **Priority**       | High       |
| **Role Required**  | Owner      |
| **Estimated Time** | 10 minutes |

## Objective

Verify that owners can access and modify system-wide settings, including resort configuration, pricing defaults, and operational parameters.

## Prerequisites

- [ ] Logged in as owner (owner@okaeri.ph)
- [ ] Settings section is accessible
- [ ] Note current settings before making changes (for restoration)

## Test Steps

### Step 1: Access System Settings

| Action                             | Expected Result                 | Pass/Fail |
| ---------------------------------- | ------------------------------- | --------- |
| Navigate to Settings               | Settings page loads             |           |
| Verify settings categories visible | Multiple setting sections shown |           |
| Verify edit permissions            | Edit buttons/forms are enabled  |           |

### Step 2: Resort Information Settings

| Action                            | Expected Result        | Pass/Fail |
| --------------------------------- | ---------------------- | --------- |
| View Resort Name setting          | Current name displayed |           |
| Edit Resort Name                  | Field becomes editable |           |
| Change name to "Test Resort Name" | Input accepted         |           |
| Save changes                      | Success message shown  |           |
| Refresh page                      | Changed name persists  |           |
| Restore original name             | Name restored          |           |

### Step 3: Contact Information

| Action                     | Expected Result            | Pass/Fail |
| -------------------------- | -------------------------- | --------- |
| View contact email         | Current email displayed    |           |
| View contact phone         | Current phone displayed    |           |
| Edit contact email         | Field editable             |           |
| Enter invalid email format | Validation error shown     |           |
| Enter valid email          | Input accepted             |           |
| Edit contact phone         | Field editable             |           |
| Save changes               | Changes saved successfully |           |

### Step 4: Booking Settings

| Action                       | Expected Result                  | Pass/Fail |
| ---------------------------- | -------------------------------- | --------- |
| View minimum booking advance | Days shown (e.g., 1 day)         |           |
| View maximum booking advance | Days shown (e.g., 365 days)      |           |
| View check-in time           | Time displayed (e.g., 14:00)     |           |
| View check-out time          | Time displayed (e.g., 11:00)     |           |
| Modify check-in time         | Setting updates                  |           |
| Modify check-out time        | Setting updates                  |           |
| Save and verify              | New times shown in booking forms |           |

### Step 5: Payment Settings

| Action                            | Expected Result              | Pass/Fail |
| --------------------------------- | ---------------------------- | --------- |
| View payment methods enabled      | GCash, Bank Transfer visible |           |
| Toggle payment method off         | Method disabled              |           |
| Toggle payment method on          | Method re-enabled            |           |
| View partial payment percentage   | Current minimum shown        |           |
| Modify minimum deposit percentage | Setting updates              |           |
| Save changes                      | Payment settings saved       |           |

### Step 6: Notification Settings

| Action                              | Expected Result        | Pass/Fail |
| ----------------------------------- | ---------------------- | --------- |
| View email notification settings    | Current settings shown |           |
| Toggle "Booking Confirmation Email" | Setting toggles        |           |
| Toggle "Payment Received Email"     | Setting toggles        |           |
| Toggle "Check-in Reminder"          | Setting toggles        |           |
| Save notification preferences       | Settings saved         |           |

### Step 7: Unit Default Settings

| Action                    | Expected Result                | Pass/Fail |
| ------------------------- | ------------------------------ | --------- |
| View default base price   | Current default shown          |           |
| View default capacity     | Current default shown          |           |
| Modify default base price | Setting updates                |           |
| Save changes              | Defaults saved                 |           |
| Create new unit           | New unit uses updated defaults |           |

### Step 8: Security Settings

| Action                       | Expected Result             | Pass/Fail |
| ---------------------------- | --------------------------- | --------- |
| View session timeout setting | Current timeout shown       |           |
| View password policy         | Policy rules displayed      |           |
| Modify session timeout       | Setting updates             |           |
| Save security settings       | Settings saved successfully |           |

## Settings Validation

| Setting                 | Invalid Value | Expected Behavior         | Pass/Fail |
| ----------------------- | ------------- | ------------------------- | --------- |
| Minimum booking advance | -1 days       | Error or reject           |           |
| Maximum booking advance | 0 days        | Error or reject           |           |
| Check-in time           | 25:00         | Invalid time error        |           |
| Minimum deposit         | 150%          | Error or cap at 100%      |           |
| Session timeout         | 0 minutes     | Error or minimum enforced |           |

## Recovery Test

After testing, restore original settings:

| Setting         | Original Value     | Restored | Pass/Fail |
| --------------- | ------------------ | -------- | --------- |
| Resort Name     | ******\_\_\_****** |          |           |
| Check-in Time   | ******\_\_\_****** |          |           |
| Check-out Time  | ******\_\_\_****** |          |           |
| Minimum Deposit | ******\_\_\_****** |          |           |

## Expected Results

- Owner can access all system settings
- Settings changes are persisted
- Validation prevents invalid configurations
- Changes affect system behavior appropriately
- Non-owners cannot access these settings

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Original Settings Documented: [ ] Yes [ ] No
All Settings Restored: [ ] Yes [ ] No

Issues Found:
_________________________________
_________________________________
```
