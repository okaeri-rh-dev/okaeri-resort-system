import { ReactNode, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface RouteWrapperProps {
  children: ReactNode;
  title?: string;
  level?: "page" | "component";
  showSuspense?: boolean;
}

/**
 * Wrapper component for routes with error boundary and loading states
 * Provides consistent error handling and loading experience across all routes
 */
export function RouteWrapper({
  children,
  title,
  level = "page",
  showSuspense = true,
}: RouteWrapperProps) {
  const content = showSuspense ? (
    <Suspense fallback={<RouteSkeleton title={title} />}>{children}</Suspense>
  ) : (
    children
  );

  return (
    <ErrorBoundary level={level} fallback={<RouteErrorFallback title={title} />}>
      {content}
    </ErrorBoundary>
  );
}

/**
 * Loading skeleton for route components
 */
function RouteSkeleton({ title }: { title?: string }) {
  return (
    <div className="container mx-auto p-6">
      {title && <Skeleton className="h-8 w-64 mb-6" />}
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

/**
 * Error fallback component for routes
 */
function RouteErrorFallback({ title }: { title?: string }) {
  return (
    <div className="container mx-auto p-6">
      <Card className="p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            {title ? `Error Loading ${title}` : "Page Error"}
          </h2>
          <p className="mb-6 text-gray-600">
            Something went wrong while loading this page. Please try refreshing or contact support
            if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withRouteWrapper<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<RouteWrapperProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <RouteWrapper {...options}>
      <Component {...props} />
    </RouteWrapper>
  );

  WrappedComponent.displayName = `withRouteWrapper(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
