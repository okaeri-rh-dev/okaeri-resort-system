# Test Credentials

**Last Updated**: 2026-01-30
**Environment**: Development / Staging

## Security Notice

These credentials are for **testing purposes only**. Never use production credentials in test documentation.

---

## Test Accounts

### Owner Account

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| **Role**        | Owner                                              |
| **Email**       | `jasonacido+owner@gmail.com`                       |
| **Password**    | `12345678`                                         |
| **Permissions** | Full access to all features EXCEPT role management |

**Key Access:**

- ✓ View/Create/Edit/Delete Bookings
- ✓ View/Create/Edit/Delete Guests
- ✓ View/Verify Payments
- ✓ Manage Units & Pricing
- ✓ Manage Expenses
- ✓ View Audit Logs
- ✗ Manage User Roles (Admin only)

---

### Admin Account

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Role**        | Admin                        |
| **Email**       | `jasonacido+admin@gmail.com` |
| **Password**    | `12345678`                   |
| **Permissions** | Full access to ALL features  |

**Key Access:**

- ✓ View/Create/Edit/Delete Bookings
- ✓ View/Create/Edit/Delete Guests
- ✓ View/Verify Payments
- ✓ Manage Units & Pricing
- ✓ Manage Expenses
- ✓ View Audit Logs
- ✓ Manage User Roles

---

### Staff Account

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Role**        | Staff                        |
| **Email**       | `jasonacido+staff@gmail.com` |
| **Password**    | `12345678`                   |
| **Permissions** | View-only access             |

**Key Access:**

- ✓ View Bookings (read-only)
- ✓ View Guests (read-only)
- ✓ View Payments (read-only)
- ✓ View Units (read-only)
- ✗ Create/Edit/Delete anything
- ✗ Verify Payments
- ✗ View Audit Logs
- ✗ Manage User Roles

---

### Anonymous User

| Field           | Value                     |
| --------------- | ------------------------- |
| **Role**        | Anonymous (Not logged in) |
| **Email**       | N/A                       |
| **Password**    | N/A                       |
| **Permissions** | Public pages only         |

**Key Access:**

- ✓ View public availability calendar
- ✓ Create guest bookings
- ✓ Check booking status (with reference)
- ✓ View booking confirmation
- ✗ Access any /admin routes

---

## Login URLs

| Environment       | Login URL                                 |
| ----------------- | ----------------------------------------- |
| Local Development | `http://localhost:5173/login`             |
| Staging           | `https://staging.okaeri-resort.com/login` |
| Production        | `https://okaeri-resort.pages.dev/login`   |

---

## Session Information

- **Session Duration**: Sessions persist until explicit logout
- **Storage**: Authentication tokens stored in localStorage
- **Logout**: Available via user menu in top-right corner

---

## Troubleshooting

### Login Fails

1. **Check credentials** - Ensure email/password are correct
2. **Clear localStorage** - Browser DevTools → Application → Local Storage → Clear
3. **Check network** - DevTools → Network tab for API errors
4. **Verify Supabase** - Ensure Supabase service is running

### Session Expired

1. Refresh the page
2. If still logged out, clear localStorage and re-login

### Account Locked

Contact system administrator if account appears locked after multiple failed attempts.

---

## Creating Additional Test Users

If additional test users are needed:

1. Access Supabase Dashboard
2. Navigate to Authentication → Users
3. Create new user with test email pattern: `jasonacido+[role]@gmail.com`
4. Set role in user metadata or profiles table

---

## Password Reset Testing

To test password reset flow:

1. Navigate to `/login`
2. Click "Forgot Password"
3. Enter test email
4. Check email inbox (or Supabase logs for local)
5. Follow reset link

**Note**: Test emails may be captured by Supabase email logs rather than actual delivery in development.
