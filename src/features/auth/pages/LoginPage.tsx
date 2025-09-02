/**
 * LoginPage Component - Phase 1.2 GREEN Implementation
 *
 * Basic page wrapper around LoginForm component.
 * Minimal implementation with simple redirect logic.
 */

import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/routes/paths";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Simple redirect logic - if already logged in, go to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: ROUTES.dashboard });
    }
  }, [isAuthenticated, navigate]);

  // Don't render the form if already authenticated (prevents flash)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
