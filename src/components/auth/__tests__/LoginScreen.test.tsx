import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/auth/LoginScreen";

// LoginForm renders TanStack Router <Link> elements (Forgot password / Create one),
// which need a router context.
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
}));

describe("LoginScreen", () => {
  it("renders the logo and the login form", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("img", { name: "Okaeri Rest House" })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
