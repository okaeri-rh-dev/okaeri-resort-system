import { resolveSafeRedirect } from "@/components/auth/login-utils";
import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandedScreen } from "@/components/patterns";

interface LoginScreenProps {
  redirectTo?: string;
  registered?: boolean;
  confirmed?: boolean;
}

export function LoginScreen({ redirectTo, registered, confirmed }: LoginScreenProps) {
  const handleSuccess = () => {
    const target = resolveSafeRedirect(redirectTo, window.location.origin);
    if (target) {
      window.location.href = target;
    } else {
      window.location.reload();
    }
  };

  return (
    <ErrorBoundary level="page">
      <BrandedScreen subtitle="Sign in to access the resort management dashboard">
        <ErrorBoundary level="component">
          <LoginForm onSuccess={handleSuccess} registered={registered} confirmed={confirmed} />
        </ErrorBoundary>
      </BrandedScreen>
    </ErrorBoundary>
  );
}
