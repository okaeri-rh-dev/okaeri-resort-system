import { useRef, useState } from "react";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/patterns";

export function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Development mode detection for Turnstile bypass
  const isDev = import.meta.env.DEV;
  const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const shouldSkipTurnstile = isDev && (skipTurnstile || !siteKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side password match validation
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    // Require Turnstile token unless in dev mode with bypass
    if (!turnstileToken && !shouldSkipTurnstile) {
      toast.error("Please complete the security verification.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          turnstile_token: turnstileToken || "dev-mock-token",
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSubmitted(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed. Please try again.";
      toast.error(message);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Check if submit should be disabled
  const isSubmitDisabled = loading || (!turnstileToken && !shouldSkipTurnstile);

  // Success state - shown after successful registration
  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-success mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <Mail className="text-success-foreground h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            We've sent a verification link to <strong>{email}</strong>. Please check your inbox and
            click the link to verify your account.
          </p>
          <p className="text-muted-foreground text-center text-sm">
            Didn't receive an email? Check your spam folder or try again in a few minutes.
          </p>
          <div className="pt-4">
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Sign In
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
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <p className="text-muted-foreground">Sign up to access the resort system</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full-name" className="mb-1 block text-sm font-medium">
              Full Name
            </label>
            <Input
              id="full-name"
              type="text"
              name="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email-signup"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              name="password-signup"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordStrengthIndicator password={password} className="mt-2" />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              name="confirm-password-signup"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby={
                confirmPassword && password !== confirmPassword
                  ? "confirm-password-error"
                  : undefined
              }
            />
            {confirmPassword && password !== confirmPassword && (
              <p
                id="confirm-password-error"
                className="text-danger-foreground mt-1 text-sm"
                role="alert"
              >
                Passwords do not match
              </p>
            )}
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
                  action: "sign-up",
                }}
              />
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {loading ? "Creating Account..." : "Create Account"}
          </Button>

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
