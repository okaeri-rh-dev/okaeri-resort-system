# Login & Authentication Tests

**Role**: Staff
**Last Updated**: 2025-01-30
**Tester**: **\*\***\_\_\_**\*\***

## Prerequisites

- [ ] Development server running (`npm run dev`) or production URL accessible
- [ ] Staff test account credentials ready (see `00-setup/test-credentials.md`)
- [ ] Fresh browser session (no cached login)
- [ ] Browser DevTools console open for error checking

---

### TC-AUTH-001: Access Login Page

**Goal**: Verify the login page is accessible and properly displayed

**Preconditions**:

- Not logged in

**Steps**:

1. Navigate to `/login`
2. Verify the page loads without console errors
3. Check that login form is visible with:
   - Email input field
   - Password input field
   - "Sign In" or "Login" button
4. Verify password field masks input
5. Check for "Forgot Password" link (if implemented)
6. Verify no sensitive information in page source
7. Check that page has proper title/branding

**Expected Results**:

- [ ] Login page loads without errors
- [ ] All form elements are visible
- [ ] Password input is masked
- [ ] Page is properly branded

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-002: Successful Staff Login

**Goal**: Verify staff user can successfully log in

**Preconditions**:

- On the `/login` page
- Have staff credentials ready

**Steps**:

1. Navigate to `/login`
2. Enter staff email: `jasonacido+staff@gmail.com`
3. Enter staff password: `<see password manager>`
4. Click "Sign In" button
5. Verify loading indicator appears
6. Wait for authentication to complete
7. Verify redirect to dashboard or admin area
8. Check that user name/email appears in the header/nav
9. Verify staff-appropriate navigation items are visible
10. Check console for any errors
11. Verify session is established (check DevTools Application tab)

**Expected Results**:

- [ ] Login succeeds without errors
- [ ] Redirects to appropriate page (dashboard)
- [ ] User info displayed in header
- [ ] Session/token is stored properly
- [ ] Staff-level navigation is visible

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-003: Invalid Credentials

**Goal**: Verify appropriate error handling for invalid login attempts

**Preconditions**:

- On the `/login` page

**Steps**:

1. Navigate to `/login`
2. Enter valid email with wrong password
3. Click "Sign In"
4. Verify error message appears
5. Check error message is generic (doesn't reveal if email exists)
6. Enter invalid/non-existent email
7. Click "Sign In"
8. Verify same generic error message
9. Verify form is clearable and resubmittable
10. Try SQL injection: `' OR '1'='1` in email field
11. Verify injection is handled safely
12. Check no sensitive info in network response

**Expected Results**:

- [ ] Generic error for invalid credentials
- [ ] Error doesn't reveal which field is wrong
- [ ] Form remains usable after failed attempt
- [ ] SQL injection is handled safely
- [ ] No sensitive data exposed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-004: Form Validation

**Goal**: Verify login form validation works correctly

**Preconditions**:

- On the `/login` page

**Steps**:

1. Navigate to `/login`
2. Click "Sign In" with empty fields
3. Verify validation errors for required fields
4. Enter invalid email format: "notanemail"
5. Verify email format validation error
6. Enter email with spaces: " test@email.com "
7. Check if spaces are trimmed
8. Enter very long email (>255 characters)
9. Verify appropriate handling
10. Enter password with only spaces
11. Verify validation catches empty password

**Expected Results**:

- [ ] Required field validation works
- [ ] Email format validation works
- [ ] Edge cases handled appropriately
- [ ] Clear validation messages displayed

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-005: Session Persistence

**Goal**: Verify login session persists across page refreshes and tabs

**Preconditions**:

- Logged in as staff user

**Steps**:

1. Log in as staff user
2. Verify you're on the dashboard
3. Refresh the page (F5 or Cmd+R)
4. Verify you remain logged in
5. Open a new tab in the same browser
6. Navigate to the admin area
7. Verify you're still logged in
8. Close all tabs
9. Open a new tab and navigate to the site
10. Verify session persistence (depends on "remember me" implementation)
11. Check DevTools for session storage mechanism

**Expected Results**:

- [ ] Session persists across page refresh
- [ ] Session shared across browser tabs
- [ ] Session behavior matches expected design
- [ ] No re-login required within session lifetime

**Result**: [ ] Pass [ ] Fail

**Session Duration**: **\*\***\_\_\_**\*\***

**Notes/Issues Found**:

---

---

### TC-AUTH-006: Logout Functionality

**Goal**: Verify staff user can successfully log out

**Preconditions**:

- Logged in as staff user

**Steps**:

1. While logged in, locate the logout button/link
2. Document where logout control is located
3. Click "Logout" or "Sign Out"
4. Verify redirect to login page or home page
5. Try to navigate back to admin area
6. Verify redirect to login (protected route)
7. Check that session token is cleared (DevTools)
8. Check that pressing "Back" doesn't restore session
9. Try refreshing on a protected page
10. Verify login is required

**Expected Results**:

- [ ] Logout button is findable
- [ ] Logout clears session
- [ ] Protected routes redirect to login after logout
- [ ] Back button doesn't restore session
- [ ] Clean logout experience

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-007: Protected Route Access After Logout

**Goal**: Verify all admin routes are protected after logout

**Preconditions**:

- Just logged out

**Steps**:

1. After logout, try direct URL to `/admin`
2. Verify redirect to login
3. Try direct URL to `/admin/bookings`
4. Verify redirect to login
5. Try direct URL to `/admin/payments`
6. Verify redirect to login
7. Try direct URL to `/admin/units`
8. Verify redirect to login
9. After redirect, check the URL includes return path
10. Log in and verify return to intended page (if implemented)

**Expected Results**:

- [ ] All admin routes require authentication
- [ ] Consistent redirect to login
- [ ] Return URL preserved (if implemented)
- [ ] No access to protected data without login

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-008: Login Rate Limiting

**Goal**: Verify login has protection against brute force attacks

**Preconditions**:

- On the `/login` page

**Steps**:

1. Navigate to `/login`
2. Attempt 5 rapid failed logins with wrong password
3. Check if rate limiting activates
4. If rate limited:
   - Note the lockout message
   - Note the lockout duration
   - Wait for lockout to expire
   - Verify login works after lockout
5. If no rate limiting:
   - Document as potential security concern
   - Try 10 more rapid attempts
6. Check for CAPTCHA activation after failed attempts

**Expected Results**:

- [ ] Rate limiting exists (or CAPTCHA)
- [ ] Clear feedback when rate limited
- [ ] Lockout duration is reasonable
- [ ] Can login after lockout expires

**Result**: [ ] Pass [ ] Fail

**Rate Limit Details**: **_ attempts, _** second lockout

**Notes/Issues Found**:

---

---

### TC-AUTH-009: XSS Prevention on Login

**Goal**: Verify login page is protected against XSS attacks

**Preconditions**:

- On the `/login` page

**Steps**:

1. Navigate to `/login`
2. In email field, enter: `<script>alert('XSS')</script>@test.com`
3. In password field, enter: `<img src=x onerror=alert('XSS')>`
4. Click "Sign In"
5. Verify no script execution
6. Check error message for XSS (should be escaped)
7. Try URL with XSS payload: `/login?error=<script>alert('XSS')</script>`
8. Verify payload doesn't execute
9. Check console for any security warnings

**Expected Results**:

- [ ] Script tags don't execute
- [ ] Error messages are escaped
- [ ] URL parameters are sanitized
- [ ] No XSS vulnerabilities

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

### TC-AUTH-010: Mobile Login Experience

**Goal**: Verify login works correctly on mobile devices

**Preconditions**:

- On the `/login` page
- DevTools available

**Steps**:

1. Navigate to `/login`
2. Open DevTools and set viewport to 375x667 (mobile)
3. Verify login form is properly sized
4. Check that input fields are large enough for touch
5. Enter credentials using on-screen keyboard simulation
6. Verify keyboard doesn't obscure form
7. Click "Sign In"
8. Verify login process works on mobile
9. After login, verify mobile navigation works
10. Test logout flow on mobile viewport

**Expected Results**:

- [ ] Login form is mobile-friendly
- [ ] Touch targets are adequate size
- [ ] Form works with mobile keyboards
- [ ] Full login flow works on mobile

**Result**: [ ] Pass [ ] Fail

**Notes/Issues Found**:

---

---

## Summary

| Test Case   | Description                         | Result |
| ----------- | ----------------------------------- | ------ |
| TC-AUTH-001 | Access Login Page                   |        |
| TC-AUTH-002 | Successful Staff Login              |        |
| TC-AUTH-003 | Invalid Credentials                 |        |
| TC-AUTH-004 | Form Validation                     |        |
| TC-AUTH-005 | Session Persistence                 |        |
| TC-AUTH-006 | Logout Functionality                |        |
| TC-AUTH-007 | Protected Route Access After Logout |        |
| TC-AUTH-008 | Login Rate Limiting                 |        |
| TC-AUTH-009 | XSS Prevention on Login             |        |
| TC-AUTH-010 | Mobile Login Experience             |        |

**Total Passed**: **\_ / 10
**Total Failed**: \_** / 10

**Overall Notes**:

---

---
