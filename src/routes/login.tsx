import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/login")({
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
  return (
    <ErrorBoundary level="page">
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Okaeri Resort System
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to access the resort management dashboard
            </p>
          </div>
          <ErrorBoundary level="component">
            <LoginForm onSuccess={() => window.location.reload()} />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
