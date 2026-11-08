import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AppShell, PageLoader } from "@/components/patterns";

const never = () => new Promise<never>(() => {});

// The router's default pending view, as App.tsx sets it, around a shell layout and one page
function renderRouter({ slowLayout = false, slowPage = false }) {
  const rootRoute = createRootRoute();
  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "shell",
    beforeLoad: slowLayout ? never : undefined,
    component: () => (
      <AppShell
        surface="admin"
        brand={{ name: "Okaeri", to: "/" }}
        destinations={[{ label: "Dashboard", to: "/", icon: Home }]}
      >
        <Outlet />
      </AppShell>
    ),
  });
  const pageRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: "/",
    loader: slowPage ? never : undefined,
    component: () => <p>Dashboard page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([layoutRoute.addChildren([pageRoute])]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingComponent: PageLoader,
    defaultPendingMs: 0,
  });
  return render(<RouterProvider router={router} />);
}

describe("PageLoader", () => {
  it("fills the screen with the full-size logo while a layout outside the shell waits", async () => {
    renderRouter({ slowLayout: true });

    const loader = await screen.findByRole("status", { name: "Loading" });
    expect(loader.querySelector("svg")).toHaveClass("w-[min(60vw,240px)]");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("fills only the content area while a page inside the shell waits", async () => {
    renderRouter({ slowPage: true });

    const loader = await screen.findByRole("status", { name: "Loading" });
    expect(loader.querySelector("svg")).toHaveClass("w-32");
    expect(screen.getByRole("main")).toContainElement(loader);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<PageLoader />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
