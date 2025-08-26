/**
 * Authentication Components Exports
 * Centralized exports for all authentication-related components
 */

// Form Components
export { LoginForm } from "./LoginForm";
export { RegisterForm } from "./RegisterForm";
export { ForgotPasswordForm } from "./ForgotPasswordForm";
export { ResetPasswordForm } from "./ResetPasswordForm";

// Security Components
export { PermissionGate } from "./PermissionGate";
export { RouteGuard } from "./RouteGuard";
export { SessionTimeoutWarning } from "./SessionTimeoutWarning";

// Type exports from validation schemas
export type {
  LoginFormData,
  RegisterFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
} from "@/lib/validations/auth";
