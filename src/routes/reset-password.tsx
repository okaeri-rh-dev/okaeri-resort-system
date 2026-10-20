import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <ErrorBoundary level="page">
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <ResetPasswordForm />
      </div>
    </ErrorBoundary>
  );
}
