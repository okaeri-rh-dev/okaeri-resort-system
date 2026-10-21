import { Component, type ErrorInfo, type ReactNode } from "react";

import { AlertCircle, Home, RefreshCw } from "lucide-react";

import { Button, Callout, Card, CardContent, CardHeader, CardTitle } from "@/components/patterns";

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

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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

  override render() {
    if (this.state.hasError) {
      const { level = "component", fallback } = this.props;

      if (fallback) {
        return fallback;
      }

      // App-level error boundary (most serious)
      if (level === "app") {
        return (
          <div className="bg-background flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="bg-danger mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <AlertCircle className="text-danger-foreground h-6 w-6" aria-hidden="true" />
                </div>
                <CardTitle className="text-xl font-semibold">Application Error</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  The application encountered an unexpected error. Please try refreshing the page.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      Error Details (Development Only)
                    </summary>
                    <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
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
                <div className="bg-danger mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full">
                  <AlertCircle className="text-danger-foreground h-5 w-5" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg font-semibold">Page Error</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  This page couldn't load properly. Please try again.
                </p>
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
        <Callout tone="danger" title="Component Error">
          This component failed to load.{" "}
          <button onClick={this.handleRetry} className="underline hover:no-underline">
            Try again
          </button>
        </Callout>
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
