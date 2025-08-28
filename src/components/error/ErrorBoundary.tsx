import type { ErrorInfo, ReactNode } from "react";
import React, { Component } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: "page" | "component" | "critical";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for monitoring
    this.logError(error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logError = async (error: Error, errorInfo: ErrorInfo) => {
    const { level = "component" } = this.props;
    const { errorId } = this.state;

    const errorData = {
      id: errorId,
      timestamp: new Date().toISOString(),
      level,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getUserId(),
      projectId: this.getProjectId(),
    };

    try {
      // Log to console for development
      if (process.env.NODE_ENV === "development") {
        console.group(`🔴 Error Boundary - ${level.toUpperCase()}`);
        console.error("Error:", error);
        console.error("Error Info:", errorInfo);
        console.error("Error Data:", errorData);
        console.groupEnd();
      }

      // Send to monitoring service (implement your preferred service)
      await this.sendErrorToMonitoring(errorData);
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
  };

  private sendErrorToMonitoring = async (errorData: any) => {
    // Implement your error monitoring service here
    // Examples: Sentry, LogRocket, Bugsnag, or custom analytics

    try {
      // Example implementation - replace with your service
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorData),
      });
    } catch (error) {
      // Fail silently to avoid infinite error loops
      console.warn("Error monitoring service unavailable");
    }
  };

  private getUserId = (): string | null => {
    // SECURITY: User ID should be retrieved from token/auth context, not browser storage
    // This is only for development debugging purposes
    try {
      // In development mode, check browser storage for debugging
      if (import.meta.env.DEV) {
        const devUserId = sessionStorage.getItem("userId");
        if (devUserId) {
          console.warn(
            "[DEV WARNING] User ID found in sessionStorage. " +
              "In production, retrieve user ID from authentication context."
          );
          return devUserId;
        }
      }

      // TODO: In production, get user ID from auth context/token
      // Example: return authStore.currentUser?.id || null;
      return null;
    } catch {
      return null;
    }
  };

  private getProjectId = (): string | null => {
    // SECURITY: Project ID should be retrieved from app state/context, not browser storage
    try {
      // In development mode, check browser storage for debugging
      if (import.meta.env.DEV) {
        const devProjectId = sessionStorage.getItem("currentProjectId");
        if (devProjectId) {
          console.warn(
            "[DEV WARNING] Project ID found in sessionStorage. " +
              "In production, retrieve project ID from application state."
          );
          return devProjectId;
        }
      }

      // TODO: In production, get project ID from app state/context
      // Example: return projectStore.currentProjectId || null;
      return null;
    } catch {
      return null;
    }
  };

  private handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount < this.maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
      }));

      // Auto-retry after a delay for certain errors
      if (this.shouldAutoRetry()) {
        this.retryTimeoutId = setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else {
      // Max retries reached, reload page
      window.location.reload();
    }
  };

  private shouldAutoRetry = (): boolean => {
    const { error } = this.state;
    if (!error) return false;

    // Auto-retry for network-related errors
    const networkErrors = ["NetworkError", "ChunkLoadError", "Loading chunk", "Loading CSS chunk"];

    return networkErrors.some(
      (errorType) => error.message.includes(errorType) || error.name.includes(errorType)
    );
  };

  private handleReportBug = () => {
    const { error, errorInfo, errorId } = this.state;

    const bugReport = {
      errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Create mailto link or open bug reporting modal
    const subject = encodeURIComponent(`Bug Report - Error ${errorId}`);
    const body = encodeURIComponent(
      `
Error Details:
- ID: ${errorId}
- Message: ${error?.message}
- URL: ${window.location.href}
- Time: ${new Date().toLocaleString()}

Please describe what you were doing when this error occurred:
[Your description here]
    `.trim()
    );

    window.open(`mailto:support@okaeri.com?subject=${subject}&body=${body}`);
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    const { hasError, error, retryCount } = this.state;
    const { fallback, children, showDetails = false, level = "component" } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      return (
        <div className="from-sand-50 to-ocean-50 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
          <Card className="border-coral-200 mx-auto w-full max-w-lg shadow-xl">
            <CardHeader className="space-y-4 text-center">
              <div className="bg-coral-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <AlertTriangle className="text-coral-600 h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-ocean-900 text-2xl">
                  Oops! Something went wrong
                </CardTitle>
                <CardDescription className="mt-2 text-lg">
                  {level === "critical"
                    ? "We're experiencing technical difficulties. Our team has been notified."
                    : "Don't worry, this happens sometimes. Let's get you back on track!"}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error details for development or when explicitly shown */}
              {(showDetails || process.env.NODE_ENV === "development") && error && (
                <div className="bg-sand-50 border-sand-200 rounded-lg border p-4">
                  <h4 className="text-ocean-800 mb-2 font-semibold">Error Details:</h4>
                  <div className="text-ocean-700 space-y-1 text-sm">
                    <div>
                      <strong>Message:</strong> {error.message}
                    </div>
                    <div>
                      <strong>Type:</strong> {error.name}
                    </div>
                    {this.state.errorId && (
                      <div>
                        <strong>ID:</strong> {this.state.errorId}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={this.handleRetry}
                  disabled={retryCount >= this.maxRetries}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {retryCount >= this.maxRetries ? "Reload Page" : "Try Again"}
                </Button>

                <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {/* Report bug option for critical errors */}
              {level === "critical" && (
                <Button
                  onClick={this.handleReportBug}
                  variant="ghost"
                  size="sm"
                  className="text-ocean-600 hover:text-ocean-700 w-full"
                >
                  <Bug className="mr-2 h-4 w-4" />
                  Report this issue
                </Button>
              )}

              {/* Retry count indicator */}
              {retryCount > 0 && (
                <div className="text-ocean-600 text-center text-sm">
                  Retry attempt {retryCount} of {this.maxRetries}
                </div>
              )}

              {/* Friendly message */}
              <div className="text-ocean-600 border-t pt-4 text-center text-sm">
                Need help? Contact our support team at{" "}
                <a
                  href="mailto:support@okaeri.com"
                  className="text-ocean-700 hover:text-ocean-800 underline"
                >
                  support@okaeri.com
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: Omit<ErrorBoundaryProps, "children">
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;
