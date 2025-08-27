/**
 * Login Form Component
 * Features React Hook Form with Zod validation, loading states, and error handling
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";
// [PHASE 1-4 DEV UI - Remove in Phase 5.2]
import { config } from "@/config";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    setValue, // Add this to expose setValue for dev UI
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      clearErrors();
      await login(data.email, data.password);
    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes("Invalid credentials")) {
        setError("email", { message: "Invalid email or password" });
        setError("password", { message: "Invalid email or password" });
      } else if (error.message.includes("rate limit")) {
        setError("email", { message: error.message });
      } else {
        setError("root", { message: error.message || "Login failed. Please try again." });
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isFormLoading = isSubmitting || isLoading;

  // [PHASE 1-4 DEV UI - Remove this block in Phase 5.2]
  const isDevelopmentMode = import.meta.env.DEV && config.development?.mockAuth;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Sign in to your Okaeri Resort account to continue managing your paradise.
        </CardDescription>
      </CardHeader>

      {/* [PHASE 1-4 DEV UI - Remove in Phase 5.2] */}
      {isDevelopmentMode && (
        <div className="mx-6 mb-4 rounded-md border border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-lg">🔧</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Development Mode - Mock Authentication Active
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Using mock authentication service. DO NOT USE IN PRODUCTION.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* [PHASE 1-4 DEV UI - Remove in Phase 5.2] */}
      {isDevelopmentMode && (
        <div className="mx-6 mb-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Auto-fill owner credentials
              const form = document.querySelector("form");
              if (form) {
                const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement;
                const passwordInput = form.querySelector(
                  'input[type="password"]'
                ) as HTMLInputElement;
                if (emailInput) emailInput.value = "owner@okaeriresort.ph";
                if (passwordInput) passwordInput.value = "correct-password";

                // Trigger React Hook Form to recognize the values
                setValue("email", "owner@okaeriresort.ph");
                setValue("password", "correct-password");
              }
            }}
            className="flex items-center gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
          >
            <span className="text-xs">⚡</span>
            Use Owner Test Account
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Auto-fill staff credentials
              setValue("email", "staff@okaeriresort.ph");
              setValue("password", "correct-password");
            }}
            className="flex items-center gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
          >
            <span className="text-xs">👤</span>
            Use Staff Test Account
          </Button>
        </div>
      )}

      <CardContent className="space-y-6">
        {/* Global Error Message */}
        {(error || errors.root) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error || errors.root?.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                placeholder="Enter your password"
                className={`pr-10 pl-10 ${errors.password ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
                disabled={isFormLoading}
                {...register("password")}
                aria-describedby={errors.password ? "password-error" : undefined}
                autoComplete="current-password"
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
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                id="rememberMe"
                type="checkbox"
                className="text-ocean-600 focus:ring-ocean-500 h-4 w-4 rounded border-gray-300 focus:ring-offset-0"
                disabled={isFormLoading}
                {...register("rememberMe")}
              />
              <Label
                htmlFor="rememberMe"
                className="cursor-pointer text-sm text-gray-600 dark:text-gray-400"
              >
                Remember me
              </Label>
            </div>
            <Link
              to="/forgot-password"
              className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 text-sm font-medium"
            >
              Forgot password?
            </Link>
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
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 font-medium"
              >
                Create your resort account
              </Link>
            </p>
          </div>
        </form>

        {/* Additional Help */}
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="text-center">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Having trouble signing in?
            </p>
            <div className="flex justify-center space-x-4 text-xs">
              <Link
                to="/help/account-recovery"
                className="hover:text-ocean-600 dark:hover:text-ocean-400 text-gray-600 dark:text-gray-400"
              >
                Account Recovery
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
