import type { ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Building2,
  Calendar,
  CalendarRange,
  Home,
  ListChecks,
  LogOut,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AppShell, type ShellDestination, type ShellGroup } from "@/components/patterns";

// The setup file's vi.fn() ResizeObserver is reset between tests; Radix menus measure with it
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function renderAt(path: string, ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

const staffDestinations: ShellDestination[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: Home, pinned: true },
  { label: "Bookings", to: "/admin/bookings", icon: Calendar, pinned: true, exact: true },
  { label: "Booking Queue", to: "/admin/bookings/queue", icon: ListChecks, pinned: true },
];

const managerDestinations: ShellDestination[] = [
  ...staffDestinations,
  { label: "Guests", to: "/admin/guests", icon: Users },
  { label: "Payments", to: "/admin/payments", icon: Receipt, pinned: true },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

const brand = { name: "Okaeri Resort", tagline: "Management System", to: "/admin" } as const;

describe("AppShell, admin", () => {
  it("lists every destination in the main navigation and marks the current page", async () => {
    renderAt(
      "/admin/bookings",
      <AppShell surface="admin" brand={brand} destinations={managerDestinations}>
        <p>Bookings list</p>
      </AppShell>
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(managerDestinations.map((destination) => destination.label));
    expect(within(nav).getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).getByRole("link", { name: "Guests" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("main")).toHaveTextContent("Bookings list");
  });

  it("has no More slot when the role has five or fewer destinations", async () => {
    renderAt(
      "/admin/dashboard",
      <AppShell surface="admin" brand={brand} destinations={staffDestinations}>
        <p>Dashboard</p>
      </AppShell>
    );

    await screen.findByRole("navigation", { name: "Main" });
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  });

  it("opens the full destination list from More, without the actions", async () => {
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: () => {} }]}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    await userEvent.click(await screen.findByRole("button", { name: "More" }));

    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    const menuNav = within(menu).getByRole("navigation", { name: "Menu" });
    expect(
      within(menuNav)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(managerDestinations.map((destination) => destination.label));
    expect(within(menu).queryByRole("button", { name: "Sign Out" })).not.toBeInTheDocument();
  });

  it("offers the actions from the account menu in the header and at the rail foot", async () => {
    const signOut = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: signOut }]}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    const triggers = screen.getAllByRole("button", { name: "Account menu" });
    expect(triggers).toHaveLength(2);
    expect(triggers.filter((trigger) => header.contains(trigger))).toHaveLength(1);

    for (const trigger of triggers) {
      await userEvent.click(trigger);
      await userEvent.click(screen.getByRole("menuitem", { name: "Sign Out" }));
    }
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("has no axe violations in the open account menu", async () => {
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: () => {} }]}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    await userEvent.click(within(header).getByRole("button", { name: "Account menu" }));
    expect(await axe(screen.getByRole("menu"))).toHaveNoViolations();
  });

  it("shows a named loading state while the destinations are unknown", async () => {
    renderAt(
      "/admin/dashboard",
      <AppShell surface="admin" brand={brand} destinations={[]} navLoading>
        <p>Dashboard</p>
      </AppShell>
    );

    expect(await screen.findByRole("status", { name: "Loading navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  });

  it("renders the page header as the page heading", async () => {
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        pageHeader={{ title: "Dashboard", description: "Today at the resort" }}
      >
        <p>Body</p>
      </AppShell>
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = renderAt(
      "/admin/bookings",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: () => {} }]}
        theme={{ value: "system", onChange: () => {} }}
      >
        <p>Body</p>
      </AppShell>
    );

    await screen.findByRole("navigation", { name: "Main" });
    expect(await axe(container)).toHaveNoViolations();
  });
});

const navGroups: ShellGroup[] = [
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "cabins", label: "Cabins", icon: Building2 },
  { id: "admin", label: "Admin", icon: Settings },
];

const groupedDestinations: ShellDestination[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: Home, pinned: true },
  {
    label: "Bookings",
    to: "/admin/bookings",
    icon: Calendar,
    pinned: true,
    exact: true,
    group: "bookings",
  },
  {
    label: "Booking Queue",
    to: "/admin/bookings/queue",
    icon: ListChecks,
    pinned: true,
    group: "bookings",
  },
  { label: "Payments", to: "/admin/payments", icon: Receipt, pinned: true, group: "bookings" },
  { label: "Settings", to: "/admin/settings", icon: Settings, group: "admin" },
  { label: "Cabins", to: "/admin/units", icon: Building2, group: "cabins" },
  { label: "Availability", to: "/admin/availability", icon: CalendarRange, group: "cabins" },
];

function linkLabels(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function expectInOrder(elements: HTMLElement[]) {
  for (let index = 1; index < elements.length; index++) {
    expect(
      elements[index - 1].compareDocumentPosition(elements[index]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  }
}

function renderGrouped(path: string, destinations = groupedDestinations) {
  return renderAt(
    path,
    <AppShell surface="admin" brand={brand} destinations={destinations} navGroups={navGroups}>
      <p>Body</p>
    </AppShell>
  );
}

describe("AppShell, admin grouped nav", () => {
  it("lists each group under its heading, in group order, after the ungrouped items", async () => {
    renderGrouped("/admin/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    const bookings = within(nav).getByRole("list", { name: "Bookings" });
    const cabins = within(nav).getByRole("list", { name: "Cabins" });
    const admin = within(nav).getByRole("list", { name: "Admin" });

    expect(linkLabels(bookings)).toEqual(["Bookings", "Booking Queue", "Payments"]);
    expect(linkLabels(cabins)).toEqual(["Cabins", "Availability"]);
    expect(linkLabels(admin)).toEqual(["Settings"]);

    const dashboard = within(nav).getAllByRole("link", { name: "Dashboard" }).at(-1)!;
    expectInOrder([dashboard, bookings, cabins, admin]);
  });

  it("opens a group's links from its collapsed-rail item and navigates", async () => {
    const user = userEvent.setup();
    renderGrouped("/admin/bookings/queue");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    const trigger = within(nav).getByRole("button", { name: "Bookings" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    await user.click(trigger);
    const flyout = screen.getByRole("menu", { name: "Bookings" });
    expect(
      within(flyout)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Bookings", "Booking Queue", "Payments"]);
    expect(within(flyout).getByRole("menuitem", { name: "Booking Queue" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(within(flyout).getByRole("menuitem", { name: "Payments" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(
      within(within(nav).getByRole("list", { name: "Bookings" })).getByRole("link", {
        name: "Payments",
      })
    ).toHaveAttribute("aria-current", "page");
  });

  it("marks the collapsed-rail group that holds the current page, child routes included", async () => {
    renderGrouped("/admin/units/cabin-1");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Cabins" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(within(nav).getByRole("button", { name: "Bookings" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("keeps an exact destination's group active only through its other items", async () => {
    renderGrouped("/admin/bookings/new");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Bookings" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("keeps the compact bar flat: pinned destinations, then More", async () => {
    renderGrouped("/admin/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    const bar = within(nav).getByRole("button", { name: "More" }).closest("ul")!;
    expect(linkLabels(bar)).toEqual(["Dashboard", "Bookings", "Booking Queue", "Payments"]);
    expect(within(bar).queryByRole("list", { name: /./ })).not.toBeInTheDocument();
  });

  it("puts every destination in the compact bar when there are five or fewer", async () => {
    renderGrouped(
      "/admin/dashboard",
      groupedDestinations.filter((destination) => destination.group !== "admin").slice(0, 5)
    );

    await screen.findByRole("navigation", { name: "Main" });
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  });

  it("shows the same headings in the menu sheet and closes it on a tap", async () => {
    const user = userEvent.setup();
    renderGrouped("/admin/dashboard");

    await user.click(await screen.findByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "Okaeri Resort" });
    const menuNav = within(sheet).getByRole("navigation", { name: "Menu" });
    expect(linkLabels(menuNav)[0]).toBe("Dashboard");
    expect(linkLabels(within(menuNav).getByRole("list", { name: "Bookings" }))).toEqual([
      "Bookings",
      "Booking Queue",
      "Payments",
    ]);
    expect(linkLabels(within(menuNav).getByRole("list", { name: "Cabins" }))).toEqual([
      "Cabins",
      "Availability",
    ]);
    expect(linkLabels(within(menuNav).getByRole("list", { name: "Admin" }))).toEqual([
      "Settings",
    ]);
    expect(await axe(sheet)).toHaveNoViolations();

    await user.click(within(menuNav).getByRole("link", { name: "Availability" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("drops a group with no destinations and keeps a one-item group's heading", async () => {
    renderGrouped(
      "/admin/dashboard",
      groupedDestinations.filter((destination) => destination.group !== "cabins")
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).queryByRole("list", { name: "Cabins" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Cabins" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("list", { name: "Admin" })).toBeInTheDocument();
  });

  it("has no axe violations in the grouped rail", async () => {
    const { container } = renderGrouped("/admin/bookings");

    await screen.findByRole("navigation", { name: "Main" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens a flyout for a one-item group", async () => {
    const user = userEvent.setup();
    renderGrouped("/admin/dashboard");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("button", { name: "Admin" }));
    const flyout = screen.getByRole("menu", { name: "Admin" });
    expect(within(flyout).getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(await axe(flyout)).toHaveNoViolations();
  });
});

const guestDestinations: ShellDestination[] = [
  { label: "Availability", to: "/", icon: Calendar, exact: true },
  { label: "Book a stay", to: "/booking", icon: Home, exact: true },
  { label: "Check a booking", to: "/booking/check-status", icon: ListChecks },
];

const guestBrand = { name: "Okaeri Resort", to: "/" } as const;

describe("AppShell, guest", () => {
  it("links the destinations inline in the top bar", async () => {
    renderAt(
      "/booking",
      <AppShell surface="guest" brand={guestBrand} destinations={guestDestinations}>
        <p>Booking form</p>
      </AppShell>
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Availability", "Book a stay", "Check a booking"]);
    expect(within(nav).getByRole("link", { name: "Book a stay" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Okaeri Resort" })).toBeVisible();
  });

  it("opens the same links in a menu sheet", async () => {
    renderAt(
      "/",
      <AppShell surface="guest" brand={guestBrand} destinations={guestDestinations}>
        <p>Calendar</p>
      </AppShell>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Open menu" }));

    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Availability", "Book a stay", "Check a booking"]);
  });

  it("has no bottom bar or More slot", async () => {
    renderAt(
      "/",
      <AppShell surface="guest" brand={guestBrand} destinations={guestDestinations}>
        <p>Calendar</p>
      </AppShell>
    );

    await screen.findByRole("navigation", { name: "Main" });
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderAt(
      "/",
      <AppShell
        surface="guest"
        brand={guestBrand}
        destinations={guestDestinations}
        pageHeader={{ title: "Book your stay" }}
        theme={{ value: "light", onChange: () => {} }}
      >
        <p>Calendar</p>
      </AppShell>
    );

    await screen.findByRole("navigation", { name: "Main" });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AppShell, theme control", () => {
  it("offers Light, Dark and Auto as one choice at the rail foot", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const choice = await screen.findByRole("radiogroup", { name: "Theme" });
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label"))
    ).toEqual(["Light", "Dark", "Auto"]);
    expect(within(choice).getByRole("radio", { name: "Auto" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await userEvent.click(within(choice).getByRole("radio", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("puts a dark mode switch in the compact header when More holds the full choice", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: () => {} }]}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    expect(within(header).queryByRole("radiogroup")).not.toBeInTheDocument();
    const darkMode = within(header).getByRole("switch", { name: "Dark mode" });
    expect(darkMode).not.toBeChecked();
    await userEvent.click(darkMode);
    expect(onChange).toHaveBeenCalledWith("dark");

    await userEvent.click(within(header).getByRole("button", { name: "Account menu" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Sign Out"]);
  });

  it("puts the icon choice in the compact header when there is no More", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        theme={{ value: "dark", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    expect(within(header).queryByRole("switch")).not.toBeInTheDocument();
    const choice = within(header).getByRole("radiogroup", { name: "Theme" });
    await userEvent.click(within(choice).getByRole("radio", { name: "Auto" }));
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("ends the menu sheet with the labelled choice", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Open menu" }));

    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    expect(within(menu).queryByRole("switch")).not.toBeInTheDocument();
    const choice = within(menu).getByRole("radiogroup", { name: "Theme" });
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Light", "Dark", "Auto"]);

    expect(await axe(menu)).toHaveNoViolations();

    await userEvent.click(within(choice).getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
  });

  it("gives the guest top bar a dark mode switch and the icon choice, and its menu sheet the labelled choice", async () => {
    const onChange = vi.fn();
    renderAt(
      "/",
      <AppShell
        surface="guest"
        brand={guestBrand}
        destinations={guestDestinations}
        theme={{ value: "dark", onChange }}
      >
        <p>Calendar</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    expect(within(header).getByRole("switch", { name: "Dark mode" })).toBeChecked();
    const barChoice = within(header).getByRole("radiogroup", { name: "Theme" });
    expect(within(barChoice).getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await userEvent.click(within(header).getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    expect(within(menu).queryByRole("switch")).not.toBeInTheDocument();
    const sheetChoice = within(menu).getByRole("radiogroup", { name: "Theme" });
    await userEvent.click(within(sheetChoice).getByRole("radio", { name: "Auto" }));
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("moves the theme choice with the arrow keys and keeps one tab stop", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const choice = await screen.findByRole("radiogroup", { name: "Theme" });
    const auto = within(choice).getByRole("radio", { name: "Auto" });
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.tabIndex)
    ).toEqual([-1, -1, 0]);

    auto.focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("dark");
    expect(within(choice).getByRole("radio", { name: "Dark" })).toHaveFocus();

    auto.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("light");
  });
});
