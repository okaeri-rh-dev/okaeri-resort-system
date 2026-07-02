import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";

import { loginSearchSchema } from "@/components/auth/login-utils";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    // If already authenticated, redirect to admin dashboard
    if (context.isAuthenticated) {
      throw redirect({
        to: "/admin/dashboard",
      });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo, registered, confirmed } = useSearch({ from: "/login" });

  return <LoginScreen redirectTo={redirectTo} registered={registered} confirmed={confirmed} />;
}
