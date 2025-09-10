/**
 * Error Boundary Component with Sentry Integration
 * Phase 5.4: Monitoring Setup - React error boundary for graceful error handling
 */

import React from "react";
import { ResortErrorTracker } from "../../lib/monitoring/error-tracker";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  feature: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorId?: string;
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError, errorId }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center">
        <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-600">
            An unexpected error occurred in the resort management system.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
            Technical Details
          </summary>
          <div className="mt-2 rounded bg-gray-100 p-3 font-mono text-xs break-all">
            {error.message}
            {errorId && (
              <div className="mt-2 border-t border-gray-300 pt-2">
                <strong>Error ID:</strong> {errorId}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="flex gap-3">
        <button
          onClick={resetError}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="flex-1 rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
        >
          Go to Dashboard
        </button>
      </div>

      <div className="mt-4 rounded-md bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          <strong>For Resort Staff:</strong> This error has been automatically reported to the
          system administrators. If the problem persists, please contact the technical support team.
        </p>
      </div>
    </div>
  </div>
);

export class ResortErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Generate unique error ID for tracking
    const errorId = `REB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Track error with Sentry
    ResortErrorTracker.captureError(
      error,
      {
        feature: this.props.feature,
        action: "component_error",
        additional: {
          errorId,
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      },
      "error"
    );

    // Update state with error ID
    this.setState({ errorId });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error("React Error Boundary caught an error:", {
      error,
      errorInfo,
      errorId,
      feature: this.props.feature,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}

// Hook for using error boundary in functional components
export const useErrorHandler = () => {
  return React.useCallback((error: Error, feature: string, action: string) => {
    ResortErrorTracker.captureError(error, {
      feature,
      action,
      additional: {
        handled: true,
        timestamp: new Date().toISOString(),
      },
    });
  }, []);
};

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  feature: string,
  fallback?: React.ComponentType<ErrorFallbackProps>
) {
  const WrappedComponent = (props: P) => (
    <ResortErrorBoundary feature={feature} fallback={fallback}>
      <Component {...props} />
    </ResortErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
