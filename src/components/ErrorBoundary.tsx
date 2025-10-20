import { Component, ErrorInfo, ReactNode } from "react";

import { AlertCircle, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: "page" | "component" | "app";
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }

    // In production, you could send this to an error reporting service
    // reportError(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const { level = "component", fallback } = this.props;

      if (fallback) {
        return fallback;
      }

      // App-level error boundary (most serious)
      if (level === "app") {
        return (
          <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Application Error
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-gray-600">
                  The application encountered an unexpected error. Please try refreshing the page.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm text-gray-500">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                      {this.state.error.toString()}
                    </pre>
                  </details>
                )}
                <div className="flex justify-center gap-2">
                  <Button onClick={this.handleRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleGoHome} size="sm">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Page-level error boundary
      if (level === "page") {
        return (
          <div className="flex min-h-[400px] items-center justify-center p-8">
            <Card className="w-full max-w-lg">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <CardTitle className="text-lg font-semibold">Page Error</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-gray-600">This page couldn't load properly. Please try again.</p>
                <Button onClick={this.handleRetry} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Component-level error boundary (least intrusive)
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Component Error</h3>
              <p className="mt-1 text-sm text-red-700">
                This component failed to load.{" "}
                <button onClick={this.handleRetry} className="underline hover:no-underline">
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for error reporting in components
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`Error in ${context}:`, error);
    }

    // In production, report to error service
    // reportError(error, { context });

    throw error; // Re-throw to be caught by Error Boundary
  };

  return { handleError };
}
