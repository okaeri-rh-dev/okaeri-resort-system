/**
 * RegisterPage Component - Phase 1.3 REFACTOR Implementation
 *
 * Professional Enterprise Design System registration page wrapper.
 * Implements corporate blue accents with neutral gray background.
 */

import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/routes/paths";
import { designSystem, getTypographyClasses } from "@/styles/design-system";

export function RegisterPage() {
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
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: designSystem.colors.background.secondary }}
    >
      <div className="w-full max-w-md">
        <div
          className={`rounded ${designSystem.borders.card} bg-white p-6 ${designSystem.shadows.card}`}
        >
          <div className="mb-6">
            <h1 className={getTypographyClasses("heading")}>Create Account</h1>
            <p className={`mt-1 ${getTypographyClasses("caption")}`}>
              Register for resort management access
            </p>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
