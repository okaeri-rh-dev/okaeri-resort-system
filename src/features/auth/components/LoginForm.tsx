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
import { ROUTES } from "@/constants/routes";
import {
  getInputClasses,
  getButtonClasses,
  getLabelClasses,
  getTypographyClasses,
  getCheckboxClasses,
  getLinkClasses,
  getAlertStyles,
  getCheckboxStyles,
  getPasswordToggleClasses,
  getErrorMessageClassesAnimated,
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
    } catch (_err) {
      // Error is handled by the auth store
    }
  };

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
            Email
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

        {/* Password Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="password" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Password
          </Label>
          <div className="sm:col-span-2">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                className={`${getInputClasses(errors.password ? "error" : "default")} h-11 pr-16 sm:h-9`}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={getPasswordToggleClasses()}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span
                  className={`transition-opacity duration-100 motion-reduce:transition-none ${showPassword ? "absolute opacity-0" : "opacity-100"}`}
                >
                  Show
                </span>
                <span
                  className={`transition-opacity duration-100 motion-reduce:transition-none ${showPassword ? "opacity-100" : "absolute opacity-0"}`}
                >
                  Hide
                </span>
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        {/* Remember Me - Responsive Grid Aligned */}
        <div className="grid grid-cols-1 sm:grid-cols-3 sm:items-center sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className="flex items-center space-x-2 sm:col-span-2">
            <input
              id="rememberMe"
              type="checkbox"
              className={`${getCheckboxClasses()} transition-transform duration-150 ease-out checked:scale-105 hover:scale-105 motion-reduce:transition-none motion-reduce:checked:scale-100 motion-reduce:hover:scale-100`}
              style={getCheckboxStyles()}
              {...register("rememberMe")}
            />
            <Label htmlFor="rememberMe" className={`${getLabelClasses()} font-normal`}>
              Keep me signed in
            </Label>
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
              loadingText="Authenticating..."
              disabled={isLoading || !isValid}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Links - Responsive Professional Styling */}
        <div className="grid grid-cols-1 pt-1 sm:grid-cols-3 sm:items-center sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className="space-y-2 sm:col-span-2">
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
