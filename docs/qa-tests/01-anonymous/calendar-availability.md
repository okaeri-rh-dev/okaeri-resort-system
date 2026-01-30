# Calendar Availability Tests

**Role**: Anonymous (Not Logged In)
**Last Updated**: 2025-01-30
**Tester**: ******\_\_\_******

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Browser in incognito/private mode
- [ ] At least one unit configured in the system
- [ ] Some existing bookings to test availability display
- [ ] Browser DevTools console open for error checking

---

### TC-CAL-001: View Public Availability Calendar

**Goal**: Verify anonymous users can view the availability calendar on home page

**Preconditions**:

- Not logged in

**Steps**:

1. Navigate to `/` (home page)
2. Verify the page loads without console errors
3. Look for availability calendar or unit availability display
4. Verify the calendar shows the current month
5. Check that units are listed with their availability
6. Verify calendar navigation (previous/next month) works
7. Check that the UI clearly indicates available vs booked dates
8. Verify no admin-only information is displayed

**Expected Results**:

- [ ] Page loads without console errors
- [ ] Availability calendar/view is visible
- [ ] Current month is displayed by default
- [ ] Available dates are clearly distinguishable from booked dates
- [ ] No sensitive admin data visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-002: Navigate Calendar Months

**Goal**: Verify calendar navigation works correctly

**Preconditions**:

- On the home page with calendar visible

**Steps**:

1. Navigate to `/` (home page)
2. Locate the calendar navigation controls
3. Click "Next Month" or forward arrow
4. Verify the next month is displayed
5. Check that availability data updates for new month
6. Navigate forward 3 more months
7. Click "Previous Month" or back arrow
8. Verify navigation backwards works
9. Navigate back to the current month
10. Verify current month displays correctly
11. Check for any console errors during navigation

**Expected Results**:

- [ ] Forward navigation works correctly
- [ ] Backward navigation works correctly
- [ ] Availability data updates for each month
- [ ] No errors during navigation
- [ ] Current month is easily accessible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-003: Availability Display Accuracy

**Goal**: Verify calendar accurately reflects booking availability

**Preconditions**:

- Know of dates with existing bookings
- Have access to admin view for comparison (optional)

**Steps**:

1. Navigate to `/` (home page)
2. Find a date range that has an existing booking
3. Verify those dates show as unavailable/booked on calendar
4. Find a date range with no bookings
5. Verify those dates show as available
6. If admin access available, create a new booking
7. Refresh the public calendar
8. Verify the newly booked dates now show as unavailable
9. Check multiple units if displayed separately
10. Verify accuracy for each unit's availability

**Expected Results**:

- [ ] Booked dates display as unavailable
- [ ] Available dates display as available
- [ ] Calendar updates when bookings change
- [ ] Each unit's availability is accurate

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-004: Unit Filter/Selection

**Goal**: Verify users can filter availability by specific units

**Preconditions**:

- Multiple units exist in the system

**Steps**:

1. Navigate to `/` (home page)
2. Look for unit filter or selection options
3. If unit filter exists:
   - Select "All Units" - verify all availability shown
   - Select a specific unit
   - Verify calendar shows only that unit's availability
   - Select a different unit
   - Verify calendar updates accordingly
4. If no filter exists:
   - Verify all units are shown together
   - Check that unit names are clearly labeled
5. Document the filtering mechanism used

**Expected Results**:

- [ ] Can view availability for all units or specific units
- [ ] Filter/selection is easy to use
- [ ] Calendar updates correctly when filter changes
- [ ] Unit identification is clear

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-005: Date Range Selection

**Goal**: Verify users can select date ranges on the calendar

**Preconditions**:

- On the home page with calendar visible

**Steps**:

1. Navigate to `/` (home page)
2. Click on an available date (as check-in)
3. Verify date is highlighted or selected
4. Click on a second date (as check-out)
5. Verify date range is highlighted
6. Check if availability summary shows for selected range
7. Look for "Book Now" or link to booking form
8. Click to proceed with booking
9. Verify dates carry over to booking form
10. Test selecting an invalid range (check-out before check-in)
11. Verify appropriate feedback

**Expected Results**:

- [ ] Can select check-in date
- [ ] Can select check-out date
- [ ] Date range is visually highlighted
- [ ] Can proceed to booking with selected dates
- [ ] Invalid selections are handled

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-006: Calendar Mobile Responsiveness

**Goal**: Verify calendar works correctly on mobile devices

**Preconditions**:

- On the home page

**Steps**:

1. Navigate to `/` (home page)
2. Open DevTools and set viewport to 375x667 (mobile)
3. Verify calendar is visible and usable
4. Check that date cells are tap-friendly (adequate size)
5. Navigate between months using touch
6. Try to select a date range
7. Verify all information is readable
8. Check for horizontal scrolling (should be minimal)
9. Test at 768x1024 (tablet) viewport
10. Verify responsive breakpoints work correctly

**Expected Results**:

- [ ] Calendar is usable on mobile viewport
- [ ] Date cells are tap-friendly
- [ ] Navigation works with touch
- [ ] No excessive horizontal scrolling
- [ ] All information remains readable

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-007: Calendar Performance

**Goal**: Verify calendar loads and performs acceptably

**Preconditions**:

- DevTools Performance tab available

**Steps**:

1. Open DevTools Performance tab
2. Start recording
3. Navigate to `/` (home page)
4. Wait for calendar to fully load
5. Stop recording and analyze:
   - Time to first calendar render
   - Time to availability data load
6. Navigate between months 5 times
7. Check for any noticeable lag
8. Test with throttled network (Fast 3G)
9. Verify calendar still loads within acceptable time
10. Check for loading indicators during data fetch

**Expected Results**:

- [ ] Initial load completes in < 3 seconds
- [ ] Month navigation is responsive (< 1 second)
- [ ] Loading indicators shown during data fetch
- [ ] Acceptable performance on slow networks

**Result**: [ ] Pass [ ] Fail

**Performance Metrics**:

- Initial load: \_\_\_ seconds
- Month navigation: \_\_\_ seconds

**Notes/Issues Found**:

---

---

### TC-CAL-008: Past Dates Handling

**Goal**: Verify past dates are handled appropriately

**Preconditions**:

- On the home page with calendar

**Steps**:

1. Navigate to `/` (home page)
2. Navigate to the previous month (in the past)
3. Check how past dates are displayed
4. Verify past dates are either:
   - Not shown
   - Shown but clearly marked as past/unavailable
   - Not selectable for booking
5. Try to click/select a past date
6. Verify no booking can start in the past
7. Navigate to current month
8. Verify today's date handling
9. Check if same-day booking is allowed or prevented

**Expected Results**:

- [ ] Past dates cannot be booked
- [ ] Past dates are visually distinct
- [ ] Navigation to past months handled gracefully
- [ ] Today's date handling is appropriate

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-CAL-009: Future Date Limits

**Goal**: Verify there are appropriate limits on future bookings

**Preconditions**:

- On the home page with calendar

**Steps**:

1. Navigate to `/` (home page)
2. Navigate forward in the calendar 6 months
3. Check if availability data is shown
4. Continue navigating forward to 12 months
5. Check for any maximum advance booking limit
6. If limit exists, verify clear messaging
7. Document the maximum booking window
8. Navigate to the furthest available month
9. Try to select dates
10. Verify booking proceeds or appropriate limit message

**Expected Results**:

- [ ] Future navigation works to a reasonable limit
- [ ] Availability data is available for bookable range
- [ ] Maximum booking window is clearly communicated (if exists)
- [ ] Cannot book beyond allowed window

**Result**: [ ] Pass [ ] Fail

**Maximum Booking Window**: \_\_\_ months ahead

**Notes/Issues Found**:

---

---

### TC-CAL-010: Real-time Availability Updates

**Goal**: Verify calendar reflects real-time availability changes

**Preconditions**:

- Two browser windows available
- Admin credentials for one window

**Steps**:

1. Open Window 1: Navigate to `/` (home page) as anonymous
2. Note availability for a specific date range
3. Open Window 2: Log in as staff/admin
4. Create a new booking for the noted date range
5. Return to Window 1 (anonymous calendar)
6. Refresh the page
7. Verify the newly booked dates now show as unavailable
8. If real-time updates are implemented:
   - Create another booking in Window 2
   - Watch Window 1 without refreshing
   - Check if calendar updates automatically
9. Document the refresh requirement

**Expected Results**:

- [ ] Calendar reflects booking changes after refresh
- [ ] Newly created bookings show as unavailable
- [ ] Real-time updates work (if implemented)
- [ ] No stale availability data displayed

**Result**: [ ] Pass [ ] Fail

**Real-time Updates**: [ ] Yes, automatic [ ] No, requires refresh

**Notes/Issues Found**:

---

---

## Summary

| Test Case  | Description                       | Result |
| ---------- | --------------------------------- | ------ |
| TC-CAL-001 | View Public Availability Calendar |        |
| TC-CAL-002 | Navigate Calendar Months          |        |
| TC-CAL-003 | Availability Display Accuracy     |        |
| TC-CAL-004 | Unit Filter/Selection             |        |
| TC-CAL-005 | Date Range Selection              |        |
| TC-CAL-006 | Calendar Mobile Responsiveness    |        |
| TC-CAL-007 | Calendar Performance              |        |
| TC-CAL-008 | Past Dates Handling               |        |
| TC-CAL-009 | Future Date Limits                |        |
| TC-CAL-010 | Real-time Availability Updates    |        |

**Total Passed**: **_ / 10
**Total Failed**: _** / 10

**Overall Notes**:

---

---
