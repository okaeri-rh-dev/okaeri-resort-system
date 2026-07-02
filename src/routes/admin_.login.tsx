import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";

import { loginSearchSchema } from "@/components/auth/login-utils";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const Route = createFileRoute("/admin_/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { redirect: redirectTo, registered, confirmed } = useSearch({ from: "/admin_/login" });
  return <LoginScreen redirectTo={redirectTo} registered={registered} confirmed={confirmed} />;
}
