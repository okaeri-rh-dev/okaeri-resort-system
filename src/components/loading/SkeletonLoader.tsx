import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

// Base Skeleton component
const Skeleton: React.FC<SkeletonProps> = ({ className, animate = true }) => {
  return <div className={cn("bg-sand-200 rounded-md", animate && "animate-pulse", className)} />;
};

// Card Skeleton - for dashboard cards, property cards, etc.
interface CardSkeletonProps {
  showImage?: boolean;
  showActions?: boolean;
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  showImage = false,
  showActions = false,
  className,
}) => {
  return (
    <div className={cn("border-sand-200 space-y-4 rounded-lg border bg-white p-6", className)}>
      {showImage && <Skeleton className="h-48 w-full rounded-lg" />}

      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="flex items-center justify-between pt-4">
        <Skeleton className="h-6 w-20" />
        {showActions && (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        )}
      </div>
    </div>
  );
};

// Table Skeleton - for data tables
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}) => {
  return (
    <div className={cn("border-sand-200 overflow-hidden rounded-lg border bg-white", className)}>
      {showHeader && (
        <div className="border-sand-200 border-b p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        </div>
      )}

      <div className="divide-sand-100 divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Dashboard Skeleton - for dashboard layout
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-sand-200 rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="mt-4">
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Chart Area */}
        <div className="lg:col-span-2">
          <div className="border-sand-200 rounded-lg border bg-white p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="border-sand-200 rounded-lg border bg-white p-6">
            <Skeleton className="mb-4 h-6 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Form Skeleton - for forms
interface FormSkeletonProps {
  fields?: number;
  showActions?: boolean;
  className?: string;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 6,
  showActions = true,
  className,
}) => {
  return (
    <div className={cn("border-sand-200 rounded-lg border bg-white p-6", className)}>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: fields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>

        {showActions && (
          <div className="border-sand-200 flex justify-end space-x-3 border-t pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        )}
      </div>
    </div>
  );
};

// Property Detail Skeleton
export const PropertyDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Image Gallery */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <div className="border-sand-200 rounded-lg border bg-white p-6">
            <Skeleton className="mb-4 h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Features */}
          <div className="border-sand-200 rounded-lg border bg-white p-6">
            <Skeleton className="mb-4 h-6 w-28" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="border-sand-200 rounded-lg border bg-white p-6">
            <Skeleton className="mb-4 h-6 w-24" />
            <Skeleton className="mb-4 h-8 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-6 h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

// List Skeleton - for lists and feeds
interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  showActions?: boolean;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  showAvatar = false,
  showActions = false,
  className,
}) => {
  return (
    <div
      className={cn(
        "border-sand-200 divide-sand-100 divide-y rounded-lg border bg-white",
        className
      )}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="p-4">
          <div className="flex items-center space-x-4">
            {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}

            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>

            {showActions && (
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Navigation Skeleton
export const NavigationSkeleton: React.FC = () => {
  return (
    <nav className="border-sand-200 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>

          <div className="hidden space-x-8 md:flex">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-16" />
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </nav>
  );
};

export { Skeleton };
export default Skeleton;
