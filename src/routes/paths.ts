/**
 * Central route path constants to prevent drift and maintain consistency
 * All route paths should reference these constants instead of using string literals
 *
 * IMPORTANT: Always import and use these constants for navigation!
 * - Components should use ROUTES.login instead of '/_auth/login'
 * - Tests should assert against ROUTES constants, not hardcoded strings
 * - Guards and redirects must use these constants for consistency
 *
 * Created during Phase 1.2 second remediation to fix navigation issues
 */

export const ROUTES = {
  // Auth routes (public)
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  // Protected routes
  dashboard: "/dashboard",

  // Error routes
  unauthorized: "/unauthorized",

  // Legal pages
  terms: "/terms",
  privacy: "/privacy",

  // Root
  root: "/",
} as const;

// Type for route paths
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

// Helper to get route with params
export const getRoute = {
  resetPasswordWithToken: (token: string) => `${ROUTES.resetPassword}?token=${token}`,
  returnToLogin: (returnUrl?: string) =>
    returnUrl ? `${ROUTES.login}?redirect=${encodeURIComponent(returnUrl)}` : ROUTES.login,
};
