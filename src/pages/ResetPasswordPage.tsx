/**
 * Reset Password Page
 * Uses AuthLayout with ResetPasswordForm component
 */

import { AuthLayout } from "@/layouts/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
