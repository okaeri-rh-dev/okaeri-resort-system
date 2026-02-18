# Payment Methods Settings Tests (Admin)

**Role**: Admin / Manager+
**Last Updated**: 2026-02-18
**Tester**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Admin user (`jasonacido+admin@gmail.com`) or Manager
- [ ] Browser DevTools console open for error checking
- [ ] At least one payment method already exists (seed data or previously created)

---

### TC-ADMIN-SET-001: Access Settings Page

**Goal**: Verify manager+ roles can access `/admin/settings` and staff cannot

**Steps**:

1. Log in as Admin or Manager
2. Navigate to `/admin/settings`
3. Verify page loads with heading "Settings" and subtitle "Manage resort system configuration"
4. Verify the "Payment Methods" tab is visible and selected by default
5. Verify the "Add Payment Method" button is visible
6. Log out and log in as a Staff user
7. Navigate to `/admin/settings` directly via URL

**Expected Results**:

- [ ] Settings page loads successfully for Admin/Manager
- [ ] "Payment Methods" tab is the default active tab
- [ ] "Add Payment Method" button displayed
- [ ] Staff user is redirected away (route guard `requireManager()` blocks access)
- [ ] No console errors for authorized users

---

### TC-ADMIN-SET-002: View Payment Methods Table

**Goal**: Verify the payment methods table displays data correctly with search, sort, and status badges

**Steps**:

1. Navigate to `/admin/settings`
2. Verify the table loads with columns: Payment Method, Type, Account Number, QR Code, Order, Status, Actions
3. Verify each row shows:
   - Icon + display name + provider name (subtitle)
   - Type badge (E-Wallet / Bank Transfer / Cash / Other)
   - Account number in monospace font (or "-" if empty)
   - QR code thumbnail (or "None" text)
   - Display order number
   - Status badge: green "Active" or gray "Inactive"
4. Verify inactive rows appear with reduced opacity (`opacity-50`)
5. Type a method name in the "Search payment methods..." input
6. Verify the table filters to matching rows
7. Clear the search input
8. Click the "Payment Method" column header to sort
9. Verify rows reorder alphabetically (toggle asc/desc)
10. Click the "Order" column header to sort
11. Verify rows reorder by display_order
12. Click the "Refresh" button
13. Verify data reloads (spinner or refetch)

**Expected Results**:

- [ ] All columns render correctly
- [ ] Type badges use correct variants (E-Wallet = secondary, Bank Transfer = default, Cash/Other = outline)
- [ ] Account numbers display in monospace font
- [ ] Inactive rows are visually dimmed
- [ ] Search filtering works in real time
- [ ] Column sorting toggles asc/desc
- [ ] Refresh button triggers data reload
- [ ] No console errors

---

### TC-ADMIN-SET-003: Add New Payment Method

**Goal**: Verify creating a new payment method via the dialog form

**Steps**:

1. Click "Add Payment Method" button
2. Verify dialog opens with title "Add Payment Method"
3. Verify description reads "Add a new payment method that guests can use for bookings."
4. **Validation check**: Click "Create Payment Method" without filling fields
5. Verify validation errors appear for required fields:
   - Method Type: "Please select a method type"
   - Provider Name: "Provider name is required"
   - Display Name: "Display name is required"
6. Fill in the form:
   - Method Type: select "E-Wallet (GCash, Maya)"
   - Provider Name: "GCash"
   - Display Name: "GCash"
   - Account Name: "QA Test Account"
   - Account Number: "0917-000-1234"
   - Icon: select "Phone (E-Wallet)"
   - Icon Color: select "Blue"
   - Display Order: enter `10`
   - Instructions: "Send to this GCash number"
   - Active toggle: ensure ON
7. Verify "Bank Name" field is NOT visible (only shows for bank-transfer type)
8. Click "Create Payment Method"
9. Verify button text changes to "Creating..." while loading
10. Verify dialog closes on success
11. Verify new method appears in the table

**Expected Results**:

- [ ] Dialog opens with correct title/description
- [ ] Validation errors shown for empty required fields
- [ ] All form fields accept input correctly
- [ ] Bank Name field hidden for non-bank-transfer types
- [ ] Loading state shown during submission
- [ ] Dialog closes on success
- [ ] New method visible in table with correct data
- [ ] No console errors

---

### TC-ADMIN-SET-004: Edit Existing Payment Method

**Goal**: Verify editing a payment method via the actions dropdown

**Steps**:

1. Locate an existing payment method row in the table
2. Click the "..." (more) button in the Actions column
3. Verify dropdown menu appears with "Actions" label, "Edit" item, and "Deactivate" (or "Reactivate") item
4. Click "Edit"
5. Verify dialog opens with title "Edit Payment Method"
6. Verify description reads "Update the payment method details below."
7. Verify all fields are prefilled with the existing method's data
8. Change the Display Name to "GCash - Updated"
9. Change Display Order to `5`
10. Click "Update Payment Method"
11. Verify button text changes to "Updating..." while loading
12. Verify dialog closes on success
13. Verify updated values appear in the table row

**Expected Results**:

- [ ] Actions dropdown opens correctly
- [ ] Edit option present in dropdown
- [ ] Dialog opens with prefilled values
- [ ] Changes save successfully
- [ ] Loading state shown during update
- [ ] Table reflects updated values
- [ ] No console errors

---

### TC-ADMIN-SET-005: QR Code Upload (Edit Mode Only)

**Goal**: Verify QR code upload, preview, and deletion in edit mode

**Preconditions**:

- Have a test image file (PNG or JPG) ready on your device

**Steps**:

1. Open an existing payment method for editing (Actions > Edit)
2. Scroll down to the "QR Code Image" section
3. Verify the section is visible (only available in edit mode)
4. **If no QR exists**: Click "Upload QR Code" button
5. Select an image file (PNG or JPG)
6. Verify the image preview appears immediately (optimistic preview via FileReader)
7. Verify the preview shows a 128x128 rounded image
8. Verify a small red delete (trash) button appears in the top-right corner of the preview
9. Click the delete button
10. Verify the QR preview disappears and the "Upload QR Code" button returns
11. Close the dialog
12. **Verify new method form**: Click "Add Payment Method"
13. Verify the QR Code Image section is NOT present in the add form

**Expected Results**:

- [ ] QR upload section only visible in edit mode
- [ ] File picker accepts image files
- [ ] Immediate preview after file selection
- [ ] Delete button removes the QR code
- [ ] Upload/delete states show loading indicators
- [ ] QR thumbnail visible in the table for methods with uploaded QR codes
- [ ] Add form does not show QR upload section
- [ ] No console errors

---

### TC-ADMIN-SET-006: Deactivate and Reactivate Payment Method

**Goal**: Verify soft-delete deactivation and reactivation via the actions dropdown

**Steps**:

1. Locate an active payment method (green "Active" badge)
2. Click the "..." (more) button
3. Verify "Deactivate" option is shown (with destructive/red styling)
4. Click "Deactivate"
5. Verify the row updates:
   - Status badge changes to gray "Inactive"
   - Row opacity becomes dimmed (`opacity-50`)
6. Click the "..." (more) button again on the same row
7. Verify "Reactivate" option is now shown (instead of "Deactivate")
8. Click "Reactivate"
9. Verify the row restores:
   - Status badge returns to green "Active"
   - Row opacity returns to full

**Expected Results**:

- [ ] Deactivate option shown for active methods (red/destructive style)
- [ ] Reactivate option shown for inactive methods
- [ ] Status badge updates correctly
- [ ] Row opacity changes to reflect status
- [ ] Actions are immediate (optimistic update)
- [ ] No console errors

---

### TC-ADMIN-SET-007: Guest-Facing Display Verification

**Goal**: Verify that the public booking page dynamically shows only active payment methods

**Preconditions**:

- At least one active and one inactive payment method configured

**Steps**:

1. Note which payment methods are active in `/admin/settings`
2. Open a new incognito/private browser window (unauthenticated)
3. Navigate to the guest booking page (`/booking`)
4. Proceed to the payment information step
5. Verify the payment methods section shows:
   - Only methods with "Active" status
   - Each method displays: icon, display name, account details
   - QR codes shown for methods that have them
   - Instructions text shown if configured
6. Return to the admin settings page
7. Deactivate one of the visible payment methods
8. Refresh the guest booking page
9. Verify the deactivated method is no longer shown
10. Reactivate the method in admin settings
11. Refresh the guest booking page
12. Verify the method reappears

**Expected Results**:

- [ ] Guest page shows only active payment methods
- [ ] Payment method details (name, account info, QR, instructions) render correctly
- [ ] Deactivated methods disappear from guest view after refresh
- [ ] Reactivated methods reappear after refresh
- [ ] No authentication required to view payment methods on guest page
- [ ] No console errors on guest page

---

## Error Handling

| Scenario                              | Expected Behavior                        | Pass/Fail |
| ------------------------------------- | ---------------------------------------- | --------- |
| API failure loading payment methods   | Error message with "Try Again" button    |           |
| Submit form with network disconnected | Error state, data not lost               |           |
| Upload oversized QR image             | Upload fails gracefully, preview reverts |           |
| Upload non-image file for QR          | File picker restricts to image/\* types  |           |
| Rapid deactivate/reactivate clicks    | No duplicate mutations, consistent state |           |

---

## Notes

```
Test Date: _______________
Tester: _______________
Environment: _______________

Test Payment Methods Created:
  - Name: _________________ (cleanup: deactivate or leave for future tests)

Issues Found:
_________________________________
_________________________________
```
