---
name: fix-e2e
description: Debug and fix failing Playwright E2E tests using browser inspection. Run this skill when E2E tests fail and you need to identify root causes (selector changes, timing issues, UI changes) and apply fixes. ALWAYS asks for approval before making any code changes.
---

# Fix E2E Tests

Debug failing Playwright E2E tests using the Playwright MCP server for interactive browser inspection. This skill identifies root causes and proposes fixes, but **always asks for approval before modifying code**.

## Key Principle: Always Ask Before Fixing

This skill follows a strict approval workflow:

1. **Analyze** - Run tests and identify failures
2. **Debug** - Use Playwright MCP to inspect browser state
3. **Diagnose** - Determine root cause
4. **Propose** - Show the fix with diff preview
5. **Wait** - Get explicit user approval
6. **Apply** - Only then make the change
7. **Verify** - Re-run test to confirm fix

## Workflow

Execute these steps in order:

### Step 1: Run E2E Tests and Capture Results

Run the E2E test suite with JSON output:

```bash
npm run test:e2e -- --reporter=json --output=test-results/e2e-results.json 2>&1 || true
```

If specific tests are requested, run only those:

```bash
npx playwright test {test-file} --reporter=json
```

### Step 2: Parse Test Results

Read and parse `test-results/e2e-results.json` to extract failures:

For each failed test, extract:

- **title**: Test name
- **file**: Test file path (e.g., `e2e/smoke.spec.ts`)
- **line**: Line number where test is defined
- **error.message**: The actual error message
- **error.stack**: Full stack trace
- **status**: Should be "failed" or "timedOut"

Create a summary for the user showing:

```
Test Results: {passed}/{total} passed, {failed} failed

Failed Tests:
1. "{test-title}" in {file}:{line}
   Error: {brief-error-message}
```

### Step 3: Categorize Each Failure

Analyze the error message to categorize the failure type:

| Category       | Error Patterns                                            | Common Causes                                     |
| -------------- | --------------------------------------------------------- | ------------------------------------------------- |
| **Timing**     | `Timeout`, `exceeded`, `waiting for`                      | Slow network, missing await, element not ready    |
| **Selector**   | `locator.click`, `not found`, `strict mode violation`     | Selector changed, multiple matches, wrong element |
| **Visibility** | `not visible`, `hidden`, `detached`, `intercepts pointer` | Element covered, not rendered, modal blocking     |
| **Navigation** | `URL`, `redirect`, `navigation timeout`                   | Route changed, auth redirect, slow load           |
| **Assertion**  | `Expected`, `toHaveText`, `toBe`, `toContain`             | UI text changed, wrong expected value             |
| **Network**    | `status: 4xx`, `status: 5xx`, `ECONNREFUSED`              | API error, server down, wrong endpoint            |
| **State**      | `undefined`, `null`, `Cannot read property`               | Missing data, race condition, setup issue         |

### Step 4: Debug with Playwright MCP

For each failure, use the Playwright MCP tools to inspect the actual browser state:

#### 4.1 Navigate to the failing page

Use `browser_navigate` to go to the page URL from the test:

```
Tool: mcp__playwright__browser_navigate
URL: {base-url}{route-from-test}
```

**Project Routes Reference** (from `e2e/fixtures/test-data.ts`):

- Public: `/`, `/booking`, `/login`, `/forgot-password`, `/privacy-policy`, `/terms-and-conditions`, `/booking/check-status`
- Admin: `/admin/dashboard`, `/admin/bookings`, `/admin/units`, `/admin/guests`, `/admin/payments`, `/admin/expenses`

#### 4.2 Capture DOM State

Use `browser_snapshot` to get the accessibility tree (preferred) or `browser_take_screenshot` for visual inspection:

```
Tool: mcp__playwright__browser_snapshot
```

The snapshot shows:

- All interactive elements with their `ref` IDs
- Text content
- Roles (button, link, textbox, etc.)
- States (disabled, checked, expanded)

#### 4.3 Check Console Errors

Use `browser_console_messages` to find JavaScript errors:

```
Tool: mcp__playwright__browser_console_messages
level: "error"
```

#### 4.4 Inspect Network Activity

Use `browser_network_requests` to check for API failures:

```
Tool: mcp__playwright__browser_network_requests
```

Look for:

- Failed requests (status 4xx, 5xx)
- Pending requests that never completed
- Unexpected redirects

#### 4.5 Interact if Needed

If debugging requires interaction (e.g., opening a dropdown, clicking a button to reveal state):

```
Tool: mcp__playwright__browser_click
element: "{description of element}"
ref: "{ref from snapshot}"
```

### Step 5: Analyze Root Cause

Based on the MCP debugging, determine the root cause:

1. **Read the test file** to understand what the test expects
2. **Read the Page Object** (if used) to see current selectors
3. **Compare expected vs actual** DOM state from snapshot
4. **Identify the gap** between test expectation and reality

#### Root Cause Categories:

| Root Cause               | Evidence                                   | Fix Location          |
| ------------------------ | ------------------------------------------ | --------------------- |
| **Selector outdated**    | Element exists but with different selector | Page Object file      |
| **Test assertion wrong** | UI intentionally changed                   | Test file             |
| **Timing issue**         | Element appears later, flaky behavior      | Test file (add wait)  |
| **Component bug**        | Element missing or wrong behavior          | Component source      |
| **Data setup issue**     | Expected data not present                  | Test fixture or setup |

### Step 6: Apply the Fix

Based on root cause, apply fixes in priority order:

#### Priority 1: Update Page Object Selectors (Most Common)

If the DOM changed but the element exists:

```typescript
// Page Object: e2e/pages/{PageName}Page.ts
// OLD: this.submitButton = page.locator('button.submit');
// NEW: this.submitButton = page.getByRole('button', { name: /submit/i });
```

**Selector Best Practices:**

- Prefer `getByRole()` with name for accessibility and stability
- Use `getByTestId()` for custom test IDs
- Avoid class-based selectors unless necessary
- Use `.first()` for ambiguous matches only when intentional

#### Priority 2: Update Test Assertions

If the expected behavior changed intentionally:

```typescript
// Test file: e2e/{feature}.spec.ts
// OLD: await expect(page).toHaveURL('/dashboard');
// NEW: await expect(page).toHaveURL('/admin/dashboard');
```

#### Priority 3: Add Wait/Retry Logic

For timing issues:

```typescript
// Add explicit wait
await page.waitForSelector('[data-testid="loaded"]');

// Or use Playwright's auto-retry with timeout
await expect(element).toBeVisible({ timeout: 10000 });

// Wait for network idle
await page.waitForLoadState("networkidle");
```

#### Priority 4: Fix Component Code

If there's an actual bug in the component:

- **ALWAYS ask user for confirmation before modifying source components**
- Explain the bug and proposed fix
- Show diff of changes

### Step 7: Re-run and Verify

After applying a fix, re-run the specific test:

```bash
npx playwright test {file}:{line} --reporter=list
```

**Verification outcomes:**

- **Pass**: Mark this failure as resolved, move to next
- **Different error**: Update categorization, continue debugging
- **Same error**: Re-analyze, try alternative fix

### Step 8: Loop or Complete

Repeat Steps 3-7 for each failure until:

- All tests pass
- Max 3 attempts per test reached
- Max 10 total fixes per session reached
- User requests to stop

## Project-Specific Conventions

### Page Object Pattern

Page Objects are in `e2e/pages/` with naming convention `{Feature}Page.ts`:

- `LoginPage.ts` - Authentication forms
- `DashboardPage.ts` - Admin dashboard
- `BookingFormPage.ts` - Booking creation
- `BookingsTablePage.ts` - Bookings list
- `PublicCalendarPage.ts` - Public landing page

### Test Organization

```
e2e/
├── smoke.spec.ts          # Quick health checks
├── auth.spec.ts           # Authentication flows
├── public-booking.spec.ts # Public booking journey
├── admin-bookings.spec.ts # Admin booking management
├── fixtures/
│   ├── test-data.ts       # Routes, credentials, mock data
│   └── auth.ts            # Auth helper functions
└── pages/                 # Page Object Models
```

### Common Selectors in This Project

```typescript
// Navigation links
page.getByRole("link", { name: /bookings/i });
page.getByRole("link", { name: /units|cabins/i });

// Form inputs
page.getByLabel(/email/i);
page.getByLabel(/password/i);

// Buttons
page.getByRole("button", { name: /sign in|login/i });
page.getByRole("button", { name: /submit|save/i });

// Cards (KPI cards use ancestor pattern)
page.locator("text=Available Cabins").locator('xpath=ancestor::*[contains(@class, "card")]');
```

## MCP Debugging Sequences by Failure Type

### Timing Failures

```
1. browser_navigate → failing URL
2. browser_snapshot → check if element exists
3. browser_network_requests → check for pending requests
4. If element missing, browser_wait_for with text/time
5. browser_snapshot again to verify element appeared
```

### Selector Failures

```
1. browser_navigate → failing URL
2. browser_snapshot → get full DOM tree
3. Search snapshot for expected element text/role
4. Compare found ref/structure with test's selector
5. Update Page Object with correct selector
```

### API Failures

```
1. browser_navigate → failing URL
2. browser_network_requests → find failed request
3. browser_console_messages → check for error logs
4. Identify endpoint and status code
5. Determine if API fix needed or test expectation wrong
```

### Visibility Failures

```
1. browser_navigate → failing URL
2. browser_snapshot → find element
3. If element in snapshot, check for overlays/modals
4. browser_click to dismiss blocker if needed
5. Or update test to wait for animation/modal
```

## Safeguards

- **Max 3 attempts** per individual test
- **Max 10 fixes** per session to prevent runaway changes
- **User confirmation required** before modifying component source code (`src/components/**`)
- **Never modify** security-related code without explicit approval
- **Stop immediately** if changes would affect authentication or payment logic
- **Create backup** suggestion if making multiple related changes

## Output Format

### Progress Updates

```
Analyzing failure {n}/{total}: "{test-name}"
├── File: {file}:{line}
├── Category: {category}
├── Error: {brief-error}
│
├── [MCP Debug] Navigating to {url}
├── [MCP Debug] Taking snapshot...
├── [MCP Debug] Found: {observations}
│
├── Root Cause: {explanation}
└── Fix: {proposed-fix-location}

Apply fix? [Y/n]
```

### Session Summary

```
E2E Fix Session Complete
========================
Tests analyzed: {n}
Fixes applied: {n}
Tests now passing: {n}

Changes made:
- {file}: {brief-description}
- {file}: {brief-description}

Remaining failures (if any):
- {test-name}: {reason-unable-to-fix}
```

## Example Session

````
User: /fix-e2e

Claude: Starting E2E test analysis...

Running: npm run test:e2e

Test Results: 78/83 passed, 5 failed

Failed Tests:
1. "public calendar has working Book Now link" in smoke.spec.ts:100
   Error: locator.click: Timeout 30000ms exceeded

Analyzing failure 1/5: "public calendar has working Book Now link"
├── File: smoke.spec.ts:100
├── Category: Timing
├── Error: Timeout waiting for click

[MCP Debug] Navigating to http://localhost:5173/
[MCP Debug] Taking snapshot...
[MCP Debug] Snapshot shows:
  - ref="book-now-btn": button "Book Now" [disabled]
  - ref="loading": text "Loading availability..."

[MCP Debug] Checking network...
[MCP Debug] Pending request: GET /api/availability

Root Cause: Button is disabled until availability data loads.
The test clicks before the API response completes.

Fix: Update PublicCalendarPage.ts to wait for button to be enabled

```typescript
// Before
async clickBookNow() {
  await this.bookNowButton.click();
}

// After
async clickBookNow() {
  await this.bookNowButton.waitFor({ state: 'visible' });
  await expect(this.bookNowButton).toBeEnabled({ timeout: 10000 });
  await this.bookNowButton.click();
}
````

Apply fix? [Y/n]

```

## Integration with Other Skills

### Use `/browse` for deeper debugging:
```

If a test failure is unclear from MCP inspection:
User: Let me browse this page interactively
Claude: [Switches to /browse mode for interactive exploration]

```

### Use `/audit-ui` for broader issues:
```

If multiple tests fail on the same page:
Claude: Multiple tests failing on /admin/payments.
Would you like me to run a full UI audit of this page?
This might reveal related issues.

```

### Combined Workflow:
```

1. /fix-e2e → Identifies test failures
2. /browse → Interactive debugging of specific issue
3. /audit-ui → Comprehensive page audit
4. /fix-e2e → Verify fixes with test re-run

```

### Feedback Loop:
```

┌─────────────────────────────────────────────────┐
│ FEEDBACK LOOP │
│ │
│ /fix-e2e ──▶ /browse ──▶ /audit-ui │
│ ▲ │ │
│ │ ▼ │
│ └─────── verify ◀─── fix code │
└─────────────────────────────────────────────────┘

```

```
