import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Route as SettingsRoute } from "@/routes/admin/settings";

vi.mock("@/lib/route-guards", () => ({ requireManager: vi.fn() }));
vi.mock("@/components/settings/PaymentMethodsTable", () => ({ PaymentMethodsTable: () => null }));
vi.mock("@/components/settings/ExpenseCategoriesTable", () => ({
  ExpenseCategoriesTable: () => null,
}));
vi.mock("@/components/settings/ContactChannelsTable", () => ({
  ContactChannelsTable: () => null,
}));

function renderAt(path: string) {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    SettingsRoute.update({
      id: "/admin/settings",
      path: "/admin/settings",
      getParentRoute: () => rootRoute,
    } as never),
  ]);
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { router, history };
}

describe("/admin/settings tab search param", () => {
  it("opens the tab named in ?tab=", async () => {
    renderAt("/admin/settings?tab=contact-channels");

    expect(await screen.findByRole("tab", { name: "Contact Channels" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("falls back to Payment Methods for an unknown ?tab=", async () => {
    renderAt("/admin/settings?tab=nope");

    expect(await screen.findByRole("tab", { name: "Payment Methods" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("writes the selected tab to the URL without adding history entries", async () => {
    const user = userEvent.setup();
    const { router, history } = renderAt("/admin/settings");
    const entriesBefore = history.length;

    await user.click(await screen.findByRole("tab", { name: "Expense Categories" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ tab: "expense-categories" })
    );

    await user.click(screen.getByRole("tab", { name: "Contact Channels" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: "contact-channels" }));

    await user.click(screen.getByRole("tab", { name: "Payment Methods" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));

    expect(history.length).toBe(entriesBefore);
  });
});
