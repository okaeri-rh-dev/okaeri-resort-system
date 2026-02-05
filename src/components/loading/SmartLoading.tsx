import React, { useEffect, useState } from "react";

import { UseQueryResult } from "@tanstack/react-query";

import { useAdaptiveLoading } from "@/components/providers/LoadingProvider.hooks";
import {
  FormSkeleton,
  KPICardSkeleton,
  MobileCardSkeleton,
  Skeleton,
  TableSkeleton,
  TextSkeleton,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// SMART LOADING WRAPPER
// ============================================

interface SmartLoadingProps {
  query: UseQueryResult<unknown, unknown> | UseQueryResult<unknown, unknown>[];
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  skeletonType?: "table" | "cards" | "form" | "text" | "custom";
  minLoadingTime?: number;
  className?: string;
  fallback?: React.ReactNode;
  onLoadingChange?: (isLoading: boolean) => void;
}

export const SmartLoading: React.FC<SmartLoadingProps> = ({
  query,
  children,
  skeleton,
  skeletonType = "text",
  minLoadingTime = 200,
  className,
  fallback,
  onLoadingChange,
}) => {
  const [hasMinTimeElapsed, setHasMinTimeElapsed] = useState(false);
  const { getOptimalLoadingStrategy } = useAdaptiveLoading();

  // Handle multiple queries
  const queries = Array.isArray(query) ? query : [query];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const errors = queries.filter((q) => q.isError).map((q) => q.error);

  // Get adaptive loading strategy based on network conditions
  const loadingStrategy = getOptimalLoadingStrategy();
  const actualMinTime = Math.max(minLoadingTime, loadingStrategy.skeletonMinDuration);

  useEffect(() => {
    if (isLoading) {
      setHasMinTimeElapsed(false);
      onLoadingChange?.(true);

      const timer = setTimeout(() => {
        setHasMinTimeElapsed(true);
      }, actualMinTime);

      return () => clearTimeout(timer);
    } else {
      onLoadingChange?.(false);
      // Reset for next loading cycle
      setTimeout(() => setHasMinTimeElapsed(false), 100);
    }
  }, [isLoading, actualMinTime, onLoadingChange]);

  // Show loading state until both data is loaded AND minimum time has elapsed
  const shouldShowLoading = isLoading || (isLoading && !hasMinTimeElapsed);

  if (shouldShowLoading) {
    if (skeleton) {
      return <div className={className}>{skeleton}</div>;
    }

    return (
      <div className={className}>
        <DefaultSkeleton
          type={skeletonType}
          reducedAnimations={loadingStrategy.reducedAnimations}
        />
      </div>
    );
  }

  if (isError) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }

    return (
      <div className={cn("p-6 text-center", className)}>
        <div className="space-y-3">
          <div className="font-medium text-red-600">Error loading data</div>
          <div className="text-sm text-neutral-600">
            {errors.length > 0
              ? (errors[0] instanceof Error ? errors[0].message : String(errors[0])) ||
                "An unexpected error occurred"
              : "Please try again later"}
          </div>
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};

// ============================================
// DEFAULT SKELETON RENDERER
// ============================================

interface DefaultSkeletonProps {
  type: "table" | "cards" | "form" | "text" | "custom";
  reducedAnimations?: boolean;
}

const DefaultSkeleton: React.FC<DefaultSkeletonProps> = ({ type, reducedAnimations = false }) => {
  const animationProp = reducedAnimations ? { animation: "none" as const } : {};

  switch (type) {
    case "table":
      return <TableSkeleton rows={6} columns={[120, 200, 100, 120, 80]} {...animationProp} />;

    case "cards":
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <MobileCardSkeleton key={index} hasActions={true} {...animationProp} />
          ))}
        </div>
      );

    case "form":
      return <FormSkeleton fields={5} hasSubmit={true} {...animationProp} />;

    case "text":
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" {...animationProp} />
          <TextSkeleton lines={4} lastLineWidth="3/4" {...animationProp} />
        </div>
      );

    default:
      return <TextSkeleton lines={3} {...animationProp} />;
  }
};

// ============================================
// QUERY-SPECIFIC LOADING COMPONENTS
// ============================================

interface BookingsLoadingProps {
  bookingsQuery: UseQueryResult<unknown, unknown>;
  unitsQuery?: UseQueryResult<unknown, unknown>;
  children: React.ReactNode;
  isMobile?: boolean;
  className?: string;
}

export const BookingsLoading: React.FC<BookingsLoadingProps> = ({
  bookingsQuery,
  unitsQuery,
  children,
  isMobile = false,
  className,
}) => {
  const queries = unitsQuery ? [bookingsQuery, unitsQuery] : [bookingsQuery];

  return (
    <SmartLoading
      query={queries}
      className={className}
      skeleton={
        <div className="space-y-4">
          {/* Filters skeleton */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>

          {/* Table skeleton */}
          {isMobile ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <MobileCardSkeleton key={index} hasActions={true} rowCount={5} />
              ))}
            </div>
          ) : (
            <TableSkeleton
              rows={8}
              columns={[120, 200, 120, 100, 80, 120, 100, 100, 80]}
              hasHeader={true}
              showActions={true}
            />
          )}
        </div>
      }
    >
      {children}
    </SmartLoading>
  );
};

interface UnitsLoadingProps {
  unitsQuery: UseQueryResult<unknown, unknown>;
  children: React.ReactNode;
  viewMode?: "list" | "grid";
  className?: string;
}

export const UnitsLoading: React.FC<UnitsLoadingProps> = ({
  unitsQuery,
  children,
  viewMode = "list",
  className,
}) => {
  return (
    <SmartLoading
      query={unitsQuery}
      className={className}
      skeleton={
        <div className="space-y-4">
          {/* Filters skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Content skeleton based on view mode */}
          {viewMode === "grid" ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-4 w-4" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableSkeleton
              rows={6}
              columns={[50, 100, 200, 100, 120, 120, 100, 100, 80]}
              hasHeader={true}
              showCheckbox={true}
              showActions={true}
            />
          )}
        </div>
      }
    >
      {children}
    </SmartLoading>
  );
};

interface GuestsLoadingProps {
  guestsQuery: UseQueryResult<unknown, unknown>;
  children: React.ReactNode;
  isMobile?: boolean;
  className?: string;
}

export const GuestsLoading: React.FC<GuestsLoadingProps> = ({
  guestsQuery,
  children,
  isMobile = false,
  className,
}) => {
  return (
    <SmartLoading
      query={guestsQuery}
      className={className}
      skeleton={
        <div className="space-y-4">
          {/* Search skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-20" />
          </div>

          {/* Content skeleton */}
          {isMobile ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableSkeleton
              rows={6}
              columns={[200, 150, 120, 100, 100, 80]}
              hasHeader={true}
              showActions={true}
            />
          )}
        </div>
      }
    >
      {children}
    </SmartLoading>
  );
};

// ============================================
// DASHBOARD LOADING
// ============================================

interface DashboardLoadingProps {
  statsQueries: UseQueryResult<unknown, unknown>[];
  children: React.ReactNode;
  className?: string;
}

export const DashboardLoading: React.FC<DashboardLoadingProps> = ({
  statsQueries,
  children,
  className,
}) => {
  return (
    <SmartLoading
      query={statsQueries}
      className={className}
      skeleton={
        <div className="space-y-6">
          {/* KPI Cards skeleton */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <KPICardSkeleton key={index} hasIcon={true} />
            ))}
          </div>

          {/* Additional dashboard content skeleton */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="h-64 rounded-lg border p-4">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Skeleton className="h-6 w-28" />
              <div className="h-64 rounded-lg border p-4">
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </SmartLoading>
  );
};
