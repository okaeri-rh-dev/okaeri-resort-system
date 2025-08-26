/**
 * Reset Password Form Component
 * Features React Hook Form with Zod validation, token validation, and password strength indicator
 */

import React, { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle,
  Key,
  Shield,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {
  resetPasswordSchema,
  type ResetPasswordFormData,
  checkPasswordStrength,
} from "@/lib/validations/auth";
import { apiClient } from "@/lib/api-client";

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

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" });
  const token = (search as any)?.token || "";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token,
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = useWatch({
    control,
    name: "password",
  });

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError("Invalid or missing reset token");
        setIsValidatingToken(false);
        return;
      }

      try {
        await apiClient.post("/auth/validate-reset-token", { token });
        setIsValidatingToken(false);
      } catch (error: any) {
        setTokenError(
          error.response?.status === 400
            ? "This reset link has expired or is invalid"
            : "Unable to validate reset token"
        );
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      clearErrors();

      await apiClient.post("/auth/reset-password-confirm", {
        token: data.token,
        password: data.password,
      });

      setIsSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 3000);
    } catch (error: any) {
      // Handle specific error types
      if (error.response?.status === 400) {
        if (error.message.includes("expired")) {
          setError("token", { message: "This reset link has expired" });
        } else if (error.message.includes("invalid")) {
          setError("token", { message: "This reset link is invalid or has already been used" });
        } else {
          setError("root", { message: "Invalid reset request" });
        }
      } else if (error.message.includes("password")) {
        setError("password", { message: error.message });
      } else {
        setError("root", {
          message: error.message || "Failed to reset password. Please try again.",
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

  const isFormLoading = isSubmitting;

  // Show loading state while validating token
  if (isValidatingToken) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Reset Password
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Validating your reset link...
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-ocean-600 h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state for invalid token
  if (tokenError) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Invalid Reset Link
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{tokenError}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Password reset links expire after 15 minutes for security reasons.
              </p>

              <div className="flex flex-col space-y-3">
                <Link to="/forgot-password">
                  <Button className="bg-ocean-600 hover:bg-ocean-700 w-full">
                    Request New Reset Link
                  </Button>
                </Link>

                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Password Reset Successful
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Your password has been successfully updated.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-300">
                You can now sign in with your new password. You'll be redirected to the login page
                in a few seconds.
              </p>
            </div>

            <Link to="/login">
              <Button className="bg-ocean-600 hover:bg-ocean-700 w-full">
                Continue to Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main form
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="bg-ocean-100 dark:bg-ocean-900/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <Shield className="text-ocean-600 dark:text-ocean-400 h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reset Password
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Create a new secure password for your account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Error Message */}
        {(errors.root || errors.token) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{errors.root?.message || errors.token?.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Hidden Token Field */}
          <input type="hidden" {...register("token")} />

          {/* Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New Password
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
                autoFocus
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
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
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

          {/* Security Notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start gap-2">
              <Key className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="mb-1 font-medium">Security Tips</p>
                <ul className="space-y-1 text-xs">
                  <li>• Use a unique password you haven't used elsewhere</li>
                  <li>• Include a mix of letters, numbers, and symbols</li>
                  <li>• Consider using a password manager</li>
                </ul>
              </div>
            </div>
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
                Updating Password...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Update Password
              </>
            )}
          </Button>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              to="/login"
              className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 text-sm font-medium"
            >
              Back to Sign In
            </Link>
          </div>
        </form>

        {/* Additional Help */}
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="text-center">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Need help with your account?
            </p>
            <Link
              to="/help/contact"
              className="hover:text-ocean-600 dark:hover:text-ocean-400 text-xs text-gray-600 dark:text-gray-400"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
