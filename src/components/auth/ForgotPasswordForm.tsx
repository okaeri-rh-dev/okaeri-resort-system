import { useRef, useState } from "react";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Link } from "@tanstack/react-router";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/patterns";

/**
 * Forgot Password Form Component
 *
 * Allows users to request a password reset email.
 * Now includes Turnstile verification for bot protection.
 *
 * Security: Always shows success message regardless of whether
 * the email exists to prevent email enumeration attacks.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Development mode detection for Turnstile bypass
  const isDev = import.meta.env.DEV;
  const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const shouldSkipTurnstile = isDev && (skipTurnstile || !siteKey);

  const handleTryAnotherEmail = () => {
    setSubmitted(false);
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call the forgot-password API with Turnstile verification
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          turnstile_token: turnstileToken || "dev-mock-token",
        }),
      });

      // Even if there's an error, we show success to prevent enumeration
      // The API handles this server-side as well
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        // Only show error for Turnstile failures, not for email-related issues
        if (data.error === "TURNSTILE_FAILED") {
          console.error("Turnstile verification failed");
          // Still show success to prevent enumeration
        }
      }
    } catch (error) {
      // Log error but don't expose to user (prevents enumeration)
      // eslint-disable-next-line no-restricted-syntax -- always show success so emails cannot be enumerated
      console.error("Reset error:", error);
    } finally {
      // ALWAYS show success - prevents email enumeration
      setSubmitted(true);
      setLoading(false);
    }
  };

  // Check if submit should be disabled
  const isSubmitDisabled = loading || (!turnstileToken && !shouldSkipTurnstile);

  // Success state - shown after form submission
  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            If an account with that email exists, you will receive a password reset link shortly.
          </p>
          <p className="text-muted-foreground text-center text-sm">
            Didn't receive an email? Check your spam folder or try again in a few minutes.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="outline" onClick={handleTryAnotherEmail} className="w-full">
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
        <p className="text-muted-foreground">
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

          {/* Turnstile Widget */}
          <div className="flex justify-center">
            {shouldSkipTurnstile ? (
              <Callout tone="warning">
                <strong>Development Mode:</strong> Security verification disabled.
              </Callout>
            ) : (
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey || ""}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{
                  theme: "light",
                  size: "normal",
                  action: "admin-forgot-password",
                }}
              />
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
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
