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
import { ROUTES } from "@/constants/routes";
import {
  getInputClasses,
  getButtonClasses,
  getLabelClasses,
  getTypographyClasses,
  getLinkClasses,
  getAlertStyles,
  getErrorMessageClassesAnimated,
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
    } catch (_err) {
      // Error is handled by the auth store
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className={getTypographyClasses("heading")}>Email Sent</h2>
          <div
            className={`${getTypographyClasses("body")} animate-in slide-in-from-top-2 mt-3 rounded border p-3 duration-200 ease-out motion-reduce:animate-none`}
            style={getAlertStyles("success")}
          >
            Password reset instructions have been sent to your email address. Please check your
            inbox and follow the link to reset your password.
          </div>
        </div>

        <div className="space-y-3 text-center">
          <Button
            onClick={() => setIsSubmitted(false)}
            className={`${getButtonClasses("secondary")} h-11 sm:h-9`}
          >
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
          <div
            role="alert"
            className="animate-in slide-in-from-top-2 rounded border p-3 text-sm duration-200 ease-out motion-reduce:animate-none"
            style={getAlertStyles("error")}
          >
            {error}
          </div>
        )}

        {/* Email Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="email" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Email <RequiredIndicator />
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@company.com"
              error={errors.email?.message}
              className={`${getInputClasses(errors.email ? "error" : "default")} h-11 sm:h-9`}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        {/* Submit Button - Responsive Corporate Blue */}
        <div className="grid grid-cols-1 pt-2 sm:grid-cols-3 sm:items-center sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              className={`${getButtonClasses("primary")} h-11 w-full sm:h-9 ${isLoading || !isValid ? "cursor-not-allowed opacity-60" : ""}`}
              loading={isLoading}
              loadingText="Sending Instructions..."
              disabled={isLoading || !isValid}
            >
              Send Reset Link
            </Button>
          </div>
        </div>

        {/* Link back to Login - Responsive Professional Styling */}
        <div className="grid grid-cols-1 pt-1 sm:grid-cols-3 sm:items-center sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className={`sm:col-span-2 ${getTypographyClasses("helper")}`}>
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
