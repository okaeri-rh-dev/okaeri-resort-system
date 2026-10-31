import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MainLayout } from "@/layouts/MainLayout";
import { AuditRole, getUserAuditRole } from "@/lib/audit-roles";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/audit-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit-roles")>()),
  getUserAuditRole: vi.fn(),
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
});

function renderLayout(path = "/admin/dashboard") {
  const rootRoute = createRootRoute({
    component: () => (
      <MainLayout>
        <p>Dashboard</p>
      </MainLayout>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
}

async function renderMenuFor(role: AuditRole, path = "/admin/dashboard") {
  vi.mocked(getUserAuditRole).mockResolvedValue(role);
  renderLayout(path);

  const nav = await screen.findByRole("navigation", { name: "Main" });
  await within(nav).findByRole("list", { name: "Bookings" });
  return nav;
}

function groupLinks(nav: HTMLElement, group: string) {
  return within(within(nav).getByRole("list", { name: group }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function groupNames(nav: HTMLElement) {
  return ["Bookings", "Cabins", "Money", "Admin"].filter(
    (group) => within(nav).queryByRole("list", { name: group }) !== null
  );
}

describe("admin menu groups per role", () => {
  it("shows staff the Bookings and Cabins groups only, with Availability and Blocked dates", async () => {
    const nav = await renderMenuFor(AuditRole.STAFF);

    expect(groupNames(nav)).toEqual(["Bookings", "Cabins"]);
    expect(groupLinks(nav, "Bookings")).toEqual(["Bookings", "Booking Queue"]);
    expect(groupLinks(nav, "Cabins")).toEqual(["Availability", "Blocked dates"]);
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  });

  it("shows a manager every group, with only Settings under Admin", async () => {
    const nav = await renderMenuFor(AuditRole.MANAGER);

    expect(groupNames(nav)).toEqual(["Bookings", "Cabins", "Money", "Admin"]);
    expect(groupLinks(nav, "Bookings")).toEqual([
      "Bookings",
      "Booking Queue",
      "Payments",
      "Guests",
    ]);
    expect(groupLinks(nav, "Cabins")).toEqual(["Cabins", "Availability", "Blocked dates"]);
    expect(groupLinks(nav, "Money")).toEqual(["Expenses", "Accounts", "Transfers", "Documents"]);
    expect(groupLinks(nav, "Admin")).toEqual(["Settings"]);
  });

  it("adds Audit Trail under Admin for an owner", async () => {
    const nav = await renderMenuFor(AuditRole.OWNER);

    expect(groupLinks(nav, "Admin")).toEqual(["Settings", "Audit Trail"]);
  });

  it("adds User Roles under Admin for an admin", async () => {
    const nav = await renderMenuFor(AuditRole.ADMIN);

    expect(groupLinks(nav, "Admin")).toEqual(["Settings", "Audit Trail", "User Roles"]);
  });

  it("leads with Dashboard, outside any group", async () => {
    const nav = await renderMenuFor(AuditRole.ADMIN);

    const [firstLink] = within(nav).getAllByRole("link");
    expect(firstLink).toHaveTextContent("Dashboard");
    for (const group of groupNames(nav)) {
      expect(groupLinks(nav, group)).not.toContain("Dashboard");
    }
  });

  it("marks Bookings, not Booking Queue, on a booking's detail page", async () => {
    const nav = await renderMenuFor(AuditRole.MANAGER, "/admin/bookings/booking-1");

    const bookings = within(nav).getByRole("list", { name: "Bookings" });
    expect(within(bookings).getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(bookings).getByRole("link", { name: "Booking Queue" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});

describe("admin menu when the role lookup fails", () => {
  it("still renders the menu without an unhandled rejection", async () => {
    vi.mocked(getUserAuditRole).mockRejectedValue(new Error("Failed to get user role"));
    renderLayout();

    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
