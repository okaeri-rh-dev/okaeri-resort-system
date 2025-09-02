/**
 * LoginForm Component - Phase 1.3 REFACTOR Implementation
 *
 * Professional Enterprise Design System applied.
 * Maintains 100% test compatibility while enhancing UI/UX.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
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
  getCheckboxClasses,
  getErrorMessageClasses,
  getLinkClasses,
  getAlertStyles,
  getCheckboxStyles,
} from "@/styles/design-system";

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange", // Enable validation on change for isValid state
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data.email, data.password, { rememberMe: data.rememberMe });
    } catch (err) {
      // Error is handled by the auth store
    }
  };

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
            Email
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

        {/* Password Field - Enterprise Grid Layout */}
        <div className="grid grid-cols-3 items-start gap-x-4">
          <Label htmlFor="password" className={`${getLabelClasses()} mt-2 text-right`}>
            Password
          </Label>
          <div className="col-span-2">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                className={`${getInputClasses(errors.password ? "error" : "default")} pr-16`}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-1/2 right-3 -translate-y-1/2 ${getTypographyClasses("helper")} font-medium transition-colors duration-100 hover:text-gray-800`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className={getErrorMessageClasses()}>
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        {/* Remember Me - Aligned with Grid */}
        <div className="grid grid-cols-3 items-center gap-x-4">
          <div></div>
          <div className="col-span-2 flex items-center space-x-2">
            <input
              id="rememberMe"
              type="checkbox"
              className={getCheckboxClasses()}
              style={getCheckboxStyles()}
              {...register("rememberMe")}
            />
            <Label htmlFor="rememberMe" className={`${getLabelClasses()} font-normal`}>
              Keep me signed in
            </Label>
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
              loadingText="Authenticating..."
              disabled={isLoading || !isValid}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Links - Professional Styling */}
        <div className="grid grid-cols-3 items-center gap-x-4 pt-1">
          <div></div>
          <div className="col-span-2 space-y-2">
            <Link
              to={ROUTES.forgotPassword}
              className={`${getTypographyClasses("helper")} ${getLinkClasses("primary")}`}
            >
              Forgot Password?
            </Link>

            <div className={getTypographyClasses("helper")}>
              New user?{" "}
              <Link
                to={ROUTES.register}
                className={`${getTypographyClasses("helper")} ${getLinkClasses("primary")}`}
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
