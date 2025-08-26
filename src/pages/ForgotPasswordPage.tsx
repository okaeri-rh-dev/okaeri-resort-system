/**
 * Forgot Password Page
 * Uses AuthLayout with ForgotPasswordForm component
 */

import { AuthLayout } from "@/layouts/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
