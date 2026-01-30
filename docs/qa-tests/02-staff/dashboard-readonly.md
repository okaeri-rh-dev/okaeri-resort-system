# Dashboard Read-Only Tests (Staff)

**Role**: Staff
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Logged in as Staff user (`jasonacido+staff@gmail.com`)
- [ ] Some existing bookings and payments for dashboard data
- [ ] Browser DevTools console open for error checking

---

### TC-STAFF-DASH-001: Access Dashboard

**Goal**: Verify staff can access the main dashboard

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Navigate to `/admin` or `/admin/dashboard`
2. Verify the page loads without console errors
3. Check that dashboard content is visible
4. Verify key dashboard sections are present:
   - Welcome message / user info
   - Quick stats or KPIs
   - Recent activity (if applicable)
   - Navigation menu
5. Verify staff-appropriate content is shown
6. Check that admin-only sections are hidden

**Expected Results**:

- [ ] Dashboard loads without errors
- [ ] Staff-appropriate content visible
- [ ] No admin-only sections visible
- [ ] Navigation works correctly

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-002: View Quick Stats/KPIs

**Goal**: Verify staff can see dashboard statistics

**Preconditions**:

- On the dashboard page
- Some bookings and payments exist

**Steps**:

1. Locate the quick stats/KPI section
2. Check for the following metrics (if implemented):
   - Today's check-ins
   - Today's check-outs
   - Pending bookings
   - Occupancy rate
   - Recent payments
3. Verify numbers appear reasonable
4. Click on a stat card (if interactive)
5. Verify navigation to relevant list
6. Check for loading states on stat cards
7. Verify error handling if data fails to load

**Expected Results**:

- [ ] Stats/KPIs are visible
- [ ] Numbers are reasonable and not zeros (if data exists)
- [ ] Interactive elements work
- [ ] Loading states present

**Result**: [ ] Pass [ ] Fail

**Stats Visible**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-003: View Today's Schedule

**Goal**: Verify staff can see today's check-ins and check-outs

**Preconditions**:

- On the dashboard page
- Bookings exist for today (or create one for testing)

**Steps**:

1. Locate today's schedule section (check-ins/check-outs)
2. Verify check-ins list shows:
   - Guest name
   - Unit
   - Expected arrival time (if captured)
3. Verify check-outs list shows:
   - Guest name
   - Unit
   - Expected departure time (if captured)
4. If no bookings today, verify "No check-ins/outs" message
5. Click on a booking in the list
6. Verify it links to booking details
7. Check that list refreshes or updates

**Expected Results**:

- [ ] Today's check-ins displayed
- [ ] Today's check-outs displayed
- [ ] Links to booking details work
- [ ] Empty state handled gracefully

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-004: View Occupancy Calendar

**Goal**: Verify staff can see the occupancy calendar/overview

**Preconditions**:

- On the dashboard page

**Steps**:

1. Navigate to `/admin/availability` (if separate from dashboard)
2. Or locate occupancy view on dashboard
3. Verify calendar shows unit availability
4. Check that:
   - Units are listed
   - Booked dates are highlighted/colored
   - Available dates are distinguishable
5. Navigate between weeks/months
6. Verify data updates correctly
7. Click on a booked date
8. Verify it links to booking details
9. Verify staff cannot make changes (view-only)

**Expected Results**:

- [ ] Occupancy calendar is visible
- [ ] Shows accurate booking data
- [ ] Navigation works
- [ ] Staff view is read-only

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-005: Navigation Menu Access

**Goal**: Verify staff has access to appropriate navigation items

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Locate the main navigation menu
2. Verify the following items ARE visible:
   - Dashboard
   - Bookings
   - Payments
   - Availability Calendar
3. Verify the following items are NOT visible (admin only):
   - Units Management
   - Pricing Configuration
   - Role Management
   - System Settings
   - Audit Logs
4. Click each visible navigation item
5. Verify navigation works correctly
6. Check for any 403 errors on navigated pages

**Expected Results**:

- [ ] Staff-appropriate nav items visible
- [ ] Admin-only items are hidden
- [ ] All visible links work
- [ ] No unauthorized access to hidden areas

**Result**: [ ] Pass [ ] Fail

**Hidden Items Verified**: ******\_\_\_******

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-006: Recent Activity Feed

**Goal**: Verify staff can view recent activity (if implemented)

**Preconditions**:

- On the dashboard page

**Steps**:

1. Locate the recent activity section (if implemented)
2. Check for recent events:
   - New bookings created
   - Payments received
   - Status changes
3. Verify activity shows:
   - Event type
   - Brief description
   - Timestamp
4. Click on an activity item
5. Verify navigation to relevant detail
6. Check pagination or "load more" (if many items)
7. If not implemented, document as N/A

**Expected Results**:

- [ ] Activity feed shows recent events
- [ ] Events are properly described
- [ ] Links to details work
- [ ] Timestamps are accurate

**Result**: [ ] Pass [ ] Fail [ ] N/A (not implemented)

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-007: Dashboard Refresh

**Goal**: Verify dashboard data refreshes appropriately

**Preconditions**:

- On the dashboard page
- Ability to create data in another window

**Steps**:

1. Note the current dashboard data
2. Open a new tab and log in as Admin
3. Create a new booking (or payment)
4. Return to staff dashboard tab
5. Refresh the page
6. Verify new data appears on dashboard
7. Check for auto-refresh (if implemented)
8. Note the refresh interval (if auto-refresh)
9. Check for manual refresh button (if available)

**Expected Results**:

- [ ] Data updates after page refresh
- [ ] Auto-refresh works (if implemented)
- [ ] Manual refresh available (if implemented)
- [ ] No stale data displayed

**Result**: [ ] Pass [ ] Fail

**Refresh Interval**: \_\_\_ seconds (or manual only)

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-008: Dashboard Loading States

**Goal**: Verify proper loading states on dashboard

**Preconditions**:

- Ability to simulate slow network

**Steps**:

1. Open DevTools Network tab
2. Set network throttling to "Slow 3G"
3. Refresh the dashboard
4. Observe loading states:
   - Skeleton loaders or spinners
   - Loading text indicators
5. Verify content appears progressively
6. Check that no broken states occur
7. Remove throttling
8. Verify dashboard loads normally
9. Test offline mode briefly
10. Verify appropriate error handling

**Expected Results**:

- [ ] Loading indicators appear
- [ ] Progressive loading works
- [ ] No broken/empty states
- [ ] Graceful offline handling

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-009: Dashboard Mobile Responsiveness

**Goal**: Verify dashboard works on mobile viewport

**Preconditions**:

- On the dashboard page

**Steps**:

1. Open DevTools and set viewport to 375x667 (mobile)
2. Verify dashboard layout adapts
3. Check that navigation is accessible (hamburger menu?)
4. Verify all stat cards are visible
5. Check that calendar/schedule is usable
6. Navigate to other pages via mobile nav
7. Test at 768x1024 (tablet)
8. Verify responsive breakpoints
9. Check for any horizontal scrolling
10. Ensure touch interactions work

**Expected Results**:

- [ ] Dashboard is usable on mobile
- [ ] Navigation is accessible
- [ ] Content is readable
- [ ] No excessive horizontal scrolling

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-STAFF-DASH-010: User Profile/Account Access

**Goal**: Verify staff can access their own profile settings

**Preconditions**:

- Logged in as Staff

**Steps**:

1. Locate user menu (usually top right)
2. Click on user name/avatar
3. Look for "Profile" or "Account" option
4. If profile exists:
   - Verify staff can view their info
   - Check what can be edited (name, password)
   - Verify email change restrictions
5. If profile doesn't exist:
   - Document as not implemented
6. Look for "Change Password" option
7. Verify staff can change their own password
8. Check logout option is present

**Expected Results**:

- [ ] Profile is accessible (if implemented)
- [ ] Can change own password
- [ ] Cannot change own role
- [ ] Logout is accessible

**Result**: [ ] Pass [ ] Fail [ ] N/A (profile not implemented)

**Notes/Issues Found**:

---

---

## Summary

| Test Case         | Description                     | Result |
| ----------------- | ------------------------------- | ------ |
| TC-STAFF-DASH-001 | Access Dashboard                |        |
| TC-STAFF-DASH-002 | View Quick Stats/KPIs           |        |
| TC-STAFF-DASH-003 | View Today's Schedule           |        |
| TC-STAFF-DASH-004 | View Occupancy Calendar         |        |
| TC-STAFF-DASH-005 | Navigation Menu Access          |        |
| TC-STAFF-DASH-006 | Recent Activity Feed            |        |
| TC-STAFF-DASH-007 | Dashboard Refresh               |        |
| TC-STAFF-DASH-008 | Dashboard Loading States        |        |
| TC-STAFF-DASH-009 | Dashboard Mobile Responsiveness |        |
| TC-STAFF-DASH-010 | User Profile/Account Access     |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
