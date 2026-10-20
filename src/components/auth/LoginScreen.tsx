import { resolveSafeRedirect } from "@/components/auth/login-utils";
import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-foreground mt-6 text-center text-3xl font-extrabold">
              Okaeri Resort System
            </h2>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Sign in to access the resort management dashboard
            </p>
          </div>
          <ErrorBoundary level="component">
            <LoginForm onSuccess={handleSuccess} registered={registered} confirmed={confirmed} />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
