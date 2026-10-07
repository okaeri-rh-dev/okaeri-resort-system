import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updatePasswordWithAudit } from "@/lib/auth-password-reset";
import { supabase } from "@/lib/supabase";

import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

/**
 * Reset Password Form Component
 *
 * Allows users to set a new password after clicking the reset link in their email.
 * Validates that passwords match and meet minimum requirements.
 * Includes a password strength indicator for better UX.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // Supabase automatically sets a recovery session when user clicks the reset link
      setIsValidSession(!!session);
      setChecking(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate minimum length
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await updatePasswordWithAudit(password);
      toast.success("Password updated successfully!");
      setSuccess(true);

      // Sign out and redirect to login after 3 seconds
      setTimeout(() => {
        void supabase.auth.signOut().finally(() => {
          window.location.href = "/login";
        });
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking session
  if (checking) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="border-t-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200" />
            <p className="text-gray-600">Verifying reset link...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Invalid or expired link state
  if (!isValidSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Invalid or Expired Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            This password reset link has expired or is invalid. Please request a new one.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Link to="/forgot-password" className="w-full">
              <Button className="w-full">Request New Link</Button>
            </Link>
            <Link to="/login" className="w-full">
              <Button variant="ghost" className="w-full">
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-600">Password Updated!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Your password has been successfully updated. You will be redirected to the login page in
            a moment.
          </p>
          <div className="pt-4">
            <Button className="w-full" onClick={() => (window.location.href = "/login")}>
              Go to Login Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Password reset form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
        <p className="text-gray-600">Enter your new password below</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              New Password
            </label>
            <Input
              id="password"
              type="password"
              name="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={8}
              autoFocus
            />
            <PasswordStrengthIndicator password={password} className="mt-2" />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || password !== confirmPassword || password.length < 8}
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>

          <div className="text-center">
            <Link to="/login" className="text-primary text-sm hover:underline">
              Back to Login
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
