/**
 * PasswordResetForm Component - Phase 1.2 GREEN Implementation
 *
 * Minimal password reset form with email input to make Phase 1.1 tests pass.
 * This is TDD GREEN phase - basic functionality only.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/routes/paths";

interface PasswordResetFormProps {
  onSuccess?: () => void;
}

export function PasswordResetForm({ onSuccess }: PasswordResetFormProps) {
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
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
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We've sent a password reset link to your email address. Please check your inbox and
            follow the instructions to reset your password.
          </p>
        </div>

        <div className="text-center">
          <Button variant="outline" onClick={() => setIsSubmitted(false)} className="text-sm">
            Try another email
          </Button>
        </div>

        <div className="text-muted-foreground text-center text-sm">
          Remember your password?{" "}
          <a
            href={ROUTES.login}
            className="text-ocean-600 hover:text-ocean-500 font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Global Error Display */}
        {error && (
          <div className="text-destructive border-destructive bg-destructive/10 rounded-md border p-3 text-sm">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            error={errors.email?.message}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-destructive text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          loadingText="Sending reset link..."
          disabled={isLoading}
        >
          Send reset link
        </Button>

        {/* Link back to Login */}
        <div className="text-muted-foreground text-center text-sm">
          Remember your password?{" "}
          <a
            href={ROUTES.login}
            className="text-ocean-600 hover:text-ocean-500 font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        </div>
      </form>
    </div>
  );
}
