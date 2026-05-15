# PWA Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert Okaeri into an installable PWA with static-asset precaching, a sticky install banner for authenticated staff/owners, and an in-app "new version available" toast.

**Architecture:** Add `vite-plugin-pwa` (Workbox under the hood) in `generateSW` mode behind a `VITE_PWA_ENABLED` env flag. Precache only hashed JS/CSS chunks and static images; the service worker **never** intercepts `/api/**` or Supabase traffic. UI consists of two new components (`<InstallBanner />` and `<UpdateToast />`) plus one Zustand store (`useInstallPromptStore`). Multi-tab safety via `controllerchange` auto-reload. Reuses the existing `public/manifest.json` unchanged.

**Tech Stack:** Vite 7, React 19, TypeScript, TanStack Router, Zustand, sonner, Vitest, Playwright. New: `vite-plugin-pwa` (devDep), Workbox runtime (~10–15 KB gzipped, transitive).

**Design Doc:** `docs/plans/2026-05-16-pwa-design.md` — read before implementing.

---

## Pre-flight

- Read `docs/plans/2026-05-16-pwa-design.md` end to end before starting.
- Confirm you are on a working branch off `main`, not on `main` itself.
- Confirm a clean working tree: `git status` shows no uncommitted changes.

---

## Task 1: Install `vite-plugin-pwa`

**Files:**

- Modify: `package.json` (devDependencies)
- Modify: `package-lock.json` (auto)

**Step 1: Install the plugin**

Run: `npm install --save-dev vite-plugin-pwa@latest workbox-window@latest`

(Workbox-window is needed for the registration runtime that `vite-plugin-pwa` uses for its update-detection hook. Install it explicitly so the lockfile is deterministic.)

**Step 2: Verify the install**

Run: `npx vite-plugin-pwa --version` (this command may not exist; alternative below)
Run: `node -e "console.log(require('vite-plugin-pwa/package.json').version)"`
Expected: A version string printed, e.g. `1.0.0` or similar.

**Step 3: Verify build still works**

Run: `npm run build`
Expected: Build succeeds with no new errors. The plugin is installed but not yet wired up, so the build output should be identical to before.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(pwa): install vite-plugin-pwa devDependency"
```

---

## Task 2: Add TypeScript reference for `virtual:pwa-register/react`

**Files:**

- Create: `src/types/pwa.d.ts`

**Step 1: Create the type-reference shim**

Create `src/types/pwa.d.ts` with:

```typescript
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
```

**Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: No new errors. (Pre-existing errors are tolerated per Phase-2 threshold.)

**Step 3: Commit**

```bash
git add src/types/pwa.d.ts
git commit -m "types(pwa): add ambient types for virtual:pwa-register and BeforeInstallPromptEvent"
```

---

## Task 3: Add `VITE_PWA_ENABLED` env flag to env files

**Files:**

- Modify: `.env.example`
- Modify: `.env.local`
- Modify: `.env.production`

**Step 1: Add the flag to `.env.example` (documented default: off)**

Append to `.env.example`:

```
# PWA — set to "true" to enable service worker + install/update UX
VITE_PWA_ENABLED=false
```

**Step 2: Add the flag to `.env.local` (dev: off initially)**

Append to `.env.local`:

```
VITE_PWA_ENABLED=false
```

**Step 3: Add the flag to `.env.production` (production: off until QA complete)**

Append to `.env.production`:

```
VITE_PWA_ENABLED=false
```

**Step 4: Commit**

```bash
git add .env.example .env.local .env.production
git commit -m "config(pwa): add VITE_PWA_ENABLED env flag (default off)"
```

---

## Task 4: Wire `VitePWA` plugin conditionally in `vite.config.ts`

**Files:**

- Modify: `vite.config.ts`

**Step 1: Import the plugin and read env flag**

At the top of `vite.config.ts` add:

```typescript
import { VitePWA } from "vite-plugin-pwa";
```

In `defineConfig(({ mode }) => ({ ... }))`, before the `plugins` array, load the env vars:

```typescript
// Read env so we can gate the PWA plugin
import { loadEnv } from "vite";

// ...
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const pwaEnabled = env.VITE_PWA_ENABLED === "true";

  return {
    plugins: [
      // existing plugins...
      pwaEnabled &&
        VitePWA({
          registerType: "prompt",
          // Use existing public/manifest.json; do not generate one
          manifest: false,
          injectRegister: null,
          workbox: {
            // Precache hashed build assets only
            globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
            // Never cache API or Supabase traffic
            navigateFallback: null,
            runtimeCaching: [
              {
                urlPattern: ({ url }) =>
                  url.pathname.startsWith("/api/") ||
                  url.hostname.endsWith("supabase.co") ||
                  url.hostname.endsWith("supabase.in"),
                handler: "NetworkOnly",
              },
            ],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: false, // user-driven activation via UpdateToast
          },
          devOptions: {
            enabled: false, // never in dev to avoid surprise SWs during development
          },
        }),
      // ...remaining existing plugins (visualizer, etc.)
    ].filter(Boolean),
    // ...rest of config unchanged
  };
});
```

Apply the change carefully — keep the existing `tanstackRouter`, `react()`, `tsconfigPaths()`, `tailwindcss()`, and `visualizer` plugins in their current order. The `VitePWA` call slots in after them but before `.filter(Boolean)`.

**Step 2: Verify build with flag OFF**

Run: `npm run build`
Expected: Build succeeds. `dist/` contains **no** `sw.js` and no `registerSW.js`.

Verify with: `ls dist/sw.js 2>/dev/null && echo FOUND || echo "OK: no sw.js"`
Expected: `OK: no sw.js`

**Step 3: Verify build with flag ON**

Run: `VITE_PWA_ENABLED=true npm run build`
Expected: Build succeeds. `dist/` contains `sw.js` and `workbox-*.js`.

Verify with: `ls dist/sw.js && ls dist/workbox-*.js`
Expected: Both files exist.

**Step 4: Verify no API caching in generated SW**

Run: `grep -c "NetworkOnly" dist/sw.js`
Expected: At least 1 match.

Run: `grep -E "supabase|api/" dist/sw.js | head -3`
Expected: References should appear within `NetworkOnly` handler contexts, not in precache lists.

**Step 5: Reset flag back to off**

Reset the local env so subsequent builds default off:

```bash
unset VITE_PWA_ENABLED
```

**Step 6: Commit**

```bash
git add vite.config.ts
git commit -m "build(pwa): wire vite-plugin-pwa behind VITE_PWA_ENABLED flag with no-API-cache policy"
```

---

## Task 5: Write failing test for `useInstallPromptStore`

**Files:**

- Create: `src/stores/__tests__/useInstallPromptStore.test.ts`

**Step 1: Write the test**

Create the test file with:

```typescript
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPromptStore } from "../useInstallPromptStore";

const SNOOZE_KEY = "pwa-install-snoozed-until";
const DISMISS_KEY = "pwa-install-dismissed-permanently";

function makePromptEvent(): BeforeInstallPromptEvent {
  return {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
}

describe("useInstallPromptStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useInstallPromptStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with dismissalState 'visible' and no captured event", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    expect(result.current.dismissalState).toBe("visible");
    expect(result.current.installPromptEvent).toBeNull();
  });

  it("captures a beforeinstallprompt event", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const event = makePromptEvent();
    act(() => {
      result.current.captureEvent(event);
    });
    expect(result.current.installPromptEvent).toBe(event);
  });

  it("dismissPermanently sets state and persists in localStorage", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    act(() => {
      result.current.dismissPermanently();
    });
    expect(result.current.dismissalState).toBe("permanent");
    expect(localStorage.getItem(DISMISS_KEY)).toBe("true");
  });

  it("snoozeForDays sets a future ISO date and state 'snoozed'", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const now = new Date("2026-05-16T00:00:00Z");
    vi.setSystemTime(now);
    act(() => {
      result.current.snoozeForDays(7);
    });
    const stored = localStorage.getItem(SNOOZE_KEY);
    expect(stored).not.toBeNull();
    const until = new Date(stored!);
    const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(until.toISOString()).toBe(expected.toISOString());
    expect(result.current.dismissalState).toBe("snoozed");
  });

  it("rehydrates 'permanent' from localStorage on init", () => {
    localStorage.setItem(DISMISS_KEY, "true");
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("permanent");
  });

  it("rehydrates 'snoozed' when localStorage date is in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, future);
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("snoozed");
  });

  it("treats expired snooze as 'visible' and clears the key", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, past);
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("visible");
    expect(localStorage.getItem(SNOOZE_KEY)).toBeNull();
  });

  it("reset clears all dismissal state and storage keys", () => {
    localStorage.setItem(DISMISS_KEY, "true");
    localStorage.setItem(SNOOZE_KEY, "anything");
    useInstallPromptStore.getState().reset();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(localStorage.getItem(SNOOZE_KEY)).toBeNull();
    expect(useInstallPromptStore.getState().dismissalState).toBe("visible");
  });

  it("triggerInstall calls prompt() on the captured event and clears it", async () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const event = makePromptEvent();
    act(() => {
      result.current.captureEvent(event);
    });
    await act(async () => {
      await result.current.triggerInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.installPromptEvent).toBeNull();
  });

  it("triggerInstall is a no-op when no event captured", async () => {
    const { result } = renderHook(() => useInstallPromptStore());
    await act(async () => {
      await result.current.triggerInstall();
    });
    expect(result.current.installPromptEvent).toBeNull();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/stores/__tests__/useInstallPromptStore.test.ts`
Expected: FAIL — module `../useInstallPromptStore` does not exist.

**Step 3: Commit (red)**

```bash
git add src/stores/__tests__/useInstallPromptStore.test.ts
git commit -m "test(pwa): add failing tests for useInstallPromptStore"
```

---

## Task 6: Implement `useInstallPromptStore`

**Files:**

- Create: `src/stores/useInstallPromptStore.ts`

**Step 1: Implement the store**

Create `src/stores/useInstallPromptStore.ts` with:

```typescript
import { create } from "zustand";

type DismissalState = "visible" | "snoozed" | "permanent" | "installed";

interface InstallPromptState {
  installPromptEvent: BeforeInstallPromptEvent | null;
  dismissalState: DismissalState;
  captureEvent: (event: BeforeInstallPromptEvent) => void;
  triggerInstall: () => Promise<void>;
  snoozeForDays: (days: number) => void;
  dismissPermanently: () => void;
  markInstalled: () => void;
  reset: () => void;
}

const SNOOZE_KEY = "pwa-install-snoozed-until";
const DISMISS_KEY = "pwa-install-dismissed-permanently";

function readInitialDismissalState(): DismissalState {
  if (typeof window === "undefined") return "visible";
  if (localStorage.getItem(DISMISS_KEY) === "true") return "permanent";
  const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
  if (snoozeUntil) {
    const until = new Date(snoozeUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
      return "snoozed";
    }
    localStorage.removeItem(SNOOZE_KEY);
  }
  return "visible";
}

export const useInstallPromptStore = create<InstallPromptState>((set, get) => ({
  installPromptEvent: null,
  dismissalState: readInitialDismissalState(),

  captureEvent: (event) => set({ installPromptEvent: event }),

  triggerInstall: async () => {
    const event = get().installPromptEvent;
    if (!event) return;
    await event.prompt();
    set({ installPromptEvent: null });
  },

  snoozeForDays: (days) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, until);
    set({ dismissalState: "snoozed" });
  },

  dismissPermanently: () => {
    localStorage.setItem(DISMISS_KEY, "true");
    set({ dismissalState: "permanent" });
  },

  markInstalled: () => set({ dismissalState: "installed" }),

  reset: () => {
    localStorage.removeItem(SNOOZE_KEY);
    localStorage.removeItem(DISMISS_KEY);
    set({
      installPromptEvent: null,
      dismissalState: readInitialDismissalState(),
    });
  },
}));
```

**Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/stores/__tests__/useInstallPromptStore.test.ts`
Expected: All tests PASS.

**Step 3: Lint and type-check the new file**

Run: `npm run lint -- src/stores/useInstallPromptStore.ts`
Run: `npm run type-check`
Expected: No errors on the new file.

**Step 4: Commit (green)**

```bash
git add src/stores/useInstallPromptStore.ts
git commit -m "feat(pwa): add useInstallPromptStore for capture/dismiss/snooze state"
```

---

## Task 7: Wire `beforeinstallprompt` capture and `appinstalled` listener

**Files:**

- Modify: `src/main.tsx`

**Step 1: Add the global event listeners**

Open `src/main.tsx` and add this block before the `ReactDOM.createRoot(...)` call (or at the top-level module scope, after imports):

```typescript
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPromptStore.getState().captureEvent(event as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    useInstallPromptStore.getState().markInstalled();
  });

  // If we're running in standalone mode (already installed), reflect that
  if (window.matchMedia("(display-mode: standalone)").matches) {
    useInstallPromptStore.getState().markInstalled();
  }
}
```

If `src/main.tsx` does not exist or has a different name (e.g. `src/main.ts`), apply the same to that entry file.

**Step 2: Verify dev server still boots**

Run: `npm run dev` and wait for "ready in".
Expected: Server starts on port 5173, no console errors at boot. Kill the dev server (Ctrl+C).

**Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(pwa): capture beforeinstallprompt event globally"
```

---

## Task 8: Write failing test for `<InstallBanner />`

**Files:**

- Create: `src/components/pwa/__tests__/InstallBanner.test.tsx`

**Step 1: Write the test**

Create `src/components/pwa/__tests__/InstallBanner.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallBanner } from "../InstallBanner";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

function makePromptEvent() {
  return {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
}

describe("<InstallBanner />", () => {
  beforeEach(() => {
    localStorage.clear();
    useInstallPromptStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when dismissalState is 'permanent'", () => {
    useInstallPromptStore.getState().dismissPermanently();
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when dismissalState is 'snoozed'", () => {
    useInstallPromptStore.getState().snoozeForDays(7);
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when dismissalState is 'installed'", () => {
    useInstallPromptStore.getState().markInstalled();
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Install button when beforeinstallprompt has fired", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    expect(screen.getByRole("button", { name: /install/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /maybe later/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /don't show again/i })).toBeInTheDocument();
  });

  it("renders iOS instructions when no event and userAgent looks like iOS Safari", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    render(<InstallBanner />);
    expect(screen.getByText(/share/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it("renders nothing when no event and not iOS Safari (e.g. Firefox)", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    });
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls triggerInstall when Install is clicked", () => {
    const event = makePromptEvent();
    useInstallPromptStore.getState().captureEvent(event);
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /install/i }));
    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it("snoozes for 7 days when Maybe later is clicked", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(useInstallPromptStore.getState().dismissalState).toBe("snoozed");
    const until = localStorage.getItem("pwa-install-snoozed-until");
    expect(until).not.toBeNull();
    const diffDays = (new Date(until!).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("dismisses permanently when Don't show again is clicked", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /don't show again/i }));
    expect(useInstallPromptStore.getState().dismissalState).toBe("permanent");
    expect(localStorage.getItem("pwa-install-dismissed-permanently")).toBe("true");
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/pwa/__tests__/InstallBanner.test.tsx`
Expected: FAIL — `../InstallBanner` does not exist.

**Step 3: Commit (red)**

```bash
git add src/components/pwa/__tests__/InstallBanner.test.tsx
git commit -m "test(pwa): add failing tests for InstallBanner"
```

---

## Task 9: Implement `<InstallBanner />`

**Files:**

- Create: `src/components/pwa/InstallBanner.tsx`

**Step 1: Write the component**

Create `src/components/pwa/InstallBanner.tsx`:

```typescript
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

export function InstallBanner() {
  const installPromptEvent = useInstallPromptStore((s) => s.installPromptEvent);
  const dismissalState = useInstallPromptStore((s) => s.dismissalState);
  const triggerInstall = useInstallPromptStore((s) => s.triggerInstall);
  const snoozeForDays = useInstallPromptStore((s) => s.snoozeForDays);
  const dismissPermanently = useInstallPromptStore((s) => s.dismissPermanently);

  if (dismissalState !== "visible") return null;

  const hasNativePrompt = installPromptEvent !== null;
  const ios = !hasNativePrompt && isIosSafari();

  if (!hasNativePrompt && !ios) return null;

  return (
    <div
      role="region"
      aria-label="Install Okaeri app"
      className="bg-primary/5 border-primary/20 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 sm:px-6"
    >
      <Download className="text-primary h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Okaeri for quick access</p>
        {ios ? (
          <p className="text-muted-foreground text-xs sm:text-sm">
            Tap the <span aria-label="Share">Share</span> button in Safari, then choose
            "Add to Home Screen".
          </p>
        ) : (
          <p className="text-muted-foreground text-xs sm:text-sm">
            Add Okaeri to your home screen for an app-like experience.
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {hasNativePrompt && (
          <Button size="sm" onClick={() => void triggerInstall()}>
            Install
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => snoozeForDays(7)}>
          Maybe later
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => dismissPermanently()}
          aria-label="Don't show again"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Don't show again</span>
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/components/pwa/__tests__/InstallBanner.test.tsx`
Expected: All tests PASS.

**Step 3: Lint and type-check**

Run: `npm run lint -- src/components/pwa/InstallBanner.tsx`
Run: `npm run type-check`
Expected: No errors on the new file.

**Step 4: Commit (green)**

```bash
git add src/components/pwa/InstallBanner.tsx
git commit -m "feat(pwa): add InstallBanner component with iOS fallback and snooze"
```

---

## Task 10: Mount `<InstallBanner />` in `MainLayout`

**Files:**

- Modify: `src/layouts/MainLayout.tsx`

**Step 1: Import the component**

Add to the imports at the top of `src/layouts/MainLayout.tsx`:

```typescript
import { InstallBanner } from "@/components/pwa/InstallBanner";
```

**Step 2: Render the banner inside the main content region**

Locate the JSX section that renders the main content area (a `<main>` element or the right-hand pane next to the sidebar). Render `<InstallBanner />` as the **first child** of that container so it sits above the page content but inside the scroll area.

If the layout returns a structure like:

```tsx
<main className="...">{children}</main>
```

change it to:

```tsx
<main className="...">
  <InstallBanner />
  {children}
</main>
```

Do **not** mount the banner outside `MainLayout` (e.g. in `__root.tsx`) — it must only appear for authenticated routes, and `MainLayout` is the gate.

**Step 3: Add an "Install app" escape-hatch button in the sidebar footer**

Locate the existing Sign Out button (around line 239 in the current `MainLayout.tsx` — there are two, one in the desktop sidebar and one in the mobile sheet). Above the desktop Sign Out button, add an "Install app" button that is visible only when the banner is dismissed:

```tsx
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

// ...
const dismissalState = useInstallPromptStore((s) => s.dismissalState);
const resetInstall = useInstallPromptStore((s) => s.reset);
// ...
{
  (dismissalState === "permanent" || dismissalState === "snoozed") && (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={() => resetInstall()}
    >
      <Download className="mr-2 h-4 w-4" /> Install app
    </Button>
  );
}
```

Add `Download` to the existing `lucide-react` imports if not already imported.

Apply the same escape-hatch button to the mobile sheet section (around the second Sign Out at line ~350) for parity.

**Step 4: Smoke test in dev**

Run: `npm run dev`
Open http://localhost:5173. Log in. Verify the dev server renders without console errors. (The banner won't fire `beforeinstallprompt` because dev mode disables PWA — that's expected. We're only checking the layout doesn't break.)
Stop the dev server.

**Step 5: Commit**

```bash
git add src/layouts/MainLayout.tsx
git commit -m "feat(pwa): mount InstallBanner in MainLayout with sidebar escape hatch"
```

---

## Task 11: Mock `virtual:pwa-register/react` in the test setup

**Files:**

- Modify: `src/test/setup.ts`

**Step 1: Add a default mock to the global test setup**

Append to `src/test/setup.ts` (after the existing matchMedia/IntersectionObserver mocks):

```typescript
// Default mock for vite-plugin-pwa's virtual module so component tests can render
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn().mockResolvedValue(undefined),
  }),
}));
```

Individual tests can override this with `vi.mocked(...)` or `vi.doMock(...)` when they need to assert update behavior.

**Step 2: Verify nothing breaks**

Run: `npm run test:run -- src/stores/__tests__/useInstallPromptStore.test.ts src/components/pwa/__tests__/InstallBanner.test.tsx`
Expected: All previous tests still PASS.

**Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test(pwa): add default mock for virtual:pwa-register/react"
```

---

## Task 12: Write failing test for `<UpdateToast />`

**Files:**

- Create: `src/components/pwa/__tests__/UpdateToast.test.tsx`

**Step 1: Write the test**

Create `src/components/pwa/__tests__/UpdateToast.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => useRegisterSWMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { toast } from "sonner";
import { UpdateToast } from "../UpdateToast";

describe("<UpdateToast />", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not show toast when needRefresh is false", () => {
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });
    render(<UpdateToast />);
    expect(toast.message).not.toHaveBeenCalled();
  });

  it("shows toast when needRefresh becomes true", () => {
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });
    render(<UpdateToast />);
    expect(toast.message).toHaveBeenCalledOnce();
    const [title, opts] = (toast.message as unknown as vi.Mock).mock.calls[0];
    expect(title).toMatch(/new version/i);
    expect(opts.duration).toBe(Infinity);
    expect(opts.action.label).toMatch(/reload/i);
    expect(opts.cancel.label).toMatch(/later/i);
  });

  it("calls updateServiceWorker(true) when Reload action is invoked", () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    const opts = (toast.message as unknown as vi.Mock).mock.calls[0][1];
    opts.action.onClick();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/pwa/__tests__/UpdateToast.test.tsx`
Expected: FAIL — `../UpdateToast` does not exist.

**Step 3: Commit (red)**

```bash
git add src/components/pwa/__tests__/UpdateToast.test.tsx
git commit -m "test(pwa): add failing tests for UpdateToast"
```

---

## Task 13: Implement `<UpdateToast />`

**Files:**

- Create: `src/components/pwa/UpdateToast.tsx`

**Step 1: Write the component**

Create `src/components/pwa/UpdateToast.tsx`:

```typescript
import { useEffect } from "react";

import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const TOAST_ID = "pwa-update-toast";

export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Poll for updates every 60 minutes
      setInterval(
        () => {
          void registration.update();
        },
        60 * 60 * 1000
      );
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast.message("A new version of Okaeri is available.", {
      id: TOAST_ID,
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      cancel: {
        label: "Later",
        onClick: () => {
          toast.dismiss(TOAST_ID);
        },
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
```

**Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/components/pwa/__tests__/UpdateToast.test.tsx`
Expected: All tests PASS.

**Step 3: Lint and type-check**

Run: `npm run lint -- src/components/pwa/UpdateToast.tsx`
Run: `npm run type-check`
Expected: No errors on the new file.

**Step 4: Commit (green)**

```bash
git add src/components/pwa/UpdateToast.tsx
git commit -m "feat(pwa): add UpdateToast component with persistent sonner toast"
```

---

## Task 14: Mount `<UpdateToast />` and add `controllerchange` auto-reload

**Files:**

- Modify: `src/routes/__root.tsx`
- Modify: `src/main.tsx`

**Step 1: Mount the toast in the root route**

Open `src/routes/__root.tsx` and in `RootComponent`, render `<UpdateToast />` next to `<Toaster />`:

```typescript
import { UpdateToast } from "@/components/pwa/UpdateToast";
// ...
function RootComponent() {
  return (
    <ErrorBoundary level="app">
      <div className="min-h-screen">
        <Outlet />
        <Toaster />
        <UpdateToast />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </div>
    </ErrorBoundary>
  );
}
```

**Step 2: Add controllerchange auto-reload in `src/main.tsx`**

Inside the same `if (typeof window !== "undefined") { ... }` block from Task 7 (the global event-listener block), add:

```typescript
let reloading = false;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
```

**Step 3: Verify dev server still boots**

Run: `npm run dev`
Visit http://localhost:5173, log in, verify no console errors. Kill the dev server.

**Step 4: Commit**

```bash
git add src/routes/__root.tsx src/main.tsx
git commit -m "feat(pwa): mount UpdateToast and auto-reload other tabs on SW activation"
```

---

## Task 15: End-to-end test for the install banner

**Files:**

- Create: `e2e/pwa-install-banner.spec.ts`

**Step 1: Write the Playwright spec**

Create `e2e/pwa-install-banner.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

const STORAGE_STATE_PATH = "e2e/.auth/staff.json";

test.describe("PWA install banner", () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test("does not show on routes outside MainLayout", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("region", { name: /install/i })).toHaveCount(0);
  });

  test("shows when beforeinstallprompt is simulated on an authenticated page", async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        const event = new Event("beforeinstallprompt") as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string; platform: string }>;
          platforms: string[];
        };
        event.prompt = async () => undefined;
        event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
        event.platforms = ["web"];
        window.dispatchEvent(event);
      });
    });
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("region", { name: /install/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /install/i })).toBeVisible();
  });

  test("Maybe later snoozes for 7 days", async ({ page, context }) => {
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        const event = new Event("beforeinstallprompt") as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string; platform: string }>;
          platforms: string[];
        };
        event.prompt = async () => undefined;
        event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
        event.platforms = ["web"];
        window.dispatchEvent(event);
      });
    });
    await page.goto("/admin/dashboard");
    await page.getByRole("button", { name: /maybe later/i }).click();
    await expect(page.getByRole("region", { name: /install/i })).toHaveCount(0);

    const storage = await context.storageState();
    const origin = storage.origins.find((o) => o.origin.includes("localhost"));
    const snooze = origin?.localStorage.find((kv) => kv.name === "pwa-install-snoozed-until");
    expect(snooze).toBeDefined();
    const until = new Date(snooze!.value).getTime();
    const diffDays = (until - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  test("Don't show again persists across reloads", async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        const event = new Event("beforeinstallprompt") as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string; platform: string }>;
          platforms: string[];
        };
        event.prompt = async () => undefined;
        event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
        event.platforms = ["web"];
        window.dispatchEvent(event);
      });
    });
    await page.goto("/admin/dashboard");
    await page.getByRole("button", { name: /don't show again/i }).click();
    await page.reload();
    await expect(page.getByRole("region", { name: /install/i })).toHaveCount(0);
  });

  test("sidebar Install app escape hatch re-shows the banner", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pwa-install-dismissed-permanently", "true");
      window.addEventListener("DOMContentLoaded", () => {
        const event = new Event("beforeinstallprompt") as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string; platform: string }>;
          platforms: string[];
        };
        event.prompt = async () => undefined;
        event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
        event.platforms = ["web"];
        window.dispatchEvent(event);
      });
    });
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("region", { name: /install/i })).toHaveCount(0);
    await page.getByRole("button", { name: /install app/i }).click();
    await expect(page.getByRole("region", { name: /install/i })).toBeVisible();
  });
});
```

**Step 2: Run the spec against a built preview**

The spec needs a built production-mode preview because the install banner only mounts when an authenticated user is logged in.

Run: `VITE_PWA_ENABLED=true npm run build && npm run preview &`
(Or use the existing Playwright config if it spins up its own server.)

Run: `npx playwright test e2e/pwa-install-banner.spec.ts`
Expected: All five tests PASS. If the storage-state file `e2e/.auth/staff.json` doesn't exist, the existing Playwright auth setup must run first (per `playwright.config.ts`).

Stop the preview server.

**Step 3: Commit**

```bash
git add e2e/pwa-install-banner.spec.ts
git commit -m "test(pwa): e2e tests for install banner visibility, snooze, and escape hatch"
```

---

## Task 16: Full verification pass

**Step 1: Run the full verify pipeline**

Run: `npm run verify`
Expected: type-check, lint, and unit tests all pass.

**Step 2: Build with PWA enabled and inspect output**

Run: `VITE_PWA_ENABLED=true npm run build`
Expected: Build succeeds. `dist/sw.js` exists. `dist/workbox-*.js` exists.

Run: `grep -c "supabase" dist/sw.js`
Expected: At least 1 (within the `NetworkOnly` runtime caching rule — meaning Supabase is excluded from cache, not precached).

Run: `grep -E "vendor-react|vendor-state" dist/sw.js | head -3`
Expected: References to your hashed vendor chunks appear in the precache manifest.

**Step 3: Preview and manually verify in a browser**

Run: `npm run preview`
Open http://localhost:4173 in Chrome DevTools → Application → Service Workers.
Expected:

- Service worker is registered and `activated`.
- Application → Manifest shows the existing `manifest.json` with all icons, shortcuts, theme color intact.
- Lighthouse → "Installable" check passes.
- Network tab: a hard refresh shows JS/CSS chunks served from `(ServiceWorker)`, while `/api/...` and Supabase requests show normal network status.

Stop the preview server.

**Step 4: Commit a tiny dev-experience tweak — add `npm run preview:pwa` script**

Open `package.json` and add this line in the `scripts` block:

```json
"preview:pwa": "VITE_PWA_ENABLED=true npm run build && npm run preview"
```

Run: `npm run preview:pwa`
Open http://localhost:4173 to confirm. Stop the preview.

**Step 5: Commit**

```bash
git add package.json
git commit -m "build(pwa): add preview:pwa script for local PWA verification"
```

---

## Task 17: Manual QA checklist and rollout note

**Files:**

- Create: `docs/plans/2026-05-16-pwa-rollout-checklist.md`

**Step 1: Write the checklist**

Create `docs/plans/2026-05-16-pwa-rollout-checklist.md`:

```markdown
# PWA Rollout Checklist

Run through every box on a preview deploy before flipping `VITE_PWA_ENABLED=true` in production.

## Pre-deploy (preview environment)

- [ ] Preview deploy built with `VITE_PWA_ENABLED=true`
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
- [ ] Click sidebar "Install app" escape hatch → banner reappears

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
- [ ] Tab B auto-reloads within ~1 second

## Data integrity

- [ ] Network tab: `/api/**` requests are NOT served from `(ServiceWorker)` cache
- [ ] Network tab: `https://*.supabase.co/*` requests are NOT served from `(ServiceWorker)` cache
- [ ] Make a booking change in tab A → verify it appears in tab B (via TanStack Query / Supabase Realtime, NOT cached)

## Rollback dry-run

- [ ] Set `VITE_PWA_ENABLED=false` → redeploy preview
- [ ] Existing installed SWs persist for users who installed (this is expected)
- [ ] New visitors get no SW registration
- [ ] Document the `selfDestroying: true` recipe for an emergency rollback in the project README or runbook

## Production gate

- [ ] All boxes above checked on preview
- [ ] Set `VITE_PWA_ENABLED=true` in production environment
- [ ] Deploy
- [ ] Verify update toast fires on the next subsequent deploy
- [ ] Remove the `VITE_PWA_ENABLED` flag after one stable cycle (1–2 weeks)
```

**Step 2: Commit**

```bash
git add docs/plans/2026-05-16-pwa-rollout-checklist.md
git commit -m "docs(pwa): add manual QA + rollout checklist"
```

---

## Task 18: Final cleanup — update README / CHANGELOG

**Files:**

- Modify: `README.md`

**Step 1: Add a short PWA section to the README**

Find the existing feature list or development-notes section in `README.md`. Append a short note:

```markdown
### Progressive Web App

The app supports installation as a PWA for authenticated staff/owners. Enable via `VITE_PWA_ENABLED=true` in the environment. See `docs/plans/2026-05-16-pwa-design.md` for the design and `docs/plans/2026-05-16-pwa-rollout-checklist.md` for the manual QA gate.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs(pwa): note PWA support in README"
```

---

## Summary

| Task  | Output                                       | Lines of code (approx)    |
| ----- | -------------------------------------------- | ------------------------- |
| 1     | `vite-plugin-pwa` installed                  | 0                         |
| 2     | `src/types/pwa.d.ts`                         | ~15                       |
| 3     | env flag added across `.env*`                | 3                         |
| 4     | `vite.config.ts` wired                       | ~25 added                 |
| 5–6   | `useInstallPromptStore` + tests              | ~75 store + ~130 test     |
| 7     | `main.tsx` global event listeners            | ~15 added                 |
| 8–9   | `InstallBanner` + tests                      | ~75 component + ~120 test |
| 10    | `MainLayout` integration + escape hatch      | ~15 added                 |
| 11    | global mock for `virtual:pwa-register/react` | ~7 added                  |
| 12–13 | `UpdateToast` + tests                        | ~45 component + ~70 test  |
| 14    | `__root.tsx` mount + auto-reload             | ~10 added                 |
| 15    | Playwright e2e spec                          | ~110                      |
| 16    | full verify + `preview:pwa` script           | 1 line script             |
| 17    | rollout checklist doc                        | ~60                       |
| 18    | README note                                  | ~5                        |

**Total new files:** 7 (1 store, 2 components, 1 types file, 1 e2e spec, 2 docs).
**Total modified files:** 7 (`vite.config.ts`, 3 env files, `main.tsx`, `__root.tsx`, `MainLayout.tsx`, `src/test/setup.ts`, `package.json`, `README.md`).
**Estimated time:** 1–2 working days, including manual QA.
**Estimated risk:** Low — no dynamic data is cached, behind env flag, multiple rollback paths.
