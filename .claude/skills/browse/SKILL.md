---
name: browse
description: Interactive app exploration using Playwright MCP. Navigate and interact with the app as any user role (guest, staff, admin, owner). Use this to visually inspect pages, test user flows, debug UI issues, or verify changes in a real browser. Supports both conversational step-by-step interaction and autonomous task execution.
---

# Browse - Interactive App Exploration

Navigate and interact with the Okaeri Resort System using Playwright MCP for real browser inspection. This skill provides a development feedback loop where you can browse as any user role, observe state, and identify issues.

## Quick Start

```
User: /browse                    → Start at homepage as guest
User: /browse admin dashboard    → Login as admin, go to dashboard
User: /browse staff bookings     → Login as staff, go to bookings page
User: /browse guest booking      → Public booking page (no auth)
```

## Workflow

### Step 1: Start Dev Server (if needed)

Check if dev server is running:

```bash
curl -s http://localhost:5173 > /dev/null && echo "Running" || echo "Not running"
```

If not running, start it in the background:

```bash
npm run dev &
```

Wait for it to be ready:

```bash
# Wait up to 30 seconds for dev server
for i in {1..30}; do curl -s http://localhost:5173 > /dev/null && break || sleep 1; done
```

### Step 2: Parse User Request

Extract from user command:

- **Role**: guest (default), staff, admin, or owner
- **Destination**: page or route to navigate to
- **Task**: optional action to perform autonomously

**Route Mapping:**
| Shorthand | Full Route | Requires Auth |
|-----------|------------|---------------|
| `home`, `landing` | `/` | No |
| `booking`, `book` | `/booking` | No |
| `status`, `check` | `/booking/check-status` | No |
| `login` | `/login` | No |
| `dashboard` | `/admin/dashboard` | Yes |
| `bookings` | `/admin/bookings` | Yes |
| `units`, `cabins` | `/admin/units` | Yes |
| `guests` | `/admin/guests` | Yes |
| `payments` | `/admin/payments` | Yes |
| `expenses` | `/admin/expenses` | Yes |
| `audit`, `logs` | `/admin/audit-logs` | Yes |
| `roles` | `/admin/roles` | Yes (owner) |
| `availability` | `/admin/availability` | Yes |

### Step 3: Authenticate (if needed)

For roles other than `guest`, login using Playwright MCP:

#### 3.1 Navigate to login page

```
Tool: mcp__playwright__browser_navigate
url: http://localhost:5173/login
```

#### 3.2 Wait for login form

```
Tool: mcp__playwright__browser_snapshot
```

Look for email and password fields in the snapshot.

#### 3.3 Fill credentials

Credentials are stored in `.env.test`:

- **Owner**: `TEST_OWNER_EMAIL` / `TEST_OWNER_PASSWORD`
- **Admin**: `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
- **Staff**: `TEST_STAFF_EMAIL` / `TEST_STAFF_PASSWORD`

Read credentials:

```bash
source .env.test && echo "$TEST_ADMIN_EMAIL"
```

Fill the form:

```
Tool: mcp__playwright__browser_fill_form
fields: [
  {"name": "Email", "type": "textbox", "ref": "{email-field-ref}", "value": "{email}"},
  {"name": "Password", "type": "textbox", "ref": "{password-field-ref}", "value": "{password}"}
]
```

#### 3.4 Submit login

```
Tool: mcp__playwright__browser_click
element: "Sign In button"
ref: "{sign-in-button-ref}"
```

#### 3.5 Wait for dashboard

```
Tool: mcp__playwright__browser_wait_for
text: "Dashboard"
```

### Step 4: Navigate to Destination

```
Tool: mcp__playwright__browser_navigate
url: http://localhost:5173{route}
```

### Step 5: Capture and Report State

#### 5.1 Take accessibility snapshot

```
Tool: mcp__playwright__browser_snapshot
```

#### 5.2 Check for console errors

```
Tool: mcp__playwright__browser_console_messages
level: "error"
```

#### 5.3 Check network failures

```
Tool: mcp__playwright__browser_network_requests
```

#### 5.4 Take visual screenshot (optional)

```
Tool: mcp__playwright__browser_take_screenshot
filename: "browse-{role}-{page}.png"
```

Note: Screenshots are saved under the MCP `--output-dir` (`.playwright-mcp/`,
gitignored). Do not prefix the filename with paths — the MCP server handles
routing. Ad-hoc screenshots taken outside this skill should also rely on the
same `--output-dir` so they never land at the repo root.

### Step 6: Report Current State

Format the state report:

```
═══════════════════════════════════════════════════════════
Browse Session: {role} @ {route}
═══════════════════════════════════════════════════════════

✓ Logged in as: {role}
✓ Current URL: {url}
✓ Page Title: {title}

Page Elements:
• Navigation: {list of nav items}
• Main Content: {description of visible content}
• Actions Available: {buttons, links}

{Console Errors: (if any)}
{Network Failures: (if any)}

What would you like me to do?
───────────────────────────────────────────────────────────
```

### Step 7: Handle Interaction Mode

#### Mode A: Conversational (Default)

Wait for user instructions and respond with:

**Click commands:**

```
User: click on first booking
Tool: mcp__playwright__browser_click
element: "{element description}"
ref: "{ref from snapshot}"
```

**Type commands:**

```
User: type "John Smith" in the search box
Tool: mcp__playwright__browser_type
element: "Search input"
ref: "{ref from snapshot}"
text: "John Smith"
```

**Form filling:**

```
User: fill the guest form with name: Test, email: test@example.com
Tool: mcp__playwright__browser_fill_form
fields: [{...}, {...}]
```

**Navigation:**

```
User: go to payments
Tool: mcp__playwright__browser_navigate
url: http://localhost:5173/admin/payments
```

**Inspection:**

```
User: check console errors
Tool: mcp__playwright__browser_console_messages
level: "error"

User: show network requests
Tool: mcp__playwright__browser_network_requests

User: screenshot the table
Tool: mcp__playwright__browser_take_screenshot
element: "Data table"
ref: "{table-ref}"
```

**State refresh:**

```
User: refresh / update snapshot
Tool: mcp__playwright__browser_snapshot
```

#### Mode B: Task-Oriented

If user provides a complete task, execute autonomously:

```
User: /browse admin create a test booking for John Smith

Steps:
1. Login as admin
2. Navigate to /admin/bookings
3. Click "New Booking" button
4. Fill booking form with guest name "John Smith"
5. Fill required fields with test data
6. Submit the form
7. Report the result (booking reference, confirmation)
```

**Task Examples:**

- `create a test booking for {name}` → Full booking creation flow
- `add a new guest {name}` → Guest creation flow
- `verify payment for booking {ref}` → Payment verification flow
- `check availability for {dates}` → Availability check

### Step 8: Multi-Tab / Role Comparison

For comparing views across roles:

```
User: /browse compare owner vs staff on /admin/roles

1. Create Tab 1: Login as owner
   Tool: mcp__playwright__browser_tabs
   action: "new"

2. Login as owner, navigate to /admin/roles

3. Take snapshot: owner-view

4. Create Tab 2: Login as staff
   Tool: mcp__playwright__browser_tabs
   action: "new"

5. Login as staff, navigate to /admin/roles

6. Take snapshot: staff-view

7. Compare and report differences
```

## Interactive Commands Reference

| User Says                  | Action                             |
| -------------------------- | ---------------------------------- |
| `click on {element}`       | Click element matching description |
| `type "{text}" in {field}` | Type text into field               |
| `fill {form} with {data}`  | Fill multiple form fields          |
| `go to {page}`             | Navigate to page                   |
| `refresh` / `update`       | Refresh snapshot                   |
| `screenshot` / `capture`   | Take screenshot                    |
| `check errors` / `console` | Show console errors                |
| `network` / `requests`     | Show network activity              |
| `switch to {role}`         | Re-login as different role         |
| `open new tab`             | Open new browser tab               |
| `go back`                  | Navigate back                      |
| `close`                    | Close browser session              |

## Safeguards

- **Timeout**: Browser sessions timeout after 10 minutes of inactivity
- **Never modify**: Auth/security code based on browsing observations
- **Ask before**: Any code changes discovered while browsing
- **Log interactions**: Track all browser actions for reproducibility
- **Dev server only**: Only browse localhost:5173, never production

## Session Cleanup

When session ends:

```
Tool: mcp__playwright__browser_close
```

## Example Session

```
User: /browse admin bookings

Claude: Starting browse session...

[Starting dev server]
✓ Dev server running at http://localhost:5173

[Authenticating as admin]
✓ Navigated to /login
✓ Filled credentials
✓ Clicked Sign In
✓ Redirected to dashboard

[Navigating to bookings]
✓ Navigated to /admin/bookings

═══════════════════════════════════════════════════════════
Browse Session: admin @ /admin/bookings
═══════════════════════════════════════════════════════════

✓ Logged in as: admin
✓ Current URL: http://localhost:5173/admin/bookings
✓ Page Title: Bookings | Okaeri Resort

Page Elements:
• Header: "Bookings" with "New Booking" button
• Filters: Status dropdown, Date range picker, Search box
• Table: 15 rows showing booking reference, guest, dates, status
• Pagination: Page 1 of 3

Console Errors: None
Network: All requests successful

What would you like me to do?
───────────────────────────────────────────────────────────

User: click on the first booking

Claude: [Clicking first booking row]
Tool: mcp__playwright__browser_click
element: "First booking row - REF-2026-0121-ABC"
ref: "booking-row-0"

✓ Navigated to booking detail

Current view shows:
• Booking: REF-2026-0121-ABC
• Guest: John Smith
• Status: Confirmed
• Check-in: Jan 25, 2026
• Actions: Edit, Cancel, Add Payment

What next?

User: check for console errors

Claude: [Checking console messages]
Tool: mcp__playwright__browser_console_messages
level: "error"

✓ No console errors found

The page is rendering without JavaScript errors.
```
