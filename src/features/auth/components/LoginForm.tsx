/**
 * LoginForm Component - Phase 1.2 GREEN Implementation
 *
 * Minimal implementation to make Phase 1.1 tests pass.
 * This is TDD GREEN phase - basic functionality only.
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
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and password to access your account
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
          <Label htmlFor="email">Email</Label>
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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              error={errors.password?.message}
              className="pr-16"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="text-destructive text-sm">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center space-x-2">
          <input
            id="rememberMe"
            type="checkbox"
            className="text-ocean-600 focus:border-ocean-300 focus:ring-ocean-200 focus:ring-opacity-50 rounded border-gray-300 shadow-sm focus:ring"
            {...register("rememberMe")}
          />
          <Label htmlFor="rememberMe" className="text-sm font-normal">
            Remember me
          </Label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          loadingText="Signing in..."
          disabled={isLoading || !isValid}
        >
          Sign in
        </Button>

        {/* Links */}
        <div className="text-center">
          <Link
            to={ROUTES.forgotPassword}
            className="text-ocean-600 hover:text-ocean-500 text-sm underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="text-muted-foreground text-center text-sm">
          Don't have an account?{" "}
          <Link
            to={ROUTES.register}
            className="text-ocean-600 hover:text-ocean-500 font-medium underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
