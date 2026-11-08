import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandedScreen } from "@/components/patterns";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <ErrorBoundary level="page">
      <BrandedScreen>
        <ResetPasswordForm />
      </BrandedScreen>
    </ErrorBoundary>
  );
}
