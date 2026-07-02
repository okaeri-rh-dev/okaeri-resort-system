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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Okaeri Resort System
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
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
