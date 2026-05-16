# PWA Rollout Checklist

Run through every box on a preview deploy before promoting to production. The PWA is unconditionally enabled in this codebase — there is no env-flag kill switch. Rollback requires shipping a new build (see "Rollback dry-run" below).

## Pre-deploy (preview environment)

- [ ] Preview deploy completed; `dist/sw.js` and `dist/workbox-*.js` present
- [ ] DevTools → Application → Service Workers: SW registered + activated
- [ ] DevTools → Application → Manifest: all icons load, theme color correct, shortcuts present

## Cross-browser install + uninstall

- [ ] Chrome desktop: install prompt appears → install completes → app opens in standalone window
- [ ] Chrome Android: banner appears → "Install" → home-screen icon → opens in standalone
- [ ] Edge desktop: same as Chrome
- [ ] iOS Safari: banner shows manual instructions → Share → Add to Home Screen → opens in standalone
- [ ] Firefox desktop: banner does NOT appear (expected); regular site works normally

## Snooze & dismiss

- [ ] Click "Maybe later" → banner disappears
- [ ] Reload → banner does not reappear
- [ ] Manually edit `pwa-install-snoozed-until` localStorage to a past ISO date → banner reappears
- [ ] Click "Don't show again" → banner disappears
- [ ] Reload → banner does not reappear
- [ ] Click sidebar "Install app" escape hatch → banner reappears (same page, no reload required)

## Update flow

- [ ] Deploy a new version to preview (any trivial code change)
- [ ] Open the preview in an already-loaded tab → wait up to 60 minutes OR trigger focus event by tab-switching
- [ ] Update toast appears at top-right: "A new version of Okaeri is available."
- [ ] Click "Reload" → page reloads → new build is active
- [ ] Click "Later" → toast dismisses → returns on next focus event

## Multi-tab

- [ ] Open the app in two tabs of the same browser
- [ ] Deploy a new version to preview
- [ ] Wait for update toast → click "Reload" in tab A
- [ ] Tab B auto-reloads within ~1 second (via `controllerchange` listener)

## Data integrity (the most important section)

- [ ] Network tab: `/api/**` requests are NOT served from `(ServiceWorker)` cache
- [ ] Network tab: `https://*.supabase.co/*` requests are NOT served from `(ServiceWorker)` cache
- [ ] Make a booking change in tab A → verify it appears in tab B (via TanStack Query / Supabase Realtime, NOT cached)
- [ ] `grep -c "NetworkOnly" dist/sw.js` returns ≥ 1
- [ ] `grep -E "supabase|api/" dist/sw.js` shows the matches inside `NetworkOnly` handler context, not in the precache manifest

## Rollback dry-run

There is no env flag to flip. Three rollback strategies, in increasing severity:

1. **Bad UX (banner text wrong, toast misbehaves)** — fix forward: ship a new build with the corrected component. Old SWs auto-update on next visit.
2. **Bad SW (precache shape wrong, runtime cache rule wrong)** — ship a new build configured with `selfDestroying: true` in `vite.config.ts`. On next visit, installed SWs unregister themselves, then a follow-up build can re-introduce the SW cleanly.
3. **Full revert** — remove the `VitePWA(...)` block from `vite.config.ts` AND ship a `selfDestroying: true` deploy first so installed clients clean up.

- [ ] Reviewer confirms the `selfDestroying: true` recipe is documented (see `node_modules/vite-plugin-pwa/README.md` or upstream docs)

## Production gate

- [ ] All boxes above checked on preview
- [ ] Production deploy completed
- [ ] Smoke check on production: visit, look for SW in DevTools → Application
- [ ] Verify update toast fires on the next subsequent production deploy
- [ ] Monitor user-facing error logs for 1–2 weeks for unexpected SW-related issues
