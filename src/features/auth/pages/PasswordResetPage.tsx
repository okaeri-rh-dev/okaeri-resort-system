/**
 * PasswordResetPage Component - Phase 1.3 REFACTOR Implementation
 *
 * Professional Enterprise Design System password reset page wrapper.
 * Implements corporate blue accents with neutral gray background.
 */

import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PasswordResetForm } from "@/features/auth/components/PasswordResetForm";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";
import { designSystem, getTypographyClasses } from "@/styles/design-system";

export function PasswordResetPage() {
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
            <h1 className={getTypographyClasses("heading")}>Reset Password</h1>
            <p className={`mt-1 ${getTypographyClasses("caption")}`}>
              Enter your email to reset your password
            </p>
          </div>
          <PasswordResetForm />
        </div>
      </div>
    </div>
  );
}
