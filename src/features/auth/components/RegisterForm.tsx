/**
 * RegisterForm Component - Phase 1.3 REFACTOR Implementation
 *
 * Professional Enterprise Design System applied.
 * Maintains 100% test compatibility while enhancing UI/UX.
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
import {
  getInputClasses,
  getButtonClasses,
  getLabelClasses,
  getTypographyClasses,
  getCheckboxClasses,
  getLinkClasses,
  getAlertStyles,
  getCheckboxStyles,
  getPasswordStrengthColor,
  getErrorMessageClassesAnimated,
} from "@/styles/design-system";
import { RequiredIndicator } from "@/components/ui/required-indicator";

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
    } catch (_err) {
      // Error is handled by the auth store
    }
  };

  const password = watch("password");
  const strength = React.useMemo(() => checkPasswordStrength(password || ""), [password]);

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

        {/* Name Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="name" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Full Name <RequiredIndicator />
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="John Doe"
              error={errors.name?.message}
              className={`${getInputClasses(errors.name ? "error" : "default")} h-11 sm:h-9`}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.name.message}
              </p>
            )}
          </div>
        </div>

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

        {/* Password Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="password" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Password <RequiredIndicator />
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.password?.message}
              className={`${getInputClasses(errors.password ? "error" : "default")} h-11 sm:h-9`}
              aria-invalid={!!errors.password}
              aria-describedby={(() => {
                if (errors.password) return "password-error";
                if (password) return "password-strength";
                return undefined;
              })()}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.password.message}
              </p>
            )}
            {password && (
              <div
                id="password-strength"
                aria-live="polite"
                className="animate-in slide-in-from-top-1 mt-1 text-xs duration-200 ease-out motion-reduce:animate-none"
              >
                <div className="flex items-center justify-between">
                  <span className={getTypographyClasses("helper")}>Strength:</span>
                  <span
                    className="font-medium"
                    style={{ color: getPasswordStrengthColor(strength.strength) }}
                  >
                    {strength.strength.toUpperCase()}
                  </span>
                </div>
                {strength.suggestions.length > 0 && (
                  <ul
                    className={`mt-1 ${getTypographyClasses("helper")} space-y-0.5 text-gray-600`}
                  >
                    {strength.suggestions.map((s) => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Confirm Password Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="confirmPassword" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Confirm <RequiredIndicator />
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              className={`${getInputClasses(errors.confirmPassword ? "error" : "default")} h-11 sm:h-9`}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p
                id="confirmPassword-error"
                role="alert"
                className={getErrorMessageClassesAnimated()}
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        {/* Project Name Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="projectName" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Business{" "}
            <span className={`text-gray-600 ${getTypographyClasses("helper")}`}>(optional)</span>
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="projectName"
              type="text"
              placeholder="Resort or business name"
              error={errors.projectName?.message}
              className={`${getInputClasses(errors.projectName ? "error" : "default")} h-11 sm:h-9`}
              aria-invalid={!!errors.projectName}
              aria-describedby={errors.projectName ? "projectName-error" : undefined}
              {...register("projectName")}
            />
            {errors.projectName && (
              <p id="projectName-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.projectName.message}
              </p>
            )}
          </div>
        </div>

        {/* Phone Field - Responsive Enterprise Grid Layout */}
        <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-3 sm:items-start sm:gap-x-4 sm:gap-y-0">
          <Label htmlFor="phone" className={`${getLabelClasses()} sm:mt-2 sm:text-right`}>
            Phone{" "}
            <span className={`text-gray-600 ${getTypographyClasses("helper")}`}>(optional)</span>
          </Label>
          <div className="sm:col-span-2">
            <Input
              id="phone"
              type="tel"
              placeholder="+63 9XX XXX XXXX"
              error={errors.phone?.message}
              className={`${getInputClasses(errors.phone ? "error" : "default")} h-11 font-mono sm:h-9`}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...register("phone")}
            />
            {errors.phone && (
              <p id="phone-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        {/* Accept Terms - Responsive Grid Aligned */}
        <div className="grid grid-cols-1 sm:grid-cols-3 sm:items-start sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className="sm:col-span-2">
            <div className="flex items-start space-x-2">
              <input
                id="acceptTerms"
                type="checkbox"
                required
                className={`mt-0.5 ${getCheckboxClasses(!!errors.acceptTerms)} h-5 min-h-[20px] w-5 min-w-[20px] transition-transform duration-150 ease-out checked:scale-105 hover:scale-105 motion-reduce:transition-none motion-reduce:checked:scale-100 motion-reduce:hover:scale-100`}
                style={getCheckboxStyles()}
                aria-invalid={!!errors.acceptTerms}
                aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
                {...register("acceptTerms")}
              />
              <div className={getTypographyClasses("helper")}>
                <Label htmlFor="acceptTerms" className={`${getLabelClasses()} font-normal`}>
                  I agree to the{" "}
                  <Link to={ROUTES.terms} className={getLinkClasses("primary")}>
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to={ROUTES.privacy} className={getLinkClasses("primary")}>
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
            {errors.acceptTerms && (
              <p id="acceptTerms-error" role="alert" className={getErrorMessageClassesAnimated()}>
                {errors.acceptTerms.message}
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
              loadingText="Creating Account..."
              disabled={isLoading || !isValid}
            >
              Create Account
            </Button>
          </div>
        </div>

        {/* Link to Login - Responsive Professional Styling */}
        <div className="grid grid-cols-1 pt-1 sm:grid-cols-3 sm:items-center sm:gap-x-4">
          <div className="hidden sm:block"></div>
          <div className={`sm:col-span-2 ${getTypographyClasses("helper")}`}>
            Already have an account?{" "}
            <Link to={ROUTES.login} className={getLinkClasses("primary")}>
              Sign In
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
