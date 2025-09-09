/**
 * Authentication Components Exports
 * Internal staff authentication only - no customer registration
 */

// Form Components - Staff Only
export { LoginForm } from "@/features/auth/components/LoginForm";
// RegisterForm removed - staff accounts created by admin
// ForgotPasswordForm and ResetPasswordForm are in features/auth
export { PasswordResetForm } from "@/features/auth/components/PasswordResetForm";

// Security Components (from legacy)
export { PermissionGate } from "./legacy/PermissionGate";
export { RouteGuard } from "./legacy/RouteGuard";
export { SessionTimeoutWarning } from "./legacy/SessionTimeoutWarning";

// Type exports from validation schemas
export type {
  LoginFormData,
  // RegisterFormData removed - no customer registration
  ForgotPasswordFormData,
  ResetPasswordFormData,
} from "@/lib/validations/auth";
