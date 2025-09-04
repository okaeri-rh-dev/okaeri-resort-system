/**
 * Advanced lazy loading utilities for route components
 * Optimizes bundle size and improves Time to Interactive (TBI)
 */
import React, { ComponentType, Suspense, lazy } from "react";

// Loading fallback component with minimal DOM footprint
const LoadingFallback: React.FC<{ feature?: string }> = ({ feature }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div
        className="border-ocean-600 mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        role="status"
        aria-label="Loading"
      />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {feature ? `Loading ${feature}...` : "Loading..."}
      </p>
    </div>
  </div>
);

// Error boundary for lazy-loaded components
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Lazy loading error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const Fallback =
        this.props.fallback ||
        (() => (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-red-600">Failed to load component</h2>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          </div>
        ));
      return <Fallback />;
    }

    return this.props.children;
  }
}

/**
 * Enhanced lazy loading with preload capabilities and error boundaries
 */
export function createLazyComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    feature?: string;
    preload?: boolean;
    fallback?: React.ComponentType;
    retryDelay?: number;
    maxRetries?: number;
  } = {}
) {
  const { feature, preload = false, fallback, retryDelay = 1000, maxRetries = 3 } = options;

  // Create the lazy component with retry logic
  const LazyComponent = lazy(() => {
    let retries = 0;

    const attemptImport = (): Promise<{ default: ComponentType<T> }> => {
      return importFn().catch((error) => {
        if (retries < maxRetries) {
          retries++;
          console.warn(`Lazy loading failed, retrying (${retries}/${maxRetries}):`, error);
          return new Promise((resolve) => {
            setTimeout(() => resolve(attemptImport()), retryDelay);
          });
        }
        throw error;
      });
    };

    return attemptImport();
  });

  // Preload the component if requested
  if (preload && typeof window !== "undefined") {
    // Use requestIdleCallback to preload during idle time
    const preloadComponent = () => importFn().catch(console.warn);

    if (window.requestIdleCallback) {
      window.requestIdleCallback(preloadComponent, { timeout: 5000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(preloadComponent, 100);
    }
  }

  // Return wrapped component
  const WrappedComponent: React.FC<T> = (props) => (
    <LazyErrorBoundary fallback={fallback}>
      <Suspense fallback={<LoadingFallback feature={feature} />}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyErrorBoundary>
  );

  // Add static preload method for manual preloading
  WrappedComponent.preload = () => importFn();

  return WrappedComponent;
}

/**
 * Higher-order component for route-level code splitting
 */
export function withLazyLoading<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  feature: string
) {
  return createLazyComponent(importFn, { feature });
}

/**
 * Hook for preloading components on user intent
 */
export function useComponentPreloader() {
  const preloadedComponents = React.useRef(new Set<string>());

  const preloadComponent = React.useCallback(
    (componentName: string, importFn: () => Promise<{ default: ComponentType<any> }>) => {
      if (preloadedComponents.current.has(componentName)) {
        return; // Already preloaded
      }

      preloadedComponents.current.add(componentName);
      importFn().catch((error) => {
        console.warn(`Failed to preload ${componentName}:`, error);
        preloadedComponents.current.delete(componentName);
      });
    },
    []
  );

  return { preloadComponent };
}

/**
 * Route component lazy loading with TanStack Router integration
 */
export const LazyRoute = {
  Auth: createLazyComponent(() => import("../routes/_auth"), {
    feature: "Authentication",
    preload: true,
  }),
  Login: createLazyComponent(() => import("../routes/_auth/login"), { feature: "Login" }),
  Register: createLazyComponent(() => import("../routes/_auth/register"), {
    feature: "Registration",
  }),
  ForgotPassword: createLazyComponent(() => import("../routes/_auth/forgot-password"), {
    feature: "Password Reset",
  }),
  ResetPassword: createLazyComponent(() => import("../routes/_auth/reset-password"), {
    feature: "Password Reset",
  }),
  Protected: createLazyComponent(() => import("../routes/_protected"), {
    feature: "Protected Area",
    preload: false,
  }),
  Dashboard: createLazyComponent(() => import("../routes/_protected/dashboard"), {
    feature: "Dashboard",
    preload: false,
  }),
};

/**
 * Preload critical routes based on user behavior
 */
export function preloadCriticalRoutes() {
  if (typeof window === "undefined") return;

  // Preload based on current route
  const currentPath = window.location.pathname;

  if (currentPath === "/" || currentPath.startsWith("/auth")) {
    // User is on auth pages, preload dashboard for after login
    LazyRoute.Protected.preload?.();
    LazyRoute.Dashboard.preload?.();
  }

  if (currentPath.startsWith("/dashboard")) {
    // User is on dashboard, preload other critical components
    // This could be extended based on user permissions
  }
}

/**
 * Performance monitoring for lazy loaded components
 */
export function trackLazyLoadingPerformance(componentName: string) {
  if (typeof window === "undefined" || !window.performance) return;

  const startTime = performance.now();

  return {
    markLoaded: () => {
      const loadTime = performance.now() - startTime;
      console.log(`${componentName} lazy load time: ${loadTime.toFixed(2)}ms`);

      // Report to performance budget manager if available
      if (window.__PERFORMANCE_BUDGET__) {
        window.__PERFORMANCE_BUDGET__.trackLazyLoad(componentName, loadTime);
      }
    },
  };
}
