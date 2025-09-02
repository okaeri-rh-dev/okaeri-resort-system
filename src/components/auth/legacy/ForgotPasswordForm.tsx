/**
 * Forgot Password Form Component
 * Features React Hook Form with Zod validation, rate limiting feedback, and success states
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Mail, Send, ArrowLeft, AlertCircle, Loader2, CheckCircle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/authStore";

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const { resetPassword, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      clearError();
      clearErrors();
      await resetPassword(data.email);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes("not found") || error.message.includes("does not exist")) {
        setError("email", { message: "No account found with this email address" });
      } else if (error.message.includes("rate limit")) {
        setError("email", {
          message: "Too many reset attempts. Please wait before trying again.",
        });
      } else {
        setError("root", {
          message: error.message || "Failed to send reset email. Please try again.",
        });
      }
    }
  };

  const handleBackToLogin = () => {
    setIsSuccess(false);
    setSubmittedEmail("");
    clearError();
  };

  const resendEmail = async () => {
    if (submittedEmail) {
      try {
        await resetPassword(submittedEmail);
      } catch (error: any) {
        setError("root", {
          message: error.message || "Failed to resend email. Please try again.",
        });
      }
    }
  };

  const isFormLoading = isSubmitting || isLoading;

  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Check Your Email
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            We've sent password reset instructions to your email address.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We sent a password reset link to
              </p>
              <p className="mt-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                {submittedEmail}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The link will expire in 15 minutes. If you don't see the email, check your spam
                folder.
              </p>

              <div className="flex flex-col space-y-3">
                <Button
                  onClick={resendEmail}
                  variant="outline"
                  className="w-full"
                  disabled={isFormLoading}
                >
                  {isFormLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Resend Email
                    </>
                  )}
                </Button>

                <Button onClick={handleBackToLogin} variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </div>
            </div>
          </div>

          {/* Error Display for Resend */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Additional Help */}
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="text-center">
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Still having trouble?</p>
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

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Forgot Password?
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          No worries! Enter your email address and we'll send you reset instructions.
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
                aria-describedby={errors.email ? "email-error" : "email-help"}
                autoComplete="email"
                autoCapitalize="none"
                autoFocus
              />
            </div>
            {errors.email ? (
              <p id="email-error" className="text-sm text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            ) : (
              <p id="email-help" className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email address associated with your account
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
                Sending Reset Link...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reset Link
              </>
            )}
          </Button>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              to="/login"
              className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 inline-flex items-center text-sm font-medium"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </form>

        {/* Rate Limiting Information */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p className="mb-1 font-medium">Rate Limiting</p>
              <p className="text-xs">
                For security, password reset emails are limited to 3 attempts per hour. Please check
                your spam folder before requesting another email.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Help */}
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="text-center">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Having trouble accessing your account?
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
                to="/register"
                className="hover:text-ocean-600 dark:hover:text-ocean-400 text-gray-600 dark:text-gray-400"
              >
                Create New Account
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
