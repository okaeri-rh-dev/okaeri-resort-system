import type { ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestLayout } from "@/layouts/GuestLayout";
import { MainLayout } from "@/layouts/MainLayout";
import { AuditRole } from "@/lib/audit-roles";
import { supabase } from "@/lib/supabase";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@/lib/audit-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit-roles")>()),
  getUserAuditRole: vi.fn(() => Promise.resolve(AuditRole.STAFF)),
}));

vi.mock("@/components/pwa/InstallBanner", () => ({ InstallBanner: () => null }));

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
  useUIStore.getState().setTheme("light");
});

function renderAt(path: string, ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("theme control wiring", () => {
  it("switches the admin app to dark from the header", async () => {
    renderAt(
      "/admin/dashboard",
      <MainLayout>
        <p>Dashboard</p>
      </MainLayout>
    );

    const header = await screen.findByRole("banner");
    const choice = await within(header).findByRole("radiogroup", { name: "Theme" });
    await userEvent.click(within(choice).getByRole("radio", { name: "Dark" }));

    expect(useUIStore.getState().theme).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("switches the guest pages to dark from the top bar", async () => {
    renderAt(
      "/",
      <GuestLayout>
        <p>Calendar</p>
      </GuestLayout>
    );

    const header = await screen.findByRole("banner");
    await userEvent.click(within(header).getByRole("switch", { name: "Dark mode" }));

    expect(useUIStore.getState().theme).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });
});
