// @vitest-environment node
// (happy-dom drops the Origin header, which the browser forbids scripts to set)
import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
const signUp = vi.fn(async () => ({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail, signUp } }),
}));

const { onRequestPost: forgotPassword } =
  await import("../../../functions/api/auth/forgot-password");
const { onRequestPost: signUpPost } = await import("../../../functions/api/auth/sign-up");

const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  TURNSTILE_SECRET_KEY: "turnstile",
  ENVIRONMENT: "development",
  SITE_URL: "https://site.example",
};

const spoofedPost = (path: string, body: Record<string, string>) =>
  new Request(`https://okaeri.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ turnstile_token: "dev-mock-token", ...body }),
  });

describe("auth email links ignore the Origin header", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the password reset link from SITE_URL", async () => {
    await forgotPassword({
      request: spoofedPost("/api/auth/forgot-password", { email: "guest@example.com" }),
      env,
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("guest@example.com", {
      redirectTo: "https://site.example/reset-password",
    });
  });

  it("falls back to the request's own origin when SITE_URL is unset", async () => {
    await forgotPassword({
      request: spoofedPost("/api/auth/forgot-password", { email: "guest@example.com" }),
      env: { ...env, SITE_URL: undefined },
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("guest@example.com", {
      redirectTo: "https://okaeri.example/reset-password",
    });
  });

  it("builds the sign-up confirmation link from SITE_URL", async () => {
    await signUpPost({
      request: spoofedPost("/api/auth/sign-up", {
        email: "new@example.com",
        password: "long-enough-password",
        full_name: "New Staff",
      }),
      env,
    });

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://site.example/login?confirmed=true",
        }),
      })
    );
  });
});
