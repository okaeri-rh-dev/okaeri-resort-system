# Pricing Configuration Tests (Admin - Full Access)

**Role**: Admin
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`)
- [ ] At least 2 units configured in the system
- [ ] Browser DevTools console open for error checking

---

### TC-ADMIN-PRICE-001: Access Pricing Configuration

**Goal**: Verify admin can access pricing configuration page

**Preconditions**:

- Logged in as Admin

**Steps**:

1. Navigate to `/admin/units/pricing`
2. Verify the page loads without console errors
3. Check that pricing interface is visible
4. Verify the following sections (if implemented):
   - Base pricing per unit
   - Seasonal pricing
   - Special rates
   - Discounts
5. Verify units are listed with their current prices
6. Check for "Edit" or "Configure" controls

**Expected Results**:

- [ ] Page loads without errors
- [ ] Pricing interface visible
- [ ] Current prices displayed
- [ ] Edit controls available

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-002: Update Base Pricing

**Goal**: Verify admin can update unit base prices

**Preconditions**:

- On the pricing configuration page

**Steps**:

1. Locate a unit's base price
2. Click "Edit" or price field
3. Change the base price:
   - Original: note current price
   - New: increase by 500
4. Save the change
5. Verify success message
6. Verify new price displayed
7. Create a test booking for this unit
8. Verify booking uses new price
9. Restore original price (cleanup)
10. Verify restoration successful

**Expected Results**:

- [ ] Can edit base price
- [ ] Change is saved
- [ ] New bookings use new price
- [ ] Price changes take effect immediately

**Result**: [ ] Pass [ ] Fail

**Original Price**: **_ | New Price: _**

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-003: Pricing Validation

**Goal**: Verify pricing validation rules

**Preconditions**:

- On the pricing configuration page

**Steps**:

1. Try to set price to 0
2. Verify validation error or warning
3. Try to set negative price
4. Verify validation prevents negative
5. Try to set extremely high price
6. Verify warning or acceptance
7. Try to enter non-numeric value
8. Verify input validation
9. Try to leave price empty
10. Verify required field validation
11. Enter decimal value (e.g., 1500.50)
12. Verify decimal handling

**Expected Results**:

- [ ] Zero price handled (error or allowed)
- [ ] Negative prices prevented
- [ ] Non-numeric input rejected
- [ ] Empty price prevented
- [ ] Decimal prices handled correctly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-004: Seasonal Pricing Setup

**Goal**: Verify admin can configure seasonal pricing

**Preconditions**:

- Seasonal pricing feature available

**Steps**:

1. Navigate to pricing configuration
2. Look for "Seasonal Pricing" or "Special Rates" section
3. If available:
   - Click "Add Seasonal Rate"
   - Enter season name: "QA Peak Season"
   - Set date range (e.g., Dec 15 - Jan 15)
   - Set rate adjustment (e.g., +20% or fixed 4500)
   - Select affected units
   - Save configuration
   - Verify seasonal rate appears in list
   - Test booking during seasonal period
   - Verify adjusted price applied
4. If not available:
   - Document as N/A

**Expected Results**:

- [ ] Can create seasonal rate
- [ ] Date range configurable
- [ ] Affected units selectable
- [ ] Seasonal pricing applies to bookings

**Result**: [ ] Pass [ ] Fail [ ] N/A (seasonal pricing not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-005: Weekend/Weekday Pricing

**Goal**: Verify weekend/weekday differential pricing

**Preconditions**:

- Weekend pricing feature available

**Steps**:

1. Navigate to pricing configuration
2. Look for "Weekend Pricing" option
3. If available:
   - Enable weekend pricing
   - Set weekend rate (e.g., weekday: 3000, weekend: 3500)
   - Define weekend days (Fri-Sat or Sat-Sun)
   - Save configuration
   - Create booking spanning weekday and weekend
   - Verify mixed pricing calculated correctly
   - Verify booking shows breakdown
4. If not available:
   - Document as N/A

**Expected Results**:

- [ ] Can configure weekend rates
- [ ] Weekend days definable
- [ ] Mixed bookings calculated correctly
- [ ] Price breakdown visible

**Result**: [ ] Pass [ ] Fail [ ] N/A (weekend pricing not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-006: Discount Configuration

**Goal**: Verify admin can configure discounts

**Preconditions**:

- Discount feature available

**Steps**:

1. Navigate to pricing configuration
2. Look for "Discounts" section
3. If available:
   - Add length-of-stay discount:
     - 7+ nights: 10% off
     - 14+ nights: 15% off
   - Add early bird discount (if available)
   - Add promo code (if available):
     - Code: "QATESTNOW"
     - Discount: 500 off or 5%
   - Save configurations
   - Test booking with 7 nights
   - Verify discount applied
   - Test promo code
   - Verify code discount applied
4. If not available:
   - Document as N/A

**Expected Results**:

- [ ] Can configure discounts
- [ ] Length discounts work
- [ ] Promo codes work (if implemented)
- [ ] Discounts shown on bookings

**Result**: [ ] Pass [ ] Fail [ ] N/A (discounts not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-007: Extra Person Charges

**Goal**: Verify extra person pricing configuration

**Preconditions**:

- Extra person charges feature available

**Steps**:

1. Navigate to pricing configuration
2. Look for "Extra Person" or "Additional Guest" charges
3. If available:
   - Set included guests per unit (e.g., 2)
   - Set extra person charge (e.g., 300/night)
   - Save configuration
   - Create booking with 4 guests
   - Verify extra person charge (2 × 300 × nights)
   - Verify total includes extra charges
4. If not available:
   - Document as N/A
5. Check public booking form shows charges

**Expected Results**:

- [ ] Can set included guest count
- [ ] Can set extra person rate
- [ ] Extra charges calculated correctly
- [ ] Charges visible to guests

**Result**: [ ] Pass [ ] Fail [ ] N/A (extra person not implemented)

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-008: Price Per Unit Type

**Goal**: Verify different unit types can have different pricing

**Preconditions**:

- Multiple unit types exist

**Steps**:

1. Navigate to pricing configuration
2. View pricing for different unit types:
   - Standard cabin
   - Deluxe cabin
   - Family cabin (if exists)
3. Verify each type has independent pricing
4. Modify price for one type only
5. Verify other types unchanged
6. Create booking for each type
7. Verify correct prices applied
8. Verify public site shows correct prices

**Expected Results**:

- [ ] Each unit type has own pricing
- [ ] Prices are independent
- [ ] Correct prices on bookings
- [ ] Public display accurate

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-009: Price Change History

**Goal**: Verify price change history is tracked

**Preconditions**:

- Made some price changes

**Steps**:

1. Navigate to pricing configuration
2. Look for "History" or "Changes" section
3. If available:
   - Verify recent changes logged
   - Check details include:
     - Date/time of change
     - Old price
     - New price
     - Who made change
   - Make a new price change
   - Verify it appears in history
4. If not available:
   - Check audit logs for price changes
5. Document price tracking mechanism

**Expected Results**:

- [ ] Price changes tracked
- [ ] History shows old/new values
- [ ] Actor recorded
- [ ] Timestamps accurate

**Result**: [ ] Pass [ ] Fail [ ] N/A (no price history)

**Notes/Issues Found**:

---

---

### TC-ADMIN-PRICE-010: Pricing Impact on Existing Bookings

**Goal**: Verify price changes don't affect existing bookings

**Preconditions**:

- An existing confirmed booking

**Steps**:

1. Find a confirmed booking
2. Note the booking's total price
3. Navigate to pricing configuration
4. Change the unit's price significantly
5. Save the new price
6. Return to the confirmed booking
7. Verify the booking STILL has original price
8. Create a NEW booking for same unit
9. Verify new booking uses NEW price
10. Document if existing bookings are updated or locked

**Expected Results**:

- [ ] Existing bookings keep original price
- [ ] New bookings use new price
- [ ] No unexpected price changes to confirmed bookings
- [ ] Clear separation of old/new pricing

**Result**: [ ] Pass [ ] Fail

**Behavior**: [ ] Existing bookings locked [ ] Existing bookings update (unexpected)

**Notes/Issues Found**:

---

---

## Summary

| Test Case          | Description                         | Result |
| ------------------ | ----------------------------------- | ------ |
| TC-ADMIN-PRICE-001 | Access Pricing Configuration        |        |
| TC-ADMIN-PRICE-002 | Update Base Pricing                 |        |
| TC-ADMIN-PRICE-003 | Pricing Validation                  |        |
| TC-ADMIN-PRICE-004 | Seasonal Pricing Setup              |        |
| TC-ADMIN-PRICE-005 | Weekend/Weekday Pricing             |        |
| TC-ADMIN-PRICE-006 | Discount Configuration              |        |
| TC-ADMIN-PRICE-007 | Extra Person Charges                |        |
| TC-ADMIN-PRICE-008 | Price Per Unit Type                 |        |
| TC-ADMIN-PRICE-009 | Price Change History                |        |
| TC-ADMIN-PRICE-010 | Pricing Impact on Existing Bookings |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
