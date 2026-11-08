import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type RouteComponent,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/auth/LoginScreen";
import { NotFoundPage } from "@/components/NotFoundPage";
import { Route as AdminPendingApprovalRoute } from "@/routes/admin_.pending-approval";
import { Route as ForgotPasswordRoute } from "@/routes/forgot-password";
import { Route as PendingApprovalRoute } from "@/routes/pending-approval";
import { Route as ResetPasswordRoute } from "@/routes/reset-password";
import { Route as SignUpRoute } from "@/routes/sign-up";

vi.mock("@/lib/supabase", () => ({
  supabaseAuth: { getSession: () => Promise.resolve({ data: { session: {} } }) },
}));

function renderScreen(component: RouteComponent) {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const screens: [string, RouteComponent, string][] = [
  // Both login routes render LoginScreen; their wrappers read route search params.
  ["login", LoginScreen, "Okaeri Rest House"],
  ["sign-up", SignUpRoute.options.component!, "Create Account"],
  ["forgot password", ForgotPasswordRoute.options.component!, "Reset Password"],
  ["reset password", ResetPasswordRoute.options.component!, "Set New Password"],
  ["pending approval", PendingApprovalRoute.options.component!, "Account Pending Approval"],
  [
    "admin pending approval",
    AdminPendingApprovalRoute.options.component!,
    "Account Pending Approval",
  ],
  ["404", NotFoundPage, "Page Not Found"],
];

describe("Screens outside the shell", () => {
  it.each(screens)("%s shows the logo above its own title", async (_, component, title) => {
    renderScreen(component);

    const heading = await screen.findByRole("heading", { name: title });
    const logo = screen.getByRole("img", { name: "Okaeri Rest House" });
    expect(logo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the login subtitle", async () => {
    renderScreen(LoginScreen);

    expect(
      await screen.findByText("Sign in to access the resort management dashboard")
    ).toBeVisible();
  });

  it("drops the footer text from the 404 page", async () => {
    renderScreen(NotFoundPage);

    await screen.findByRole("heading", { name: "Page Not Found" });
    expect(screen.queryByText("Okaeri Rest House Management System")).not.toBeInTheDocument();
  });
});
