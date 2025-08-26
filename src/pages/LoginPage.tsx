import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
