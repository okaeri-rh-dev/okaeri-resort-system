import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestPasswordResetWithAudit } from "@/lib/auth-password-reset";

/**
 * Forgot Password Form Component
 *
 * Allows users to request a password reset email.
 *
 * Security: Always shows success message regardless of whether
 * the email exists to prevent email enumeration attacks.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await requestPasswordResetWithAudit(email);
    } catch (error) {
      // Log error but don't expose to user (prevents enumeration)
      console.error("Reset error:", error);
    } finally {
      // ALWAYS show success - prevents email enumeration
      setSubmitted(true);
      setLoading(false);
    }
  };

  // Success state - shown after form submission
  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            If an account with that email exists, you will receive a password reset link shortly.
          </p>
          <p className="text-center text-sm text-gray-500">
            Didn't receive an email? Check your spam folder or try again in a few minutes.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="outline" onClick={() => setSubmitted(false)} className="w-full">
              Try Another Email
            </Button>
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

  // Form state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
        <p className="text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email-reset"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@resort.com"
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
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
