import React from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorComponent, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  FileQuestion,
} from "lucide-react";

interface RouteErrorBoundaryProps extends ErrorComponentProps {
  showDetails?: boolean;
}

const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({
  error,
  reset,
  showDetails = false,
}) => {
  const router = useRouter();

  // Determine error type and appropriate response
  const getErrorInfo = () => {
    const message = error?.message || "";
    const status = (error as any)?.status || 500;

    // Network errors
    if (message.includes("fetch") || message.includes("network") || !navigator.onLine) {
      return {
        type: "network",
        title: "Connection Problem",
        description: "We can't reach our servers right now. Check your internet connection.",
        icon: WifiOff,
        color: "coral",
        canRetry: true,
      };
    }

    // 404 Not Found
    if (status === 404 || message.includes("404") || message.includes("not found")) {
      return {
        type: "notFound",
        title: "Page Not Found",
        description: "The page you're looking for doesn't exist or has been moved.",
        icon: FileQuestion,
        color: "ocean",
        canRetry: false,
      };
    }

    // 403 Forbidden
    if (status === 403 || message.includes("403") || message.includes("forbidden")) {
      return {
        type: "forbidden",
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        icon: Shield,
        color: "coral",
        canRetry: false,
      };
    }

    // 500 Server Error
    if (status >= 500 || message.includes("500") || message.includes("server error")) {
      return {
        type: "server",
        title: "Server Error",
        description: "Something went wrong on our end. We're working to fix it.",
        icon: AlertTriangle,
        color: "sunset",
        canRetry: true,
      };
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("aborted")) {
      return {
        type: "timeout",
        title: "Request Timed Out",
        description: "The request took too long. This might be due to slow internet.",
        icon: Clock,
        color: "coral",
        canRetry: true,
      };
    }

    // Chunk loading errors (common with code splitting)
    if (message.includes("ChunkLoadError") || message.includes("Loading chunk")) {
      return {
        type: "chunk",
        title: "Loading Error",
        description: "Failed to load application resources. This usually happens after updates.",
        icon: RefreshCw,
        color: "ocean",
        canRetry: true,
      };
    }

    // Generic error
    return {
      type: "generic",
      title: "Something Went Wrong",
      description: "An unexpected error occurred. Don't worry, these things happen!",
      icon: AlertTriangle,
      color: "coral",
      canRetry: true,
    };
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  const handleRetry = () => {
    if (errorInfo.type === "chunk") {
      // For chunk errors, reload the page to get fresh resources
      window.location.reload();
    } else {
      // Use router reset for other errors
      reset();
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };

  const handleGoHome = () => {
    router.navigate({ to: "/" });
  };

  const isOnline = navigator.onLine;

  return (
    <div className="from-sand-50 to-ocean-50 flex min-h-screen items-center justify-center bg-gradient-to-br via-white p-4">
      <Card
        className="border-opacity-20 mx-auto w-full max-w-2xl border-2 shadow-xl"
        style={{ borderColor: `var(--color-${errorInfo.color}-300)` }}
      >
        <CardHeader className="space-y-6 pb-8 text-center">
          {/* Status indicator */}
          <div className="flex justify-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${
                errorInfo.color === "coral"
                  ? "bg-coral-100"
                  : errorInfo.color === "ocean"
                    ? "bg-ocean-100"
                    : errorInfo.color === "sunset"
                      ? "bg-sunset-100"
                      : "bg-sand-100"
              }`}
            >
              <IconComponent
                className={`h-10 w-10 ${
                  errorInfo.color === "coral"
                    ? "text-coral-600"
                    : errorInfo.color === "ocean"
                      ? "text-ocean-600"
                      : errorInfo.color === "sunset"
                        ? "text-sunset-600"
                        : "text-sand-600"
                }`}
              />
            </div>
          </div>

          {/* Error title and description */}
          <div className="space-y-3">
            <CardTitle className="text-ocean-900 text-3xl font-bold">{errorInfo.title}</CardTitle>
            <CardDescription className="text-ocean-700 mx-auto max-w-md text-lg leading-relaxed">
              {errorInfo.description}
            </CardDescription>
          </div>

          {/* Network status indicator */}
          {!isOnline && (
            <div className="bg-coral-100 text-coral-800 inline-flex items-center gap-2 rounded-full px-4 py-2">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-medium">You're offline</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error details for development */}
          {(showDetails || process.env.NODE_ENV === "development") && error && (
            <div className="bg-sand-50 border-sand-400 rounded-r-lg border-l-4 p-4">
              <h4 className="text-ocean-800 mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Technical Details
              </h4>
              <div className="text-ocean-700 space-y-2 font-mono text-sm">
                <div>
                  <strong>Error:</strong> {error.message}
                </div>
                {(error as any).status && (
                  <div>
                    <strong>Status:</strong> {(error as any).status}
                  </div>
                )}
                <div>
                  <strong>Path:</strong> {window.location.pathname}
                </div>
                <div>
                  <strong>Time:</strong> {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Retry button (if applicable) */}
            {errorInfo.canRetry && (
              <Button onClick={handleRetry} className="w-full" size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                {errorInfo.type === "chunk" ? "Reload Page" : "Try Again"}
              </Button>
            )}

            {/* Go back button */}
            <Button onClick={handleGoBack} variant="outline" className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>

            {/* Go home button */}
            <Button
              onClick={handleGoHome}
              variant="outline"
              className={`w-full ${errorInfo.canRetry ? "sm:col-span-2 lg:col-span-1" : ""}`}
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>

          {/* Helpful tips based on error type */}
          <div className="from-ocean-50 to-sand-50 border-ocean-100 rounded-lg border bg-gradient-to-r p-4">
            <h4 className="text-ocean-800 mb-2 font-semibold">💡 Quick Tips:</h4>
            <ul className="text-ocean-700 space-y-1 text-sm">
              {errorInfo.type === "network" && (
                <>
                  <li>• Check your internet connection</li>
                  <li>• Try refreshing the page</li>
                  <li>• Wait a moment and try again</li>
                </>
              )}
              {errorInfo.type === "notFound" && (
                <>
                  <li>• Double-check the URL spelling</li>
                  <li>• The page might have been moved or removed</li>
                  <li>• Use the navigation menu to find what you need</li>
                </>
              )}
              {errorInfo.type === "forbidden" && (
                <>
                  <li>• You might need to log in</li>
                  <li>• Contact your admin for access</li>
                  <li>• Try logging out and back in</li>
                </>
              )}
              {errorInfo.type === "server" && (
                <>
                  <li>• Our team has been automatically notified</li>
                  <li>• Try again in a few minutes</li>
                  <li>• The issue is likely temporary</li>
                </>
              )}
              {errorInfo.type === "chunk" && (
                <>
                  <li>• This happens after app updates</li>
                  <li>• Reloading will fix the issue</li>
                  <li>• Your data is safe</li>
                </>
              )}
              {errorInfo.type === "timeout" && (
                <>
                  <li>• Your connection might be slow</li>
                  <li>• Try using a stronger WiFi signal</li>
                  <li>• Consider trying again later</li>
                </>
              )}
            </ul>
          </div>

          {/* Support contact */}
          <div className="border-sand-200 border-t pt-4 text-center">
            <p className="text-ocean-600 text-sm">
              Still having trouble?{" "}
              <a
                href="mailto:support@okaeri.com"
                className="text-ocean-700 hover:text-ocean-800 font-medium underline"
              >
                Contact our support team
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Export both named and default
export { RouteErrorBoundary };
export default RouteErrorBoundary;

// Hook for programmatic error handling
export const useRouteError = () => {
  const router = useRouter();

  const handleError = (error: Error, context?: string) => {
    console.error(`Route Error ${context ? `(${context})` : ""}:`, error);

    // You can add custom error tracking here
    // trackError(error, { context, route: router.state.location.pathname });
  };

  return { handleError };
};
