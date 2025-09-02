/**
 * Registration Form Component
 * Features React Hook Form with Zod validation, password strength indicator, and comprehensive error handling
 */

import React, { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  AlertCircle,
  Loader2,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, PhoneInput } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {
  registerSchema,
  type RegisterFormData,
  checkPasswordStrength,
} from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";

interface PasswordStrengthIndicatorProps {
  password: string;
}

function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return null;
    return checkPasswordStrength(password);
  }, [password]);

  if (!strength) return null;

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case "weak":
        return "bg-red-500";
      case "fair":
        return "bg-yellow-500";
      case "good":
        return "bg-blue-500";
      case "strong":
        return "bg-green-500";
      default:
        return "bg-gray-300";
    }
  };

  const getStrengthText = (strength: string) => {
    switch (strength) {
      case "weak":
        return "Weak";
      case "fair":
        return "Fair";
      case "good":
        return "Good";
      case "strong":
        return "Strong";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 dark:text-gray-400">Password strength</span>
        <span
          className={`text-xs font-medium ${
            strength.strength === "weak"
              ? "text-red-500"
              : strength.strength === "fair"
                ? "text-yellow-500"
                : strength.strength === "good"
                  ? "text-blue-500"
                  : "text-green-500"
          }`}
        >
          {getStrengthText(strength.strength)}
        </span>
      </div>

      <div className="flex space-x-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full ${
              level <= strength.score / 25
                ? getStrengthColor(strength.strength)
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      {strength.suggestions.length > 0 && (
        <div className="space-y-1">
          {strength.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-1">
                {strength.checks[Object.keys(strength.checks)[index]] ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <X className="h-3 w-3 text-red-500" />
                )}
                <span>{suggestion}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
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

  const watchedPassword = useWatch({
    control,
    name: "password",
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      clearErrors();

      const registerData = {
        name: data.name,
        email: data.email,
        password: data.password,
        projectName: data.projectName || undefined,
      };

      await registerUser(registerData);
    } catch (error: any) {
      // Handle specific error types
      if (
        error.message.includes("already exists") ||
        error.message.includes("already registered")
      ) {
        setError("email", { message: "An account with this email already exists" });
      } else if (error.message.includes("rate limit")) {
        setError("email", { message: error.message });
      } else {
        setError("root", {
          message: error.message || "Registration failed. Please try again.",
        });
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const isFormLoading = isSubmitting || isLoading;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create Your Account
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Join Okaeri Resort Management System and start managing your paradise today.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Error Message */}
        {(error || errors.root) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error || errors.root?.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="Juan Dela Cruz"
                className={`pl-10 ${errors.name ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("name")}
                aria-describedby={errors.name ? "name-error" : undefined}
                autoComplete="name"
              />
            </div>
            {errors.name && (
              <p id="name-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                className={`pl-10 ${errors.email ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("email")}
                aria-describedby={errors.email ? "email-error" : undefined}
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>
            {errors.email && (
              <p id="email-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                className={`pr-10 pl-10 ${errors.password ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("password")}
                aria-describedby={errors.password ? "password-error" : "password-strength"}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isFormLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
            {/* Password Strength Indicator */}
            <div id="password-strength">
              <PasswordStrengthIndicator password={watchedPassword || ""} />
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                className={`pr-10 pl-10 ${errors.confirmPassword ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("confirmPassword")}
                aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={toggleConfirmPasswordVisibility}
                className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isFormLoading}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Project Name Field (Optional) */}
          <div className="space-y-2">
            <Label
              htmlFor="projectName"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Resort/Property Name <span className="text-gray-500">(Optional)</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="projectName"
                type="text"
                placeholder="e.g., Paradise Beach Resort"
                className={`pl-10 ${errors.projectName ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("projectName")}
                aria-describedby={errors.projectName ? "project-name-error" : undefined}
                autoComplete="organization"
              />
            </div>
            {errors.projectName && (
              <p id="project-name-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.projectName.message}
              </p>
            )}
          </div>

          {/* Phone Field (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Phone Number <span className="text-gray-500">(Optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                className={`pl-10 ${errors.phone ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("phone")}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                autoComplete="tel"
              />
            </div>
            {errors.phone && (
              <p id="phone-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <input
                id="acceptTerms"
                type="checkbox"
                className={`text-ocean-600 focus:ring-ocean-500 mt-0.5 h-4 w-4 rounded border-gray-300 focus:ring-offset-0 ${
                  errors.acceptTerms ? "border-red-300" : ""
                }`}
                disabled={isFormLoading}
                {...register("acceptTerms")}
                aria-describedby={errors.acceptTerms ? "terms-error" : undefined}
              />
              <Label
                htmlFor="acceptTerms"
                className="cursor-pointer text-sm leading-5 text-gray-600 dark:text-gray-400"
              >
                I agree to the{" "}
                <Link
                  to="/terms"
                  className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 font-medium"
                  target="_blank"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 font-medium"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {errors.acceptTerms && (
              <p id="terms-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="bg-ocean-600 hover:bg-ocean-700 w-full rounded-lg py-2.5 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isFormLoading}
            size="lg"
          >
            {isFormLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 font-medium"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </form>

        {/* Additional Help */}
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="text-center">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Need help getting started?
            </p>
            <div className="flex justify-center space-x-4 text-xs">
              <Link
                to="/help/setup"
                className="hover:text-ocean-600 dark:hover:text-ocean-400 text-gray-600 dark:text-gray-400"
              >
                Setup Guide
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <Link
                to="/help/contact"
                className="hover:text-ocean-600 dark:hover:text-ocean-400 text-gray-600 dark:text-gray-400"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
