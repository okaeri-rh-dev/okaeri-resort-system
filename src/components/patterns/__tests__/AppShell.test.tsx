import type { ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar, Home, ListChecks, LogOut, Receipt, Settings, Users } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AppShell, type ShellDestination } from "@/components/patterns";

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

  it("opens the full destination list and the actions from More", async () => {
    const signOut = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={managerDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: signOut }]}
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
    await userEvent.click(within(menu).getByRole("button", { name: "Sign Out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("offers the actions from the account menu too", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign Out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
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
  it("offers Light, Dark and Auto as one labelled choice in the expanded rail", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const choice = await screen.findByRole("radiogroup", { name: "Theme" });
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Light", "Dark", "Auto"]);
    expect(within(choice).getByRole("radio", { name: "Auto" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await userEvent.click(within(choice).getByRole("radio", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("puts a dark mode switch in the compact header, not in the account menu", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        actions={[{ label: "Sign Out", icon: LogOut, onSelect: () => {} }]}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    const darkMode = within(header).getByRole("switch", { name: "Dark mode" });
    expect(darkMode).not.toBeChecked();
    await userEvent.click(darkMode);
    expect(onChange).toHaveBeenCalledWith("dark");

    await userEvent.click(within(header).getByRole("button", { name: "Account menu" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Sign Out"]);
  });

  it("lets the menu sheet stop matching the device and keep the theme it shows", async () => {
    const onChange = vi.fn();
    renderAt(
      "/admin/dashboard",
      <AppShell
        surface="admin"
        brand={brand}
        destinations={staffDestinations}
        theme={{ value: "system", onChange }}
      >
        <p>Dashboard</p>
      </AppShell>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Open menu" }));

    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    expect(within(menu).getByRole("switch", { name: "Dark mode" })).toBeDisabled();
    const matchDevice = within(menu).getByRole("switch", { name: "Match my device" });
    expect(matchDevice).toBeChecked();

    expect(await axe(menu)).toHaveNoViolations();

    await userEvent.click(matchDevice);
    expect(onChange).toHaveBeenCalledWith("light");
  });

  it("gives the guest top bar a dark mode switch and its menu sheet the switch rows", async () => {
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
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).not.toBeInTheDocument();

    await userEvent.click(within(header).getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("dialog", { name: "Okaeri Resort" });
    await userEvent.click(within(menu).getByRole("switch", { name: "Match my device" }));
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("opens Match my device from a long press on the compact header switch", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
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
    const darkMode = within(header).getByRole("switch", { name: "Dark mode" });
    await user.pointer({ keys: "[MouseLeft>]", target: darkMode });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await user.pointer({ keys: "[/MouseLeft]", target: darkMode });

    expect(onChange).not.toHaveBeenCalled();
    const options = screen.getByRole("dialog", { name: "Theme options" });
    expect(await axe(options)).toHaveNoViolations();

    await user.click(within(options).getByRole("switch", { name: "Match my device" }));
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
        destinations={staffDestinations}
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

  it("opens Match my device from a long press on the guest top bar switch", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderAt(
      "/",
      <AppShell
        surface="guest"
        brand={guestBrand}
        destinations={guestDestinations}
        theme={{ value: "light", onChange }}
      >
        <p>Calendar</p>
      </AppShell>
    );

    const header = await screen.findByRole("banner");
    const darkMode = within(header).getByRole("switch", { name: "Dark mode" });
    await user.pointer({ keys: "[MouseLeft>]", target: darkMode });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await user.pointer({ keys: "[/MouseLeft]", target: darkMode });

    expect(onChange).not.toHaveBeenCalled();
    const options = screen.getByRole("dialog", { name: "Theme options" });
    await user.click(within(options).getByRole("switch", { name: "Match my device" }));
    expect(onChange).toHaveBeenCalledWith("system");
  });
});
