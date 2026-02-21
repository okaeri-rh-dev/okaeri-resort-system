import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <ErrorBoundary level="component">
            <SignUpForm />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
