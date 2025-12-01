import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <ErrorBoundary level="page">
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <ResetPasswordForm />
      </div>
    </ErrorBoundary>
  );
}
