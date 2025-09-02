/**
 * RegisterForm Component - Phase 1.2 GREEN Implementation
 *
 * Minimal single-step registration form to make Phase 1.1 tests pass.
 * This is TDD GREEN phase - basic functionality only.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import {
  registerSchema,
  type RegisterFormData,
  checkPasswordStrength,
} from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/routes/paths";

export function RegisterForm() {
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange", // Enable validation on change for isValid state
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      projectName: "",
      phone: "",
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        projectName: data.projectName,
      });
    } catch (err) {
      // Error is handled by the auth store
    }
  };

  const password = watch("password");
  const strength = React.useMemo(() => checkPasswordStrength(password || ""), [password]);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-muted-foreground text-sm">
          Enter your information to create your account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Global Error Display */}
        {error && (
          <div className="text-destructive border-destructive bg-destructive/10 rounded-md border p-3 text-sm">
            {error}
          </div>
        )}

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" required>
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Enter your full name"
            error={errors.name?.message}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-destructive text-sm">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
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

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            error={errors.password?.message}
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "password-error" : password ? "password-strength" : undefined
            }
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-destructive text-sm">
              {errors.password.message}
            </p>
          )}
          {password && (
            <div id="password-strength" aria-live="polite" className="mt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Password strength:</span>
                <span
                  className={
                    strength.strength === "strong"
                      ? "text-green-600"
                      : strength.strength === "good"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }
                >
                  {strength.strength}
                </span>
              </div>
              {strength.suggestions.length > 0 && (
                <ul className="text-muted-foreground mt-1 list-disc pl-5">
                  {strength.suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" required>
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your password"
            error={errors.confirmPassword?.message}
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p id="confirmPassword-error" role="alert" className="text-destructive text-sm">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Project Name Field */}
        <div className="space-y-2">
          <Label htmlFor="projectName" optional>
            Resort/Business Name
          </Label>
          <Input
            id="projectName"
            type="text"
            placeholder="Enter your resort or business name (optional)"
            error={errors.projectName?.message}
            aria-invalid={!!errors.projectName}
            aria-describedby={errors.projectName ? "projectName-error" : undefined}
            {...register("projectName")}
          />
          {errors.projectName && (
            <p id="projectName-error" role="alert" className="text-destructive text-sm">
              {errors.projectName.message}
            </p>
          )}
        </div>

        {/* Phone Field */}
        <div className="space-y-2">
          <Label htmlFor="phone" optional>
            Phone Number
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+63 9XX XXX XXXX"
            error={errors.phone?.message}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            {...register("phone")}
          />
          {errors.phone && (
            <p id="phone-error" role="alert" className="text-destructive text-sm">
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Accept Terms */}
        <div className="space-y-2">
          <div className="flex items-start space-x-3">
            <input
              id="acceptTerms"
              type="checkbox"
              className="text-ocean-600 focus:border-ocean-300 focus:ring-ocean-200 focus:ring-opacity-50 mt-0.5 rounded border-gray-300 shadow-sm focus:ring"
              aria-invalid={!!errors.acceptTerms}
              aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
              {...register("acceptTerms")}
            />
            <div className="text-sm">
              <Label htmlFor="acceptTerms" className="font-normal">
                I agree to the{" "}
                <Link to={ROUTES.terms} className="text-ocean-600 hover:text-ocean-500 underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to={ROUTES.privacy} className="text-ocean-600 hover:text-ocean-500 underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" role="alert" className="text-destructive text-sm">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          loadingText="Creating account..."
          disabled={isLoading || !isValid}
        >
          Create account
        </Button>

        {/* Link to Login */}
        <div className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            to={ROUTES.login}
            className="text-ocean-600 hover:text-ocean-500 font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
