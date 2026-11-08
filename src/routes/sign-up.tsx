import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandedScreen } from "@/components/patterns";

export const Route = createFileRoute("/sign-up")({
  beforeLoad: ({ context }) => {
    // If already authenticated, redirect to admin dashboard
    if (context.isAuthenticated) {
      throw redirect({
        to: "/admin/dashboard",
      });
    }
  },
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <ErrorBoundary level="page">
      <BrandedScreen>
        <ErrorBoundary level="component">
          <SignUpForm />
        </ErrorBoundary>
      </BrandedScreen>
    </ErrorBoundary>
  );
}
