import React from "react";
import { cn } from "@/lib/utils";
import {
  Skeleton,
  TableSkeleton,
  MobileCardSkeleton,
  KPICardSkeleton,
  FormSkeleton,
  StepFormSkeleton,
  NavigationSkeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  TextSkeleton,
} from "@/components/ui/skeleton";

// ============================================
// BOOKINGS TABLE SKELETONS
// ============================================

interface BookingsTableSkeletonProps {
  isMobile?: boolean;
  rows?: number;
  className?: string;
}

export const BookingsTableSkeleton: React.FC<BookingsTableSkeletonProps> = ({
  isMobile = false,
  rows = 8,
  className,
}) => {
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile search and filters skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <ButtonSkeleton size="sm" className="w-20" />
              <ButtonSkeleton size="sm" className="w-24" />
            </div>
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Mobile cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <MobileCardSkeleton
              key={index}
              hasActions={true}
              rowCount={5}
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center space-x-2">
            <ButtonSkeleton size="sm" className="w-8 h-8" />
            <div className="flex space-x-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <ButtonSkeleton key={i} size="sm" className="w-8 h-8" />
              ))}
            </div>
            <ButtonSkeleton size="sm" className="w-8 h-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters skeleton */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Skeleton className="h-9 w-48" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-20" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>
        <ButtonSkeleton size="sm" className="w-24" />
      </div>

      {/* Desktop table skeleton */}
      <TableSkeleton
        rows={rows}
        columns={[120, 200, 120, 100, 80, 120, 100, 100, 80]}
        hasHeader={true}
        showActions={true}
        className={className}
      />

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center space-x-2">
          <ButtonSkeleton size="sm" className="w-8 h-8" />
          <div className="flex space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <ButtonSkeleton key={i} size="sm" className="w-8 h-8" />
            ))}
          </div>
          <ButtonSkeleton size="sm" className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
};

// ============================================
// UNITS TABLE SKELETONS
// ============================================

interface UnitsTableSkeletonProps {
  isMobile?: boolean;
  viewMode?: "list" | "grid";
  rows?: number;
  className?: string;
}

export const UnitsTableSkeleton: React.FC<UnitsTableSkeletonProps> = ({
  isMobile = false,
  viewMode = "list",
  rows = 6,
  className,
}) => {
  if (isMobile || viewMode === "grid") {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile/Grid filters skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <ButtonSkeleton size="sm" className="w-20" />
              <ButtonSkeleton size="sm" className="w-24" />
            </div>
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Grid cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3"
            >
              {/* Header with checkbox */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton variant="sharp" className="h-4 w-4" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
                <Skeleton variant="rounded" className="h-6 w-20" />
              </div>

              {/* Content rows */}
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex space-x-2 border-t border-neutral-100 pt-3">
                <ButtonSkeleton size="sm" className="flex-1" />
                <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-9 w-48" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-12" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>

        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-20" />
          <ButtonSkeleton size="sm" className="w-32" />
          <ButtonSkeleton size="sm" className="w-20" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>
      </div>

      {/* Desktop table skeleton with checkbox column */}
      <TableSkeleton
        rows={rows}
        columns={[50, 100, 200, 100, 120, 120, 100, 100, 80]}
        hasHeader={true}
        showCheckbox={true}
        showActions={true}
        className={className}
      />
    </div>
  );
};

// ============================================
// GUESTS TABLE SKELETONS
// ============================================

interface GuestsTableSkeletonProps {
  isMobile?: boolean;
  rows?: number;
  className?: string;
}

export const GuestsTableSkeleton: React.FC<GuestsTableSkeletonProps> = ({
  isMobile = false,
  rows = 6,
  className,
}) => {
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile search skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex justify-between">
            <ButtonSkeleton size="sm" className="w-24" />
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Mobile guest cards */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3"
            >
              {/* Guest header with avatar */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <AvatarSkeleton size="md" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <Skeleton variant="rounded" className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>

              {/* Expandable booking history placeholder */}
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton variant="circle" className="h-4 w-4" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <ButtonSkeleton size="sm" className="flex-1" />
                <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop search and filters */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <ButtonSkeleton size="sm" className="w-20" />
      </div>

      {/* Desktop table skeleton */}
      <TableSkeleton
        rows={rows}
        columns={[200, 150, 120, 100, 100, 80]}
        hasHeader={true}
        showActions={true}
        className={className}
      />
    </div>
  );
};

// ============================================
// DASHBOARD STATS SKELETONS
// ============================================

interface DashboardStatsSkeletonProps {
  cardCount?: number;
  className?: string;
}

export const DashboardStatsSkeleton: React.FC<DashboardStatsSkeletonProps> = ({
  cardCount = 4,
  className,
}) => {
  return (
    <div className={cn("grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: cardCount }).map((_, index) => (
        <KPICardSkeleton
          key={index}
          hasIcon={true}
          className="kpi-card border border-neutral-200 shadow-sm"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  );
};

// ============================================
// BOOKING FORM SKELETONS
// ============================================

interface BookingFormSkeletonProps {
  currentStep?: number;
  className?: string;
}

export const BookingFormSkeleton: React.FC<BookingFormSkeletonProps> = ({
  currentStep = 1,
  className,
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Step progress indicator */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <React.Fragment key={index}>
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  index < currentStep ? "bg-blue-600 border-blue-600" : "border-neutral-300"
                )}
              >
                {index < currentStep ? (
                  <div className="w-2 h-2 bg-white rounded-full" />
                ) : (
                  <Skeleton variant="circle" className="w-2 h-2" />
                )}
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    index < currentStep - 1 ? "bg-blue-600" : "bg-neutral-300"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Form content based on step */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-18" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form actions */}
      <div className="flex justify-between pt-4">
        <ButtonSkeleton size="md" variant="outline" className="w-20" />
        <ButtonSkeleton size="md" className="w-24" />
      </div>
    </div>
  );
};

// ============================================
// NAVIGATION SKELETONS
// ============================================

interface MainLayoutSkeletonProps {
  showSidebar?: boolean;
  className?: string;
}

export const MainLayoutSkeleton: React.FC<MainLayoutSkeletonProps> = ({
  showSidebar = true,
  className,
}) => {
  return (
    <div className={cn("min-h-screen bg-neutral-50", className)}>
      {/* Top navigation */}
      <NavigationSkeleton items={5} showLogo={true} showUser={true} className="sticky top-0 z-50" />

      <div className="flex">
        {/* Sidebar skeleton */}
        {showSidebar && (
          <div className="w-64 bg-white border-r border-neutral-200 p-4 space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Skeleton variant="circle" className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Page header */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>

            {/* Content placeholder */}
            <div className="grid gap-6">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PAGE TRANSITION SKELETONS
// ============================================

export const PageTransitionSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("fixed inset-0 bg-white z-50 flex items-center justify-center", className)}>
      <div className="space-y-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
};

// ============================================
// COMPONENT-SPECIFIC EXPORTS
// ============================================

export {
  // Generic skeletons
  Skeleton,
  TextSkeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  KPICardSkeleton,
  TableSkeleton,
  MobileCardSkeleton,
  FormSkeleton,
  StepFormSkeleton,
  NavigationSkeleton,
};
