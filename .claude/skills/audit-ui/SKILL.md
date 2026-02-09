---
name: audit-ui
description: Automated UI audit and issue discovery using Playwright MCP. Systematically checks pages for console errors, network failures, missing elements, accessibility issues, and broken features. Use this to find bugs before users do, verify deployments, or audit specific sections of the app.
---

# Audit UI - Automated Issue Discovery

Systematically audit the Okaeri Resort System UI using Playwright MCP to discover console errors, network failures, broken features, and accessibility issues. This skill crawls pages and generates a comprehensive issue report with suggested fixes.

## Quick Start

```
User: /audit-ui                  → Audit all sections (public + admin)
User: /audit-ui admin            → Audit admin section only
User: /audit-ui public           → Audit public pages only
User: /audit-ui admin bookings   → Audit specific page
```

## Audit Scope

### Public Pages (no auth required)

| Page            | Route                   | Key Checks                                   |
| --------------- | ----------------------- | -------------------------------------------- |
| Landing         | `/`                     | Calendar loads, Book Now button works        |
| Booking Form    | `/booking`              | Form fields interactive, unit selector works |
| Check Status    | `/booking/check-status` | Reference lookup works                       |
| Login           | `/login`                | Form renders, error handling works           |
| Forgot Password | `/forgot-password`      | Email form works                             |
| Privacy Policy  | `/privacy-policy`       | Content renders                              |
| Terms           | `/terms-and-conditions` | Content renders                              |

### Admin Pages (auth required)

| Page         | Route                 | Role   | Key Checks                  |
| ------------ | --------------------- | ------ | --------------------------- |
| Dashboard    | `/admin/dashboard`    | any    | KPI cards, charts load      |
| Bookings     | `/admin/bookings`     | any    | Table renders, filters work |
| Units        | `/admin/units`        | any    | Unit cards/table render     |
| Guests       | `/admin/guests`       | any    | Guest list renders          |
| Payments     | `/admin/payments`     | any    | Payment table renders       |
| Expenses     | `/admin/expenses`     | any    | Expense table renders       |
| Availability | `/admin/availability` | any    | Calendar renders            |
| Audit Logs   | `/admin/audit-logs`   | admin+ | Log table renders           |
| Roles        | `/admin/roles`        | owner  | Role management renders     |

## Workflow

### Step 1: Determine Audit Scope

Parse user request to determine:

- **Section**: `all`, `public`, `admin`, or specific page
- **Role**: Use appropriate role for admin pages (admin by default)

### Step 2: Start Dev Server

```bash
# Check if running
curl -s http://localhost:5173 > /dev/null && echo "Running" || (npm run dev &)

# Wait for ready
for i in {1..30}; do curl -s http://localhost:5173 > /dev/null && break || sleep 1; done
```

### Step 3: Authenticate (if auditing admin pages)

Follow login procedure from `/browse` skill:

1. Navigate to `/login`
2. Fill credentials from `.env.test`
3. Submit and wait for dashboard

### Step 4: Execute Audit Loop

For each page in scope:

#### 4.1 Navigate to page

```
Tool: mcp__playwright__browser_navigate
url: http://localhost:5173{route}
```

#### 4.2 Wait for page load

```
Tool: mcp__playwright__browser_wait_for
time: 2
```

#### 4.3 Capture accessibility snapshot

```
Tool: mcp__playwright__browser_snapshot
```

#### 4.4 Check console messages

```
Tool: mcp__playwright__browser_console_messages
level: "warning"
```

#### 4.5 Check network requests

```
Tool: mcp__playwright__browser_network_requests
```

#### 4.6 Run page-specific checks

**Dashboard Checks:**

- KPI cards visible (at least 3)
- Charts rendered (canvas or svg elements)
- No "undefined" or "NaN" values

**Table Page Checks (Bookings, Guests, Payments, Expenses):**

- Table header row visible
- At least one data row OR "No data" message
- Action buttons present
- Filters interactive

**Form Page Checks (Booking Form):**

- All required fields visible
- Submit button present
- Date pickers functional
- Dropdowns open

#### 4.7 Test at all viewports

For each page, test all three viewports to ensure responsive design:

**Mobile (375x667):**

```
Tool: mcp__playwright__browser_resize
width: 375
height: 667
```

- Take snapshot
- Check for horizontal overflow
- Verify touch targets visible (minimum 44x44px)
- Check navigation accessibility (hamburger menu opens)
- Verify inputs have 16px+ font (prevents iOS zoom)

**Tablet (768x1024):**

```
Tool: mcp__playwright__browser_resize
width: 768
height: 1024
```

- Take snapshot
- Check layout adaptation (not just stretched mobile)
- Verify tables/forms display properly
- Check sidebars visible or accessible

**Desktop (1280x720):**

```
Tool: mcp__playwright__browser_resize
width: 1280
height: 720
```

- Reset to desktop view for next page

### Step 5: Categorize Issues

For each issue found, categorize:

| Severity    | Category        | Examples                                  |
| ----------- | --------------- | ----------------------------------------- |
| **ERROR**   | Console Error   | Unhandled exception, React error boundary |
| **ERROR**   | Network Failure | 4xx/5xx responses, failed fetches         |
| **ERROR**   | Missing Element | Required UI element not rendered          |
| **WARNING** | Console Warning | Deprecation, key prop missing             |
| **WARNING** | Performance     | Slow requests (>3s), large payloads       |
| **WARNING** | Accessibility   | Missing labels, contrast issues           |
| **INFO**    | Improvement     | Suggested enhancements                    |

### Step 6: Generate Issue Report

```
═══════════════════════════════════════════════════════════
UI Audit Report
═══════════════════════════════════════════════════════════
Scope: {section}
Pages Audited: {count}
Time: {duration}

Responsive Coverage:
• Mobile (375x667): {pass/fail count}
• Tablet (768x1024): {pass/fail count}
• Desktop (1280x720): {pass/fail count}

Summary:
• Errors: {count}
• Warnings: {count}
• Mobile Issues: {count}
• Tablet Issues: {count}

───────────────────────────────────────────────────────────
Page: {route}
Status: {PASS | FAIL | WARNING}
───────────────────────────────────────────────────────────

{For each issue on page:}

[{SEVERITY}] {Brief Description}
├── Location: {file:line or "Browser Console"}
├── Details: {full error message or observation}
├── Evidence: {what was seen in snapshot/console}
└── Suggested Fix: {actionable fix}

{End for each}

───────────────────────────────────────────────────────────
{Repeat for each page}
───────────────────────────────────────────────────────────

Fix Summary:
1. {file}: {brief description of fix}
2. {file}: {brief description of fix}
...

Apply fixes? [Y/n/select specific]
═══════════════════════════════════════════════════════════
```

### Step 7: Fix Application (with approval)

**IMPORTANT: Always ask before applying fixes**

For each approved fix:

1. Read the source file
2. Show the proposed change (diff preview)
3. Wait for user confirmation
4. Apply the edit
5. Re-audit the page to verify fix

## Audit Checklist Per Page

### Basic Checks (All Pages)

- [ ] Page loads without JS errors
- [ ] No failed network requests (4xx, 5xx)
- [ ] Main content area visible
- [ ] Navigation functional
- [ ] No console errors

### Table Pages

- [ ] Table header renders
- [ ] Table body renders (data or empty state)
- [ ] Pagination controls present (if applicable)
- [ ] Sort/filter controls work
- [ ] Row actions clickable

### Form Pages

- [ ] All labeled inputs visible
- [ ] Required field indicators present
- [ ] Submit button enabled/disabled appropriately
- [ ] Validation messages display on error
- [ ] Date pickers open
- [ ] Dropdowns functional

### Dashboard Pages

- [ ] KPI cards show values (not undefined/NaN)
- [ ] Charts render (canvas/svg present)
- [ ] Quick action buttons work
- [ ] Recent activity loads

### Detail Pages

- [ ] Entity data displays
- [ ] Back navigation works
- [ ] Edit/delete actions present
- [ ] Related entities load

### Mobile Viewport (375x667)

- [ ] Touch targets minimum 44x44px
- [ ] No horizontal scroll on content
- [ ] Navigation accessible (hamburger menu opens)
- [ ] Form inputs have 16px+ font (prevents iOS zoom)
- [ ] Tables adapt to cards or horizontal scroll
- [ ] Date pickers open as sheets/modals
- [ ] Submit buttons full-width or easily tappable
- [ ] Text readable without zooming

### Tablet Viewport (768x1024)

- [ ] Layout adapts appropriately (not just stretched mobile)
- [ ] Sidebars visible or accessible
- [ ] Tables display properly
- [ ] Forms have appropriate width
- [ ] Navigation optimized for tablet

## Issue Detection Patterns

### Console Error Patterns

```javascript
// React errors
("Uncaught Error", "Unhandled Rejection", "Error boundary");

// Type errors
("Cannot read property", "is not a function", "undefined");

// Network errors
("Failed to fetch", "NetworkError", "CORS");

// React warnings (treat as warnings, not errors)
("Each child in a list should have a unique key");
("Can't perform a React state update on an unmounted component");
```

### Network Failure Patterns

```
// API errors
status: 400 (Bad Request) → Validation issue
status: 401 (Unauthorized) → Auth issue
status: 403 (Forbidden) → Permission issue
status: 404 (Not Found) → Missing resource/route
status: 500 (Server Error) → Backend bug
```

### Visual/Accessibility Patterns

```
// In snapshot, look for:
- Buttons without accessible names
- Images without alt text
- Form inputs without labels
- Insufficient color contrast (if detectable)
- Missing heading structure
```

### Mobile Layout Issues

```
// Overflow detection (check in snapshot)
- Horizontal scrollbar visible on content
- Text truncated without ellipsis
- Buttons cut off or overlapping

// Touch target issues
- Buttons/links smaller than 44px
- Touch targets overlapping or too close

// Zoom trigger issues
- Input font-size < 16px (triggers iOS zoom)
- Form fields too small

// Navigation issues
- Mobile menu doesn't open
- Navigation items inaccessible
```

## Fix Strategies by Issue Type

| Issue                         | Detection                          | Fix Location                        |
| ----------------------------- | ---------------------------------- | ----------------------------------- |
| Console Error: null reference | `Cannot read property 'x' of null` | Add optional chaining in component  |
| Console Error: key prop       | `unique key` warning               | Add key to list items               |
| Network 500                   | API returns 500                    | Check API route handler             |
| Network 401                   | Unauthorized                       | Check auth token handling           |
| Missing element               | Not in snapshot                    | Check conditional rendering         |
| Slow load                     | Request >3s                        | Add loading state or optimize query |
| Empty state                   | Table shows nothing                | Add "No data" fallback              |

## Safeguards

- **Max 20 pages** per audit session
- **Max 10 fixes** per session
- **Always ask** before modifying code
- **Show diff preview** before each edit
- **Re-audit** after fixes to verify
- **Never modify** auth/security code without explicit approval
- **Skip** pages that require special setup (file uploads, etc.)

## Example Session

````
User: /audit-ui admin

Claude: Starting UI audit of admin section...

[Setup]
✓ Dev server running
✓ Authenticated as admin

[Auditing]
Auditing /admin/dashboard... ✓ No issues
Auditing /admin/bookings... ⚠ 1 warning
Auditing /admin/units... ✓ No issues
Auditing /admin/guests... ✓ No issues
Auditing /admin/payments... ✗ 2 errors
Auditing /admin/expenses... ✓ No issues
Auditing /admin/availability... ✓ No issues
Auditing /admin/audit-logs... ✓ No issues

═══════════════════════════════════════════════════════════
UI Audit Report
═══════════════════════════════════════════════════════════
Scope: admin
Pages Audited: 8
Time: 45 seconds

Summary:
• Errors: 2
• Warnings: 1
• Info: 0

───────────────────────────────────────────────────────────
Page: /admin/bookings
Status: WARNING
───────────────────────────────────────────────────────────

[WARNING] React key prop missing in list
├── Location: Browser Console
├── Details: "Each child in a list should have a unique 'key' prop"
├── Evidence: Warning in console, table renders correctly
└── Suggested Fix: Add key={booking.id} to BookingsTable row mapping

───────────────────────────────────────────────────────────
Page: /admin/payments
Status: FAIL
───────────────────────────────────────────────────────────

[ERROR] API request failed
├── Location: GET /api/payments → 500
├── Details: Internal Server Error
├── Evidence: Table shows loading spinner indefinitely
└── Suggested Fix: Check PaymentsAPI handler for null reference

[ERROR] Unhandled promise rejection
├── Location: Browser Console
├── Details: "Cannot read property 'amount' of undefined"
├── Evidence: Error thrown when processing payment response
└── Suggested Fix: Add null check in PaymentsList.tsx

═══════════════════════════════════════════════════════════

Fix Summary:
1. src/components/bookings/BookingsTable/BookingsTable.tsx: Add key prop
2. src/components/payments/PaymentsList.tsx: Add null check for amount

Apply fixes? [Y/n/select specific]

User: y

Claude: Applying fix 1/2...

Reading src/components/bookings/BookingsTable/BookingsTable.tsx...

Proposed change:
```diff
- {bookings.map((booking) => (
-   <TableRow>
+ {bookings.map((booking) => (
+   <TableRow key={booking.id}>
````

Apply this fix? [Y/n]

User: y

Claude: ✓ Fix applied

Re-auditing /admin/bookings...
✓ Warning resolved

Applying fix 2/2...
[continues...]

```

## Integration with Other Skills

### After `/browse` finds an issue:
```

User: /browse admin payments
Claude: [Shows page with error]

User: audit this page
Claude: [Runs audit-ui checks on current page]

```

### Before `/fix-e2e`:
```

User: /audit-ui admin
Claude: [Finds 3 issues]
Claude: These issues may be causing E2E test failures.
Run /fix-e2e to check test results?

```

```
