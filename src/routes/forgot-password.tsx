import { createFileRoute, redirect } from "@tanstack/react-router";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => {
    // If already authenticated, redirect to dashboard
    if (context.isAuthenticated) {
      throw redirect({
        to: "/admin/dashboard",
      });
    }
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <ErrorBoundary level="page">
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <ForgotPasswordForm />
      </div>
    </ErrorBoundary>
  );
}
