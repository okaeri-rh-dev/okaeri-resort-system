import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";
import { z } from "zod";

import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  registered: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

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

  const handleSuccess = () => {
    if (redirectTo) {
      // Validate redirect is same-origin to prevent open redirect attacks
      try {
        const url = new URL(redirectTo, window.location.origin);
        if (url.origin === window.location.origin) {
          window.location.href = url.href;
          return;
        }
      } catch {
        // Invalid URL — fall through to default
      }
    }
    window.location.reload();
  };

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
            <LoginForm onSuccess={handleSuccess} registered={registered} confirmed={confirmed} />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
