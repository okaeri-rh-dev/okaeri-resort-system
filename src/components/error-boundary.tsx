/**
 * Error Boundary Components for Okaeri Resort System
 * Handles runtime errors with graceful fallback UI
 */

import type { ReactNode, ErrorInfo } from "react";
import React, { Component } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: "page" | "section" | "component";
  name?: string;
}

// Base Error Boundary Component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: Math.random().toString(36).substring(2, 15),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { errorId } = this.state;

    // Log the error with context
    logger.error(
      "React Error Boundary caught an error",
      {
        errorId,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        level: this.props.level || "component",
        boundaryName: this.props.name,
      },
      error
    );

    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI based on error level
      const level = this.props.level || "component";

      if (level === "page") {
        return <PageErrorFallback error={this.state} onRetry={this.handleRetry} />;
      }

      if (level === "section") {
        return <SectionErrorFallback error={this.state} onRetry={this.handleRetry} />;
      }

      return <ComponentErrorFallback error={this.state} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

// Page-level error fallback (most severe)
const PageErrorFallback: React.FC<{
  error: ErrorBoundaryState;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
    <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 shadow-lg dark:border-red-800 dark:bg-slate-800">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>

      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          We encountered an unexpected error while loading this page. Our team has been notified and
          is working to fix this issue.
        </p>

        <div className="mb-6 rounded-md bg-slate-100 p-3 text-left dark:bg-slate-700">
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Error ID:{" "}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-600">{error.errorId}</code>
          </p>
          <details className="text-sm text-slate-600 dark:text-slate-400">
            <summary className="cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
              Error details
            </summary>
            <p className="mt-2 font-mono text-xs">
              {error.error?.message || "Unknown error occurred"}
            </p>
          </details>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onRetry}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-slate-600 px-4 py-2 text-white transition-colors hover:bg-slate-700"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          If this problem persists, please contact our support team with the error ID above.
        </p>
      </div>
    </div>
  </div>
);

// Section-level error fallback
const SectionErrorFallback: React.FC<{
  error: ErrorBoundaryState;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/10">
    <div className="flex items-start">
      <AlertTriangle className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
      <div className="flex-1">
        <h3 className="mb-1 text-sm font-medium text-red-800 dark:text-red-300">
          Section unavailable
        </h3>
        <p className="mb-3 text-sm text-red-700 dark:text-red-400">
          This section encountered an error and cannot be displayed right now.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="rounded bg-red-100 px-3 py-1 text-xs text-red-800 transition-colors hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700"
          >
            Try Again
          </button>
          <span className="text-xs text-red-600 dark:text-red-400">Error ID: {error.errorId}</span>
        </div>
      </div>
    </div>
  </div>
);

// Component-level error fallback (minimal)
const ComponentErrorFallback: React.FC<{
  error: ErrorBoundaryState;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/10">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Bug className="mr-2 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm text-yellow-800 dark:text-yellow-300">Component unavailable</span>
      </div>
      <button
        onClick={onRetry}
        className="rounded bg-yellow-200 px-2 py-1 text-xs text-yellow-800 transition-colors hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700"
      >
        Retry
      </button>
    </div>
  </div>
);

// Specialized error boundaries for different parts of the app
export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="section"
    name="Authentication"
    onError={(error, errorInfo) => {
      logger.error(
        "Authentication error boundary triggered",
        {
          component: "auth",
          errorType: "auth_boundary_error",
        },
        error
      );
    }}
  >
    {children}
  </ErrorBoundary>
);

export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="page"
    name="Dashboard"
    onError={(error, errorInfo) => {
      logger.error(
        "Dashboard error boundary triggered",
        {
          component: "dashboard",
          errorType: "dashboard_boundary_error",
        },
        error
      );
    }}
  >
    {children}
  </ErrorBoundary>
);

export const FormErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    name="Form"
    onError={(error, errorInfo) => {
      logger.error(
        "Form error boundary triggered",
        {
          component: "form",
          errorType: "form_boundary_error",
        },
        error
      );
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for programmatic error reporting
export const useErrorReporting = () => {
  const reportError = (error: Error, context?: Record<string, unknown>) => {
    logger.error("Manually reported error", context, error);
  };

  return { reportError };
};
