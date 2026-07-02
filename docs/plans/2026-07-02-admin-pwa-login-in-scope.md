# Admin PWA — Login-in-Scope (Piece 3) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the installed admin PWA (manifest scoped to `/admin`) stay inside its standalone window through every auth transition — logged-out launch, mid-session expiry, and sign-out — by adding in-scope `/admin/login` and `/admin/pending-approval` routes and repointing the app's _internal_ redirects to them.

**Architecture:** Additive, not a migration. We keep the existing root `/login`, `/pending-approval`, `/forgot-password`, `/reset-password`, `/sign-up` routes untouched (they remain the browser/email entry points, so **no Supabase redirect-allowlist changes are needed**). We add two _non-nested_ routes under the `/admin` URL prefix using TanStack Router's trailing-underscore convention (`admin_.login.tsx`, `admin_.pending-approval.tsx`) so they carry an in-scope URL but do **not** inherit the `admin.tsx` auth guard (which would otherwise cause an infinite redirect loop). Then we repoint only the redirects that fire _inside the app_ (`admin.tsx` guard, `auth.ts` session-expiry/redirect helpers, sign-out buttons) from `/login` → `/admin/login`. The Cloudflare middleware is untouched because it only gates `/api/*`, never page routes.

**Tech Stack:** React 19, TanStack Router v1 (file-based routing), Zod, Vitest (happy-dom), Playwright (E2E), Vite + `vite-plugin-pwa`.

---

## Background & constraints (read before starting)

- **Why non-nested routes?** `src/routes/admin.tsx` is the layout route for `/admin` and its `beforeLoad` redirects unauthenticated users to login. Any file under `src/routes/admin/` inherits that guard. A naive `src/routes/admin/login.tsx` would therefore redirect the logged-out user _away from the login page_ → infinite loop. TanStack Router's trailing-underscore segment (`admin_.login.tsx`) produces the URL `/admin/login` while un-nesting it from `admin.tsx` (verified against `/tanstack/router` docs — "Non-Nested Routes"). Route **id** keeps the underscore (`/admin_/login`, used for `useSearch({ from })`); the navigable **path** drops it (`/admin/login`, used for `to`). After regenerating the route tree, let TypeScript confirm the exact literals.
- **Dependency on Piece 1 (manifest scope).** Login-in-scope only matters once the manifest is scoped to `/admin`. Task 1 makes that change so this plan is verifiable end-to-end. (Piece 2, the custom in-app install button, is independent UX and is **out of scope** for this plan.)
- **What we deliberately do NOT touch (avoids the Supabase landmine):**
  - Root routes `/login`, `/pending-approval`, `/forgot-password`, `/reset-password`, `/sign-up` — kept as browser/email entry points.
  - `functions/api/auth/forgot-password.ts` (`redirectTo: ${origin}/reset-password`) and `functions/api/auth/sign-up.ts` (`emailRedirectTo: ${origin}/login?confirmed=true`) — these targets are opened from an **email in the default browser**, never inside the PWA, so they don't break standalone scope. Leaving them means **no Supabase dashboard redirect-allowlist change is required.**
  - `functions/_middleware.ts` — early-returns for non-`/api/` paths; page-route names are irrelevant to it.
  - `src/constants/routes.ts` — stale/dead (`/dashboard`, `/projects` aren't real routes); not a source of truth, not used here. (Optional cleanup, out of scope.)
- **Every new in-scope path must be added to `VALID_ROUTES` in `src/lib/auth.ts`** or `safeRedirect()` (open-redirect allowlist, `startsWith` match) will bounce it back to login.

## Redirect sites to repoint (the complete inventory)

| #   | File:line                                        | Current                           | New                                           | Why it fires                         |
| --- | ------------------------------------------------ | --------------------------------- | --------------------------------------------- | ------------------------------------ |
| 1   | `src/routes/admin.tsx:13`                        | `to: "/login"`                    | `to: "/admin/login"`                          | Guard: launch while logged out       |
| 2   | `src/routes/admin.tsx:25`                        | `to: "/pending-approval"`         | `to: "/admin/pending-approval"`               | Guard: authed but no role            |
| 3   | `src/routes/admin.tsx:48`                        | `window.location.href = "/login"` | `"/admin/login"`                              | Error boundary sign-out              |
| 4   | `src/lib/auth.ts` `VALID_ROUTES` (17)            | —                                 | add `/admin/login`, `/admin/pending-approval` | Open-redirect allowlist              |
| 5   | `src/lib/auth.ts:139`                            | `replace("/login")`               | `replace("/admin/login")`                     | `safeRedirect` fallback              |
| 6   | `src/lib/auth.ts:301`                            | `loginRoute = "/login"`           | `"/admin/login"`                              | `handleSessionExpired` (mid-session) |
| 7   | `src/lib/auth.ts:381`                            | `replace("/login")`               | `replace("/admin/login")`                     | `preventBackButtonAccess`            |
| 8   | `src/layouts/MainLayout.tsx:141`                 | `window.location.href = "/login"` | `"/admin/login"`                              | Admin shell sign-out                 |
| 9   | `src/components/auth/PendingApprovalPage.tsx:37` | `window.location.href = "/login"` | `"/admin/login"`                              | Sign-out from pending screen         |

New files: `src/components/auth/LoginScreen.tsx`, `src/routes/admin_.login.tsx`, `src/routes/admin_.pending-approval.tsx`.

> **Note on the generated route tree:** `src/routeTree.gen.ts` is auto-generated by `@tanstack/router-plugin`. It regenerates when the Vite dev server runs (`npm run dev`) or on build. **Never hand-edit it.** After adding route files, start the dev server once (or run `npm run build`) to regenerate, then rely on TypeScript for exact `to`/`from` literals.

---

## Task 1: Scope the PWA manifest to `/admin` (Piece 1 dependency)

**Files:**

- Modify: `public/manifest.json`

**Step 1: Edit the manifest**

Change `scope`, `start_url`, add a stable `id`, and fix the stale shortcut URLs:

```json
{
  "name": "Okaeri Resort Management System",
  "short_name": "Okaeri Resort",
  "description": "Professional resort management platform for Philippine businesses",
  "id": "/admin",
  "start_url": "/admin",
  "scope": "/admin",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066cc",
  "orientation": "portrait-primary",
  "categories": ["business", "productivity"],
  "icons": [
    /* unchanged */
  ],
  "shortcuts": [
    {
      "name": "Bookings",
      "short_name": "Bookings",
      "description": "View and manage bookings",
      "url": "/admin/bookings",
      "icons": [{ "src": "/favicon-32x32.png", "sizes": "32x32" }]
    },
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "View resort statistics",
      "url": "/admin/dashboard",
      "icons": [{ "src": "/favicon-32x32.png", "sizes": "32x32" }]
    },
    {
      "name": "New Booking",
      "short_name": "New Booking",
      "description": "Create a new booking",
      "url": "/admin/bookings?action=new",
      "icons": [{ "src": "/favicon-32x32.png", "sizes": "32x32" }]
    }
  ],
  "lang": "en-US",
  "dir": "ltr"
}
```

> Keep the existing `icons` array as-is. Verify `/admin/bookings?action=new` matches how the bookings route actually opens the "new booking" flow; if not, drop the query string.

**Step 2: Verify build picks it up**

Run: `npm run build`
Expected: build succeeds; `dist/manifest.json` reflects `"scope": "/admin"`.

**Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "feat(pwa): scope manifest to /admin so only the admin app is installable"
```

---

## Task 2: Extract a shared `LoginScreen` component (DRY prep)

The root `/login` and the new `/admin/login` render identical UI + post-login redirect logic. Extract it once so both routes stay in sync.

**Files:**

- Create: `src/components/auth/LoginScreen.tsx`
- Modify: `src/routes/login.tsx`
- Test: `src/components/auth/__tests__/LoginScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginScreen } from "@/components/auth/LoginScreen";

describe("LoginScreen", () => {
  it("renders the sign-in heading and the login form", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Okaeri Resort System")).toBeInTheDocument();
    // LoginForm renders an email field
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/LoginScreen.test.tsx`
Expected: FAIL — `Cannot find module '@/components/auth/LoginScreen'`.

**Step 3: Create `LoginScreen.tsx`** (moves the body out of `login.tsx` verbatim; `handleSuccess` uses only `window.location`, no router hooks, so it's router-agnostic)

```tsx
import { z } from "zod";

import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Shared search schema for both /login and /admin/login. */
export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  registered: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

interface LoginScreenProps {
  redirectTo?: string;
  registered?: boolean;
  confirmed?: boolean;
}

export function LoginScreen({ redirectTo, registered, confirmed }: LoginScreenProps) {
  const handleSuccess = () => {
    if (redirectTo) {
      // Validate redirect is same-origin to prevent open redirect attacks
      try {
        const url = new URL(redirectTo, window.location.origin);
        if (url.origin === window.location.origin) {
          window.location.href = url.href;
          return;
        }
      } catch {
        // Invalid URL — fall through to default
      }
    }
    window.location.reload();
  };

  return (
    <ErrorBoundary level="page">
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Okaeri Resort System
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to access the resort management dashboard
            </p>
          </div>
          <ErrorBoundary level="component">
            <LoginForm onSuccess={handleSuccess} registered={registered} confirmed={confirmed} />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
```

**Step 4: Refactor `src/routes/login.tsx` to use it**

```tsx
import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";

import { LoginScreen, loginSearchSchema } from "@/components/auth/LoginScreen";

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo, registered, confirmed } = useSearch({ from: "/login" });
  return <LoginScreen redirectTo={redirectTo} registered={registered} confirmed={confirmed} />;
}
```

**Step 5: Run tests + type-check**

Run: `npx vitest run src/components/auth/__tests__/LoginScreen.test.tsx && npm run type-check`
Expected: PASS; no type errors. (If `getByLabelText(/email/i)` doesn't match, adjust the assertion to a stable element in `LoginForm`.)

**Step 6: Commit**

```bash
git add src/components/auth/LoginScreen.tsx src/routes/login.tsx src/components/auth/__tests__/LoginScreen.test.tsx
git commit -m "refactor(auth): extract shared LoginScreen from /login route"
```

---

## Task 3: Add `/admin/login` and `/admin/pending-approval` to the redirect allowlist

**Files:**

- Modify: `src/lib/auth.ts:17-31` (`VALID_ROUTES`)
- Test: `src/lib/__tests__/auth.test.ts` (create if absent, else extend)

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";

describe("auth.isValidRoute — in-scope admin auth routes", () => {
  it("accepts /admin/login", () => {
    expect(auth.isValidRoute("/admin/login")).toBe(true);
  });
  it("accepts /admin/pending-approval", () => {
    expect(auth.isValidRoute("/admin/pending-approval")).toBe(true);
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts -t "in-scope admin auth routes"`
Expected: FAIL — both return `false` (not yet in `VALID_ROUTES`).

**Step 3: Add the entries**

In `src/lib/auth.ts`, extend `VALID_ROUTES`:

```ts
const VALID_ROUTES = [
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/pending-approval",
  "/admin/login", // in-scope login for the installed PWA
  "/admin/pending-approval", // in-scope pending-approval for the installed PWA
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/units",
  "/admin/guests",
  "/admin/expenses",
  "/admin/payments",
  "/admin/availability",
  "/admin/settings",
];
```

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/__tests__/auth.test.ts -t "in-scope admin auth routes"`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat(auth): allowlist /admin/login and /admin/pending-approval for safe redirects"
```

---

## Task 4: Repoint `auth.ts` in-app redirects to `/admin/login`

These fire for a logged-in operator whose session expires or who signs out — i.e. always inside the PWA. Public/guest flows never trigger them (no session).

**Files:**

- Modify: `src/lib/auth.ts:139`, `:301`, `:381`
- Test: `src/lib/__tests__/auth.test.ts`

**Step 1: Write the failing test** (verifies the public `safeRedirect` path used via `auth.handleRedirect`)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";

describe("auth redirect targets point in-scope", () => {
  let replaceSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    replaceSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace: replaceSpy, origin: "https://example.com" },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("sends an invalid redirect to /admin/login (not /login)", () => {
    auth.handleRedirect("/definitely-not-a-valid-route");
    expect(replaceSpy).toHaveBeenCalledWith("/admin/login");
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts -t "redirect targets point in-scope"`
Expected: FAIL — called with `/login`.

**Step 3: Make the three edits**

- `src/lib/auth.ts:139` (inside `safeRedirect`): `window.location.replace("/login")` → `window.location.replace("/admin/login")`
- `src/lib/auth.ts:301` (inside `handleSessionExpired`): `const loginRoute = "/login";` → `const loginRoute = "/admin/login";`
- `src/lib/auth.ts:381` (inside `preventBackButtonAccess`): `window.location.replace("/login")` → `window.location.replace("/admin/login")`

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/__tests__/auth.test.ts -t "redirect targets point in-scope"`
Expected: PASS. (If the happy-dom `window.location` redefine is rejected, use `vi.stubGlobal` or the project's existing location-mock helper — check other tests in `src/**/__tests__` for the established pattern.)

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat(auth): keep session-expiry and back-button redirects inside /admin scope"
```

---

## Task 5: Create the non-nested `/admin/login` route

**Files:**

- Create: `src/routes/admin_.login.tsx`

**Step 1: Create the route** (trailing-underscore file name → URL `/admin/login`, un-nested from `admin.tsx`)

```tsx
import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";

import { LoginScreen, loginSearchSchema } from "@/components/auth/LoginScreen";

export const Route = createFileRoute("/admin_/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { redirect: redirectTo, registered, confirmed } = useSearch({ from: "/admin_/login" });
  return <LoginScreen redirectTo={redirectTo} registered={registered} confirmed={confirmed} />;
}
```

**Step 2: Regenerate route tree + type-check**

Run: `npm run dev` (let it boot so the router plugin regenerates `routeTree.gen.ts`, then stop it) — or `npm run build`.
Then: `npm run type-check`
Expected: `routeTree.gen.ts` now includes `/admin_/login`; no type errors. If TS reports the exact `from`/route-id literal differs, use the literal it suggests.

**Step 3: Commit**

```bash
git add src/routes/admin_.login.tsx src/routeTree.gen.ts
git commit -m "feat(routes): add in-scope /admin/login (non-nested, escapes admin guard)"
```

---

## Task 6: Create the non-nested `/admin/pending-approval` route

**Files:**

- Create: `src/routes/admin_.pending-approval.tsx`

**Step 1: Create the route** (mirrors root `pending-approval.tsx`, but redirects in-scope)

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

import { PendingApprovalPage } from "@/components/auth/PendingApprovalPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/admin_/pending-approval")({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/admin/login" });
    }
    const { getUserAuditRole } = await import("@/lib/audit-roles");
    const role = await getUserAuditRole();
    if (role !== null) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AdminPendingApprovalRoute,
});

function AdminPendingApprovalRoute() {
  return (
    <ErrorBoundary level="page">
      <PendingApprovalPage />
    </ErrorBoundary>
  );
}
```

**Step 2: Regenerate + type-check**

Run: `npm run type-check` (after route tree regenerates)
Expected: no type errors.

**Step 3: Commit**

```bash
git add src/routes/admin_.pending-approval.tsx src/routeTree.gen.ts
git commit -m "feat(routes): add in-scope /admin/pending-approval (non-nested)"
```

---

## Task 7: Repoint the guard and sign-out buttons

**Files:**

- Modify: `src/routes/admin.tsx:13`, `:25`, `:48`
- Modify: `src/layouts/MainLayout.tsx:141`
- Modify: `src/components/auth/PendingApprovalPage.tsx:37`

**Step 1: Edit `src/routes/admin.tsx`**

- Line 13: `to: "/login"` → `to: "/admin/login"` (keep the `search: { redirect: location.href }`)
- Line 25: `throw redirect({ to: "/pending-approval" })` → `to: "/admin/pending-approval"`
- Line 48: `window.location.href = "/login";` → `window.location.href = "/admin/login";`

**Step 2: Edit `src/layouts/MainLayout.tsx:141`**

`window.location.href = "/login";` → `window.location.href = "/admin/login";`

**Step 3: Edit `src/components/auth/PendingApprovalPage.tsx:37`**

`window.location.href = "/login";` → `window.location.href = "/admin/login";`

**Step 4: Type-check + full unit suite**

Run: `npm run type-check && npm run test:run`
Expected: PASS. Watch for any existing test that asserts a redirect to `/login` from these code paths and update it to `/admin/login`.

**Step 5: Commit**

```bash
git add src/routes/admin.tsx src/layouts/MainLayout.tsx src/components/auth/PendingApprovalPage.tsx
git commit -m "feat(auth): repoint in-app auth redirects to in-scope /admin/login"
```

---

## Task 8: E2E — prove no redirect loop and correct in-scope redirect

**Files:**

- Create: `e2e/admin-login-in-scope.spec.ts` (match the project's existing Playwright layout)

**Step 1: Write the E2E test**

```ts
import { expect, test } from "@playwright/test";

test.describe("admin login is in /admin scope", () => {
  test("logged-out visit to /admin redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin/login renders and does NOT loop (guard is escaped)", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login/); // stays put
    await expect(page.getByText("Okaeri Resort System")).toBeVisible();
  });
});
```

**Step 2: Run it**

Run: `npm run test:e2e -- admin-login-in-scope`
Expected: PASS. A failure on test 2 (URL bouncing / timeout) means the route is still nested under the guard — recheck the `admin_.` filename and that `routeTree.gen.ts` shows it un-nested.

**Step 3: Commit**

```bash
git add e2e/admin-login-in-scope.spec.ts
git commit -m "test(e2e): verify /admin/login is in-scope and loop-free"
```

---

## Task 9: Final verification & manual PWA smoke test

**Step 1: Full verify**

Run: `npm run verify`
Expected: type-check + lint + unit tests all PASS.

**Step 2: Manual smoke test (build + preview, then install)**

```bash
npm run build && npm run preview
```

Then in Chrome:

1. Visit the public landing (`/`) → confirm **no install prompt** is offered (out of scope).
2. Visit `/admin` logged out → lands on `/admin/login`, no loop.
3. Log in → reach `/admin/dashboard`.
4. Install the app (address-bar install icon / DevTools → Application → Manifest → "Install") → confirm `scope: /admin`, `start_url: /admin`.
5. In the installed window: sign out → confirm it stays in the standalone window at `/admin/login` (does **not** pop out to a browser tab).
6. (Optional) Clear the Supabase session in storage, relaunch the installed app → confirm it opens to `/admin/login` in-window.

**Step 3: Confirm no Supabase change was needed**

Password-reset and email-confirmation still point at root `/reset-password` and `/login?confirmed=true` (browser/email contexts) — untouched, so the Supabase Auth redirect allowlist needs **no update**. Verify a password-reset email still round-trips in a normal browser.

---

## Out of scope (future, optional)

- **Piece 2 — custom in-app "Install app" button** (`beforeinstallprompt` capture + iOS "Add to Home Screen" hint). Independent; can be its own small plan.
- Moving `forgot-password` / `reset-password` / `sign-up` into `/admin` scope. Only worth it if operators frequently start those flows _from inside_ the installed app; it would require updating `functions/api/auth/*` redirect targets **and** the Supabase dashboard allowlist.
- Deleting the stale `src/constants/routes.ts`.
- Redirecting root `/login` → `/admin/login` when running standalone (YAGNI unless a concrete need appears).
