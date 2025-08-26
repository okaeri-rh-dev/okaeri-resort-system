/**
 * Registration Page
 * Uses AuthLayout with RegisterForm component
 */

import { AuthLayout } from "@/layouts/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
