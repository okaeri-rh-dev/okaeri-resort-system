import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/auth/LoginScreen";

// LoginForm renders TanStack Router <Link> elements (Forgot password / Create one),
// which need a router context. Mock Link with a plain anchor — the established
// pattern for component tests in this repo (see RelatedEntityLink.test.tsx).
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className} data-testid="router-link">
      {children}
    </a>
  ),
}));

describe("LoginScreen", () => {
  it("renders the sign-in heading and the login form", () => {
    render(<LoginScreen />);
    // Scope to the level-2 heading: LoginForm's CardTitle also renders
    // "Okaeri Resort System" as an <h3>, so a bare getByText matches twice.
    expect(
      screen.getByRole("heading", { level: 2, name: "Okaeri Resort System" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
