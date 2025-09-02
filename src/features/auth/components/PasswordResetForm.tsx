/**
 * PasswordResetForm Component - Phase 1.3 REFACTOR Implementation
 *
 * Professional Enterprise Design System applied.
 * Maintains 100% test compatibility while enhancing UI/UX.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/routes/paths";
import {
  getInputClasses,
  getButtonClasses,
  getLabelClasses,
  getTypographyClasses,
  getErrorMessageClasses,
  getLinkClasses,
  getAlertStyles,
} from "@/styles/design-system";
import { RequiredIndicator } from "@/components/ui/required-indicator";

interface PasswordResetFormProps {
  onSuccess?: () => void;
}

export function PasswordResetForm({ onSuccess }: PasswordResetFormProps) {
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange", // Enable validation on change for isValid state
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      clearError();
      await resetPassword(data.email);
      setIsSubmitted(true);
      onSuccess?.();
    } catch (err) {
      // Error is handled by the auth store
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className={getTypographyClasses("heading")}>Email Sent</h2>
          <div
            className={`${getTypographyClasses("body")} mt-3 rounded border p-3`}
            style={getAlertStyles("success")}
          >
            Password reset instructions have been sent to your email address. Please check your
            inbox and follow the link to reset your password.
          </div>
        </div>

        <div className="space-y-3 text-center">
          <Button onClick={() => setIsSubmitted(false)} className={getButtonClasses("secondary")}>
            Use Different Email
          </Button>

          <div className={getTypographyClasses("helper")}>
            Remember your password?{" "}
            <Link
              to={ROUTES.login}
              className={`${getTypographyClasses("helper")} ${getLinkClasses("primary")}`}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {/* Global Error Display */}
        {error && (
          <div role="alert" className="rounded border p-3 text-sm" style={getAlertStyles("error")}>
            {error}
          </div>
        )}

        {/* Email Field - Enterprise Grid Layout */}
        <div className="grid grid-cols-3 items-start gap-x-4">
          <Label htmlFor="email" className={`${getLabelClasses()} mt-2 text-right`}>
            Email <RequiredIndicator />
          </Label>
          <div className="col-span-2">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@company.com"
              error={errors.email?.message}
              className={getInputClasses(errors.email ? "error" : "default")}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert" className={getErrorMessageClasses()}>
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        {/* Submit Button - Corporate Blue */}
        <div className="grid grid-cols-3 items-center gap-x-4 pt-2">
          <div></div>
          <div className="col-span-2">
            <Button
              type="submit"
              className={`${getButtonClasses("primary")} w-full ${isLoading || !isValid ? "cursor-not-allowed opacity-60" : ""}`}
              loading={isLoading}
              loadingText="Sending Instructions..."
              disabled={isLoading || !isValid}
            >
              Send Reset Link
            </Button>
          </div>
        </div>

        {/* Link back to Login - Professional Styling */}
        <div className="grid grid-cols-3 items-center gap-x-4 pt-1">
          <div></div>
          <div className={`col-span-2 ${getTypographyClasses("helper")}`}>
            Remember your password?{" "}
            <Link
              to={ROUTES.login}
              className={`${getTypographyClasses("helper")} ${getLinkClasses("primary")}`}
            >
              Sign In
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
