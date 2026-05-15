# PWA Conversion — Design

**Date:** 2026-05-16
**Status:** Approved (ready for implementation plan)
**Scope:** Convert Okaeri Resort Management System into an installable PWA with asset precaching and an in-app update prompt.

---

## Goals

1. **Installable on mobile** for authenticated staff/owners (home-screen icon, standalone display).
2. **Faster repeat-visit load** via service-worker precaching of static assets.
3. **In-app "new version available" notification** with a Reload action, triggered when a new build is deployed.

## Non-Goals

- No offline support. Network must be available for all data operations.
- No background sync.
- No push notifications.
- No caching of `/api/**` or Supabase traffic. TanStack Query continues to be the sole client-side cache for dynamic data.
- No PWA install UX on the public `/guest-booking` portal.

## Existing State

- `public/manifest.json` already exists with icons, shortcuts, theme color, and `display: standalone`.
- `index.html` already includes Apple/mobile meta tags and `<link rel="manifest">`.
- No service worker, no `vite-plugin-pwa`, no install or update UX.

---

## Architecture

**New dependency:** `vite-plugin-pwa` (devDependency). Wraps Workbox under the hood. Configured in `generateSW` mode.

**Manifest handling:** The plugin is configured to reference the existing `public/manifest.json` rather than generate a new one, preserving curated fields (`shortcuts`, `categories`, `lang`, `dir`).

**New files:**

- `src/components/pwa/UpdateToast.tsx` — sonner toast bound to `useRegisterSW()` from `virtual:pwa-register/react`.
- `src/components/pwa/InstallBanner.tsx` — sticky banner under navbar for authenticated users.
- `src/stores/useInstallPromptStore.ts` — Zustand store holding the captured `BeforeInstallPromptEvent` ref, dismissal state, and `triggerInstall()` action.
- `e2e/pwa-install-banner.spec.ts` — Playwright spec for banner visibility, dismissal, snooze, and escape-hatch flows.

**Modified files:**

- `vite.config.ts` — register `VitePWA` plugin.
- `src/main.tsx` (or `src/routes/__root.tsx`) — register the SW and mount `<UpdateToast />`.
- The authenticated app layout — mount `<InstallBanner />` directly below the top navbar.
- The authenticated user dropdown menu — add "Install app" escape-hatch entry.
- `package.json` — add `vite-plugin-pwa` devDependency.

**Rollout gate:** `VITE_PWA_ENABLED` env flag. The plugin is conditionally registered in `vite.config.ts` based on this flag. The flag is removed after one stable production cycle.

---

## Caching Policy

| Resource                                   | Strategy                            | Rationale                                                                                                     |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Hashed JS/CSS chunks (`assets/*.{js,css}`) | `CacheFirst`, immutable             | Hashes change on every deploy. Safe to cache aggressively.                                                    |
| Fonts, icons, static images in `/public`   | `CacheFirst` with 30-day expiration | Low risk, cheap perf win.                                                                                     |
| `index.html`                               | **Not cached by SW**                | Browser handles normally. The precache version replaces itself on activation. Keeps deploys propagating fast. |
| `/api/**` (Cloudflare Functions)           | **Network-only, never cached**      | Includes guest booking, payments, audit logging. Caching here = data integrity bugs.                          |
| Supabase REST/Realtime traffic             | **Network-only, never cached**      | Same reasoning. TanStack Query owns client-side caching.                                                      |
| Auth tokens, cookies                       | Never touched by SW                 | The SW does not intercept credentialed requests in this config.                                               |

The single most important line in this design: **the SW does not cache any dynamic data or any authenticated traffic.** This eliminates ~90% of bugs typical to PWA migrations (stale lists, double-bookings, missed payments).

---

## Install Prompt UX

**Component:** `<InstallBanner />` — sticky, full-width, mounted directly below the top navbar within the authenticated app layout.

**Visibility logic (precedence order):**

| Condition                                                        | State                                                                                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `display-mode: standalone` matches (already installed)           | Hidden                                                                                                                            |
| `localStorage["pwa-install-dismissed-permanently"] === "true"`   | Hidden                                                                                                                            |
| `localStorage["pwa-install-snoozed-until"]` is a future ISO date | Hidden                                                                                                                            |
| User is not authenticated                                        | Hidden                                                                                                                            |
| Chrome/Edge/Android + `beforeinstallprompt` fired                | Shown with **[Install]** + **[Maybe later]** + **[Don't show again]**                                                             |
| iOS Safari, `navigator.standalone === false`                     | Shown with text-only instructions: "Tap the Share button, then 'Add to Home Screen'" + **[Maybe later]** + **[Don't show again]** |
| Other unsupported browsers (Firefox desktop, etc.)               | Hidden                                                                                                                            |

**Snooze:** "Maybe later" sets `pwa-install-snoozed-until` to `now + 7 days`. Banner re-appears after expiry.

**Escape hatch:** "Install app" entry in the user dropdown menu clears both `pwa-install-dismissed-permanently` and `pwa-install-snoozed-until`, then re-shows the banner. Covers the common case where a user mis-clicks "Don't show again."

**State management:** Zustand store (`useInstallPromptStore`) holds:

- `installPromptEvent: BeforeInstallPromptEvent | null`
- `dismissalState: 'visible' | 'snoozed' | 'permanent' | 'installed'`
- Actions: `captureEvent`, `triggerInstall`, `snoozeForDays(7)`, `dismissPermanently`, `reset`

Keeping the captured event in a store (not React state) avoids stale-closure bugs around the `beforeinstallprompt` event ref.

---

## Update Notification UX

**Mechanism:** `useRegisterSW()` hook from `virtual:pwa-register/react`.

**Behavior:**

1. On app boot, SW is registered with `immediate: true`. Plugin polls for updates every 60 minutes and on every window focus event.
2. When a new SW is detected, `needRefresh` becomes `true`.
3. `<UpdateToast />` calls `sonner.message()` to show a **persistent (non-auto-dismiss) toast** at the sonner default position (top-right, matching the rest of the app):

   > **A new version of Okaeri is available.** [Reload] [Later]

4. **Reload** → calls `updateServiceWorker(true)`, activates the new SW, reloads the page.
5. **Later** → dismisses the toast for the current session only. Returns on next page navigation or window focus.

**Form-state safety:** No suppression of the toast when forms are dirty. The user clicks Reload of their own accord — that constitutes consent to lose unsaved input, matching normal browser-refresh semantics. Building cross-app dirty-form detection is explicitly out of scope.

**Multi-tab reload:** When one tab calls `updateServiceWorker(true)`, other open tabs listen on `navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())` and auto-reload. Prevents UI/API version skew when staff have multiple tabs open.

---

## Error Handling & Edge Cases

| Scenario                                        | Behavior                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| SW registration fails                           | App functions normally. Logged to console. Not sent to audit log.                                                                             |
| Update poll fails                               | Silent retry on next interval.                                                                                                                |
| `updateServiceWorker(true)` fails               | Toast stays visible; user can retry or hard-refresh.                                                                                          |
| Two tabs open during update                     | First tab to click Reload activates the new SW; others auto-reload via `controllerchange`.                                                    |
| Deploy rollback (v3 → v2)                       | Brief window of mismatch possible; self-healing on next SW lifecycle event. For true emergency rollback, ship a `selfDestroying: true` build. |
| User logs out while installed                   | App still works. Banner stays hidden (standalone display mode).                                                                               |
| `beforeinstallprompt` fires before login        | Captured globally in the Zustand store; banner reveals after authentication.                                                                  |
| iOS Safari user                                 | Banner shows manual Share → Add to Home Screen instructions.                                                                                  |
| Banner dismissed permanently, user changes mind | Escape hatch in user dropdown menu clears localStorage flags and re-shows banner.                                                             |

---

## Testing

### Unit / integration (Vitest)

- Mock `virtual:pwa-register/react` in `vitest.setup.ts` to return a controllable `{ needRefresh, updateServiceWorker }`.
- Test `useInstallPromptStore`: `beforeinstallprompt` capture, dismissal transitions, 7-day snooze expiry, `display-mode: standalone` detection.
- Test `<UpdateToast />`: shows when `needRefresh === true`, calls `updateServiceWorker(true)` on Reload click.

### E2E (Playwright)

- One new spec: `e2e/pwa-install-banner.spec.ts`
  - Banner shows for authenticated users (Chrome).
  - "Don't show again" persists across reload.
  - "Maybe later" respects 7-day snooze (via clock injection).
  - Dropdown escape hatch re-shows the banner.
- SW lifecycle E2E **skipped**. Workbox is extensively upstream-tested; the cost/value of orchestrating two builds + two browser contexts is poor at this scope.

### Manual QA checklist

- [ ] Chrome desktop: install prompt appears; install works; update toast appears after deploying a new version.
- [ ] Chrome Android: install prompt → home-screen icon → standalone mode.
- [ ] iOS Safari: banner shows manual instructions; Share → Add to Home Screen works; opens in standalone.
- [ ] Firefox desktop: no install banner (expected); app works as a regular site.
- [ ] Two-tab update test: open in two tabs, deploy new version, verify both tabs reload after one Reload click.

### Verification commands

```bash
npm run verify          # type-check, lint, unit tests
npm run test:e2e        # includes new PWA banner spec
npm run build           # SW + precache manifest emitted into dist/
npm run preview         # production build served locally; inspect Application → Service Workers in DevTools
```

---

## Rollout

1. Land behind `VITE_PWA_ENABLED=true` for preview deploys only.
2. Run manual QA checklist on a preview deploy.
3. Set `VITE_PWA_ENABLED=true` for production.
4. Observe for one stable cycle (1–2 weeks). Verify update toast fires on the next deploy.
5. Remove the flag.

### Rollback Plan

- **Bad SW shipped:** ship a `selfDestroying: true` deploy, which causes installed SWs to unregister themselves on next activation.
- **Bad UX (banner, toast):** disable `VITE_PWA_ENABLED` in production environment variables; redeploy. The previously installed SW persists for users who installed but stops being re-served to new visitors.
- **Full revert:** remove `vite-plugin-pwa` from `package.json` and the plugin call from `vite.config.ts`. Ship a `selfDestroying: true` build first if any users are confirmed to have an installed SW.

---

## Estimated Effort & Risk

- **Effort:** 1–2 days for a single engineer end to end (plugin config, two components, store, tests, manual QA).
- **Risk:** Low. No dynamic data is cached. Env-flag rollout. Multiple rollback paths.
- **Bundle impact:** +~10–15KB gzipped (Workbox runtime).
- **First-load time:** effectively unchanged. SW installs after page renders.
- **Repeat-visit time:** noticeably faster — precached chunks served from disk.

---

## Decisions Recap

| Question                              | Decision                                                            |
| ------------------------------------- | ------------------------------------------------------------------- |
| Motivation                            | Installable + faster repeat load + update-notification prompt       |
| Install scope                         | Authenticated staff/owners only                                     |
| Approach                              | Option A — Minimal (no HTML caching, no API caching)                |
| Install UX                            | Prominent sticky banner under navbar; iOS shows manual instructions |
| "Maybe later" snooze                  | 7 days                                                              |
| Update toast position                 | sonner default (top-right) — consistency with existing toasts       |
| Multi-tab reload                      | Yes — auto-reload other tabs via `controllerchange`                 |
| Form-state preservation during update | None — user-initiated reload is consent                             |
| Rollout                               | Behind `VITE_PWA_ENABLED` env flag                                  |
