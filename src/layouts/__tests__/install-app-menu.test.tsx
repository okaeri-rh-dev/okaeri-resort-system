import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MainLayout } from "@/layouts/MainLayout";
import { AuditRole } from "@/lib/audit-roles";
import { supabase } from "@/lib/supabase";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

vi.mock("@/lib/audit-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit-roles")>()),
  getUserAuditRole: vi.fn(() => Promise.resolve(AuditRole.STAFF)),
}));

const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const originalUserAgent = window.navigator.userAgent;

function makePromptEvent() {
  return {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
  localStorage.clear();
  useInstallPromptStore.setState({ installPromptEvent: null, dismissalState: "visible" });
  setUserAgent(DESKTOP_CHROME_UA);
});

afterEach(() => {
  setUserAgent(originalUserAgent);
});

async function openAccountMenu() {
  const rootRoute = createRootRoute({
    component: () => (
      <MainLayout>
        <p>Dashboard</p>
      </MainLayout>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/admin/dashboard"] }),
  });
  render(<RouterProvider router={router} />);

  const header = await screen.findByRole("banner");
  await userEvent.click(within(header).getByRole("button", { name: "Account menu" }));
  await screen.findByRole("menuitem", { name: "Sign Out" });
}

describe("Install app account menu item", () => {
  it.each([
    ["Maybe later", () => useInstallPromptStore.getState().snoozeForDays(7)],
    ["Don't show again", () => useInstallPromptStore.getState().dismissPermanently()],
  ])(
    "is hidden after %s when the browser has no install prompt and is not iOS Safari",
    async (_choice, dismiss) => {
      dismiss();

      await openAccountMenu();

      expect(screen.queryByRole("menuitem", { name: "Install app" })).not.toBeInTheDocument();
    }
  );

  it("appears when the install prompt arrives after the menu has rendered", async () => {
    useInstallPromptStore.getState().dismissPermanently();
    await openAccountMenu();

    act(() => useInstallPromptStore.getState().captureEvent(makePromptEvent()));

    expect(await screen.findByRole("menuitem", { name: "Install app" })).toBeInTheDocument();
  });

  it("brings back the banner with an Install button when an install prompt was captured", async () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    useInstallPromptStore.getState().snoozeForDays(7);

    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Install app" }));

    const banner = screen.getByRole("region", { name: "Install Okaeri app" });
    expect(within(banner).getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("brings back the banner with Add to Home Screen steps on iOS Safari", async () => {
    setUserAgent(IOS_SAFARI_UA);
    useInstallPromptStore.getState().dismissPermanently();

    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Install app" }));

    const banner = screen.getByRole("region", { name: "Install Okaeri app" });
    expect(banner).toHaveTextContent(/Add to Home Screen/);
  });
});
