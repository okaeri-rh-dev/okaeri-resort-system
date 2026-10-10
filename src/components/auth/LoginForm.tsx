import { useRef, useState } from "react";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseAuth } from "@/lib/supabase";

interface LoginFormProps {
  onSuccess: () => void;
  registered?: boolean;
  confirmed?: boolean;
}

export function LoginForm({ onSuccess, registered, confirmed }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Development mode detection for Turnstile bypass
  const isDev = import.meta.env.DEV;
  const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const shouldSkipTurnstile = isDev && (skipTurnstile || !siteKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require Turnstile token unless in dev mode with bypass
    if (!turnstileToken && !shouldSkipTurnstile) {
      toast.error("Please complete the security verification.");
      return;
    }

    setLoading(true);

    try {
      // Call the login API with Turnstile verification
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          turnstile_token: turnstileToken || "dev-mock-token",
        }),
      });

      const data = (await response.json()) as {
        session?: {
          access_token: string;
          refresh_token: string;
        };
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Set session in Supabase client
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabaseAuth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      toast.success("Logged in successfully!");
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed. Please check your credentials.";
      toast.error(message);
      console.error("Login error:", error);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Check if submit should be disabled
  const isSubmitDisabled = loading || (!turnstileToken && !shouldSkipTurnstile);

  return (
    <div className="flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Okaeri Resort System</CardTitle>
          <p className="text-gray-600">Sign in to continue</p>
        </CardHeader>
        <CardContent>
          {registered && (
            <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Account created! Please check your email to verify before signing in.
              </AlertDescription>
            </Alert>
          )}
          {confirmed && (
            <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Email verified! You can now sign in.</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email-login"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@resort.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                name="password-login"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-primary text-sm hover:underline">
                Forgot password?
              </Link>
            </div>

            {/* Turnstile Widget */}
            <div className="flex justify-center">
              {shouldSkipTurnstile ? (
                <Alert className="border-amber-500/50 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Development Mode:</strong> Security verification disabled.
                  </AlertDescription>
                </Alert>
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
                    action: "admin-login",
                  }}
                />
              )}
            </div>

            {/* size="lg" (h-10/40px): default h-9 (36px) is below the 40px
                minimum mobile touch target asserted in e2e/auth.spec.ts and
                shorter than the h-10 inputs above. */}
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitDisabled}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center text-sm">
              Don't have an account?{" "}
              <Link to="/sign-up" className="text-primary hover:underline">
                Create one
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
